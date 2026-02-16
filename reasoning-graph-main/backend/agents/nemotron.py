"""
Llama-3.3-Nemotron Super 49B Reasoning Agent
Handles the Nemotron model's <think>...</think> format and extracts structured reasoning
"""

from openai import OpenAI
import os
import re
from typing import Tuple, List, Dict, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'))

# Initialize Nemotron client
_nvidia_api_key = os.getenv("NVIDIA_API_KEY")
if not _nvidia_api_key:
    raise ValueError(
        "NVIDIA_API_KEY environment variable is not set. "
        "Please set it in your .env file or environment."
    )

nemotron_client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=_nvidia_api_key
)


class NemotronReasoningParser:
    """
    Parses Nemotron's reasoning output into structured components
    """
    
    @staticmethod
    def parse_response(full_response: str) -> Dict[str, Any]:
        """
        Parse Nemotron response into thinking and answer sections
        
        Returns:
            dict with 'thinking', 'answer', 'reasoning_steps', and 'metadata'
        """
        # Extract thinking section (between <think> tags)
        think_match = re.search(r'<think>(.*?)</think>', full_response, re.DOTALL | re.IGNORECASE)
        
        if think_match:
            thinking = think_match.group(1).strip()
            # Everything after </think> is the answer
            answer = full_response[think_match.end():].strip()
        else:
            # Fallback: no clear separation
            thinking = full_response
            answer = ""
        
        # Parse reasoning steps from thinking section
        reasoning_steps = NemotronReasoningParser._extract_reasoning_steps(thinking)
        
        # Extract metadata
        metadata = NemotronReasoningParser._extract_metadata(thinking, answer)
        
        return {
            'thinking': thinking,
            'answer': answer,
            'reasoning_steps': reasoning_steps,
            'metadata': metadata,
            'full_response': full_response
        }
    
    @staticmethod
    def _extract_reasoning_steps(thinking: str) -> List[Dict[str, Any]]:
        """
        Extract individual reasoning steps from the thinking section
        
        Nemotron typically uses natural language flow, so we identify:
        - Sentences or paragraphs
        - Key reasoning moments (questions, decisions, verifications)
        - Transitions (then, next, wait, etc.)
        """
        steps = []
        
        # Split by paragraphs first
        paragraphs = [p.strip() for p in thinking.split('\n\n') if p.strip()]
        
        for para_idx, paragraph in enumerate(paragraphs):
            # Further split by sentences for detailed analysis
            sentences = re.split(r'(?<=[.!?])\s+', paragraph)
            
            for sent_idx, sentence in enumerate(sentences):
                if not sentence.strip():
                    continue
                
                # Classify the reasoning step type
                step_type = NemotronReasoningParser._classify_reasoning_step(sentence)
                
                # Extract entities mentioned
                entities = NemotronReasoningParser._extract_entities(sentence)
                
                # Detect verification/checking behavior
                is_verification = bool(re.search(
                    r'\b(wait|check|verify|make sure|let me|confirm|double.?check)\b',
                    sentence, re.IGNORECASE
                ))
                
                # Detect decision points
                is_decision = bool(re.search(
                    r'\b(so|therefore|thus|hence|okay|alright|i think)\b',
                    sentence, re.IGNORECASE
                ))
                
                steps.append({
                    'id': f'step_{para_idx}_{sent_idx}',
                    'content': sentence.strip(),
                    'type': step_type,
                    'entities': entities,
                    'is_verification': is_verification,
                    'is_decision': is_decision,
                    'paragraph_index': para_idx,
                    'sentence_index': sent_idx,
                    'confidence': NemotronReasoningParser._estimate_confidence(sentence)
                })
        
        return steps
    
    @staticmethod
    def _classify_reasoning_step(sentence: str) -> str:
        """
        Classify the type of reasoning step
        
        Types:
        - problem_understanding: Understanding the question
        - decomposition: Breaking down the problem
        - execution: Performing the actual reasoning/calculation
        - verification: Checking the work
        - conclusion: Final answer or decision
        """
        sentence_lower = sentence.lower()
        
        # Problem understanding
        if any(word in sentence_lower for word in ['question is', 'asking', 'need to', 'should', 'let\'s see']):
            return 'problem_understanding'
        
        # Decomposition
        if any(word in sentence_lower for word in ['first', 'break', 'step', 'write down', 'spell']):
            return 'decomposition'
        
        # Verification
        if any(word in sentence_lower for word in ['wait', 'check', 'make sure', 'verify', 'confirm', 'let me']):
            return 'verification'
        
        # Conclusion
        if any(word in sentence_lower for word in ['so', 'therefore', 'answer', 'total', 'in conclusion']):
            return 'conclusion'
        
        # Execution (default for actual work)
        return 'execution'
    
    @staticmethod
    def _extract_entities(text: str) -> List[str]:
        """Extract entities like numbers, words being analyzed, etc."""
        entities = []
        
        # Extract quoted strings
        quoted = re.findall(r"'([^']*)'|\"([^\"]*)\"", text)
        entities.extend([q[0] or q[1] for q in quoted if q[0] or q[1]])
        
        # Extract numbers
        numbers = re.findall(r'\b\d+\b', text)
        entities.extend(numbers)
        
        # Extract letter references (e.g., "letter R", "'r'")
        letters = re.findall(r"letter\s+['\"]?([a-zA-Z])['\"]?", text, re.IGNORECASE)
        entities.extend(letters)
        
        return list(set(entities))
    
    @staticmethod
    def _estimate_confidence(sentence: str) -> float:
        """
        Estimate confidence based on language used
        
        High confidence: "definitely", "clearly", "obviously"
        Medium confidence: "think", "probably", "seems"
        Low confidence: "maybe", "might", "not sure", "hmm"
        """
        sentence_lower = sentence.lower()
        
        # Low confidence indicators
        if any(word in sentence_lower for word in ['maybe', 'might', 'not sure', 'hmm', 'wait', 'confused']):
            return 0.5
        
        # Medium confidence
        if any(word in sentence_lower for word in ['think', 'probably', 'seems', 'should']):
            return 0.7
        
        # High confidence
        if any(word in sentence_lower for word in ['definitely', 'clearly', 'obviously', 'certainly', 'correct']):
            return 0.95
        
        # Default medium-high
        return 0.8
    
    @staticmethod
    def _extract_metadata(thinking: str, answer: str) -> Dict[str, Any]:
        """Extract metadata about the reasoning process"""
        
        # Count verification steps
        verification_count = len(re.findall(
            r'\b(wait|check|verify|make sure|let me|confirm)\b',
            thinking, re.IGNORECASE
        ))
        
        # Detect self-correction
        has_self_correction = bool(re.search(
            r'\b(wait|actually|no|correction|mistake|wrong)\b',
            thinking, re.IGNORECASE
        ))
        
        # Count reasoning depth (paragraphs as proxy)
        reasoning_depth = len([p for p in thinking.split('\n\n') if p.strip()])
        
        # Detect structured answer
        has_structured_answer = bool(re.search(r'\*\*.*?\*\*|^\d+\.|^-', answer, re.MULTILINE))
        
        return {
            'verification_count': verification_count,
            'has_self_correction': has_self_correction,
            'reasoning_depth': reasoning_depth,
            'has_structured_answer': has_structured_answer,
            'thinking_length': len(thinking),
            'answer_length': len(answer)
        }


def get_reasoning_response(user_input: str, stream: bool = True) -> Tuple[str, str]:
    """
    Get reasoning response from Nemotron model
    
    Args:
        user_input: The user's question/prompt
        stream: Whether to stream the response (default True)
    
    Returns:
        Tuple of (thinking, answer) where:
        - thinking: The model's step-by-step reasoning process
        - answer: The final answer/response
    """
    
    completion = nemotron_client.chat.completions.create(
        model="nvidia/llama-3.3-nemotron-super-49b-v1.5",
        messages=[
            {"role": "system", "content": "/think"},
            {"role": "user", "content": user_input}
        ],
        temperature=0.6,
        top_p=0.95,
        max_tokens=65536,
        frequency_penalty=0,
        presence_penalty=0,
        stream=stream
    )
    
    # Collect full response
    full_response = ""
    
    if stream:
        for chunk in completion:
            if chunk.choices[0].delta.content is not None:
                full_response += chunk.choices[0].delta.content
    else:
        full_response = completion.choices[0].message.content
    
    # Parse the response
    parsed = NemotronReasoningParser.parse_response(full_response)
    
    return parsed['thinking'], parsed['answer']


def get_detailed_reasoning_response(user_input: str) -> Dict[str, Any]:
    """
    Get detailed reasoning response with full parsing
    
    Returns:
        Complete parsed response including reasoning steps and metadata
    """
    
    completion = nemotron_client.chat.completions.create(
        model="nvidia/llama-3.3-nemotron-super-49b-v1.5",
        messages=[
            {"role": "system", "content": "/think"},
            {"role": "user", "content": user_input}
        ],
        temperature=0.6,
        top_p=0.95,
        max_tokens=65536,
        frequency_penalty=0,
        presence_penalty=0,
        stream=True
    )
    
    # Collect full response
    full_response = ""
    for chunk in completion:
        if chunk.choices[0].delta.content is not None:
            full_response += chunk.choices[0].delta.content
    
    # Parse and return full structure
    return NemotronReasoningParser.parse_response(full_response)


if __name__ == "__main__":
    # Test the implementation
    print("Testing Nemotron Reasoning Agent")
    print("="*80)
    
    test_query = "How many 'r's are in 'strawberry'?"
    print(f"\nQuery: {test_query}\n")
    
    # Get detailed response
    result = get_detailed_reasoning_response(test_query)
    
    print("\n" + "="*80)
    print("THINKING PROCESS:")
    print("="*80)
    print(result['thinking'])
    
    print("\n" + "="*80)
    print("FINAL ANSWER:")
    print("="*80)
    print(result['answer'])
    
    print("\n" + "="*80)
    print("REASONING STEPS:")
    print("="*80)
    for i, step in enumerate(result['reasoning_steps'][:5], 1):
        print(f"\n{i}. [{step['type']}] {step['content'][:100]}...")
        print(f"   Entities: {step['entities']}")
        print(f"   Confidence: {step['confidence']}")
    
    print("\n" + "="*80)
    print("METADATA:")
    print("="*80)
    for key, value in result['metadata'].items():
        print(f"  {key}: {value}")
