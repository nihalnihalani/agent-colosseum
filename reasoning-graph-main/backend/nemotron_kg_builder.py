"""
Knowledge Graph Builder for Nemotron Reasoning
Specialized for handling Nemotron's step-by-step reasoning structure
"""

import os
import json
import re
from typing import Dict, List, Any
from datetime import datetime
from neo4j import GraphDatabase
from agents.nemotron import get_detailed_reasoning_response, NemotronReasoningParser
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))


class NemotronKnowledgeGraphBuilder:
    """
    Builds knowledge graphs specifically for Nemotron's reasoning patterns
    
    Graph Structure:
    - Session: Root node for a reasoning session
    - ReasoningStep: Individual steps in the thinking process
    - Entity: Entities mentioned (numbers, words, concepts)
    - Verification: Verification/checking steps
    - Decision: Decision points in reasoning
    - Conclusion: Final conclusions
    
    Relationships:
    - CONTAINS: Session contains reasoning steps
    - NEXT_STEP: Sequential flow between steps
    - MENTIONS: Step mentions entity
    - VERIFIES: Verification step checks previous step
    - LEADS_TO: Reasoning leads to conclusion
    - CORRECTS: Self-correction relationship
    """
    
    def __init__(self, uri: str = None, user: str = None, password: str = None):
        self.uri = uri or os.getenv('NEO4J_URI')
        self.user = user or os.getenv('NEO4J_USER')
        self.password = password or os.getenv('NEO4J_PASSWORD')
        
        if not all([self.uri, self.user, self.password]):
            raise ValueError("Neo4j credentials required")
        
        self.driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))
        self._create_constraints()
    
    def _create_constraints(self):
        """Create constraints for Nemotron-specific nodes"""
        with self.driver.session() as session:
            constraints = [
                "CREATE CONSTRAINT nemotron_session_id IF NOT EXISTS FOR (s:NemotronSession) REQUIRE s.id IS UNIQUE",
                "CREATE CONSTRAINT reasoning_step_id IF NOT EXISTS FOR (r:ReasoningStep) REQUIRE r.id IS UNIQUE",
                "CREATE CONSTRAINT entity_name IF NOT EXISTS FOR (e:Entity) REQUIRE e.name IS UNIQUE",
            ]
            
            for constraint in constraints:
                try:
                    session.run(constraint)
                except Exception as e:
                    print(f"Constraint note: {e}")
    
    def process_query(self, user_query: str, session_id: str = None) -> Dict[str, Any]:
        """
        Process a query with Nemotron and build the knowledge graph
        
        Args:
            user_query: The user's question
            session_id: Optional session ID
        
        Returns:
            Dict with session_id, thinking, answer, and graph stats
        """
        # Generate session ID if not provided
        if not session_id:
            session_id = f"nemotron_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        print(f"Processing query with Nemotron: {user_query}")
        
        # Get detailed reasoning from Nemotron
        result = get_detailed_reasoning_response(user_query)
        
        # Build the knowledge graph
        graph_stats = self._build_graph(session_id, user_query, result)
        
        return {
            'session_id': session_id,
            'query': user_query,
            'thinking': result['thinking'],
            'answer': result['answer'],
            'reasoning_steps': len(result['reasoning_steps']),
            'metadata': result['metadata'],
            'graph_stats': graph_stats
        }
    
    def _build_graph(self, session_id: str, user_query: str, parsed_result: Dict[str, Any]) -> Dict[str, int]:
        """
        Build a chain-of-thought graph with branches and groupings
        Creates a true graph structure with multiple reasoning paths
        """
        
        with self.driver.session() as db_session:
            # Create session node (root)
            db_session.run("""
                MERGE (s:NemotronSession {id: $session_id})
                SET s.query = $user_query,
                    s.timestamp = datetime(),
                    s.answer = $answer,
                    s.verification_count = $verification_count,
                    s.has_self_correction = $has_self_correction,
                    s.reasoning_depth = $reasoning_depth,
                    s.total_steps = $total_steps
            """, 
                session_id=session_id,
                user_query=user_query,
                answer=parsed_result['answer'],
                verification_count=parsed_result['metadata']['verification_count'],
                has_self_correction=parsed_result['metadata']['has_self_correction'],
                reasoning_depth=parsed_result['metadata']['reasoning_depth'],
                total_steps=len(parsed_result['reasoning_steps'])
            )
            
            # Group steps by type and paragraph for branching
            grouped_steps = self._group_reasoning_steps(parsed_result['reasoning_steps'])
            
            step_count = 0
            entity_count = 0
            verification_count = 0
            decision_count = 0
            
            # Track nodes by type for branching
            nodes_by_type = {}
            all_step_ids = []
            
            # Create all nodes first
            for group_idx, group in enumerate(grouped_steps):
                step_id = f"{session_id}_step_{group_idx}"
                all_step_ids.append(step_id)
                
                # Determine node type
                if group['is_verification']:
                    node_type = "Verification"
                    verification_count += 1
                elif group['is_decision']:
                    node_type = "Decision"
                    decision_count += 1
                else:
                    node_type = group['type'].title().replace('_', '')
                
                # Track nodes by type for branching
                if node_type not in nodes_by_type:
                    nodes_by_type[node_type] = []
                nodes_by_type[node_type].append({
                    'id': step_id,
                    'index': group_idx,
                    'entities': group['entities']
                })
                
                # Sanitize node_type to prevent Cypher injection
                if not re.match(r'^[A-Za-z0-9]+$', node_type):
                    node_type = re.sub(r'[^A-Za-z0-9]', '', node_type)
                if not node_type:
                    node_type = "Unknown"

                # Create step node
                db_session.run(f"""
                    MERGE (r:ReasoningStep:{node_type} {{id: $step_id}})
                    SET r.content = $content,
                        r.type = $type,
                        r.confidence = $confidence,
                        r.sequence_order = $order,
                        r.group_size = $group_size
                """,
                    step_id=step_id,
                    content=group['content'],
                    type=group['type'],
                    confidence=group['confidence'],
                    order=group_idx,
                    group_size=group.get('group_size', 1)
                )
                
                step_count += 1
            
            # Create relationships with branching logic
            for i, step_id in enumerate(all_step_ids):
                if i == 0:
                    # First step connects to session
                    db_session.run("""
                        MATCH (s:NemotronSession {id: $session_id})
                        MATCH (r:ReasoningStep {id: $step_id})
                        MERGE (s)-[:STARTS_WITH]->(r)
                    """, session_id=session_id, step_id=step_id)
                else:
                    current_group = grouped_steps[i]
                    
                    # Main flow: connect to previous step
                    prev_step_id = all_step_ids[i-1]
                    db_session.run("""
                        MATCH (prev:ReasoningStep {id: $prev_step_id})
                        MATCH (curr:ReasoningStep {id: $curr_step_id})
                        MERGE (prev)-[:LEADS_TO]->(curr)
                    """, prev_step_id=prev_step_id, curr_step_id=step_id)
                    
                    # Branch: Verifications connect back to what they verify
                    if current_group['is_verification'] and i >= 2:
                        # Connect to recent execution/decision steps
                        verified_count = 0
                        for j in range(i-1, max(0, i-6), -1):
                            check_group = grouped_steps[j]
                            if not check_group['is_verification'] and check_group['type'] in ['execution', 'decision', 'decomposition']:
                                db_session.run("""
                                    MATCH (v:Verification {id: $verif_id})
                                    MATCH (s:ReasoningStep {id: $step_id})
                                    MERGE (v)-[:VERIFIES]->(s)
                                """, verif_id=step_id, step_id=all_step_ids[j])
                                verified_count += 1
                                if verified_count >= 2:  # Verify up to 2 previous steps
                                    break
                    
                    # Branch: Decisions reference problem understanding
                    if current_group['is_decision'] and i >= 2:
                        for j in range(max(0, i-8), i):
                            check_group = grouped_steps[j]
                            if check_group['type'] == 'problem_understanding':
                                db_session.run("""
                                    MATCH (d:Decision {id: $decision_id})
                                    MATCH (p:ReasoningStep {id: $problem_id})
                                    MERGE (d)-[:BASED_ON]->(p)
                                """, decision_id=step_id, problem_id=all_step_ids[j])
                                break
                    
                    # Branch: Conclusions connect to supporting evidence
                    if current_group['type'] == 'conclusion' and i >= 2:
                        evidence_count = 0
                        for j in range(i-1, max(0, i-10), -1):
                            check_group = grouped_steps[j]
                            if check_group['type'] in ['execution', 'verification'] or check_group['is_verification']:
                                db_session.run("""
                                    MATCH (c:ReasoningStep {id: $conclusion_id})
                                    MATCH (e:ReasoningStep {id: $evidence_id})
                                    MERGE (c)-[:SUPPORTED_BY]->(e)
                                """, conclusion_id=step_id, evidence_id=all_step_ids[j])
                                evidence_count += 1
                                if evidence_count >= 3:  # Connect to up to 3 pieces of evidence
                                    break
            
            # Connect final step to answer
            if all_step_ids:
                answer_id = f"{session_id}_answer"
                db_session.run("""
                    MERGE (a:Answer {id: $answer_id})
                    SET a.content = $answer,
                        a.session_id = $sess_id
                    WITH a
                    MATCH (last:ReasoningStep {id: $last_step_id})
                    MERGE (last)-[:CONCLUDES_WITH]->(a)
                """, answer_id=answer_id, answer=parsed_result['answer'], 
                     sess_id=session_id, last_step_id=all_step_ids[-1])
            
            return {
                'steps': step_count,
                'entities': entity_count,
                'verifications': verification_count,
                'decisions': decision_count
            }
    
    def _group_reasoning_steps(self, all_steps: List[Dict]) -> List[Dict]:
        """
        Group reasoning steps by type and paragraph for better graph structure
        Creates clusters of similar reasoning
        """
        if len(all_steps) <= 8:
            return all_steps
        
        grouped = []
        current_group = None
        
        for step in all_steps:
            # Start new group if type changes or it's a special step
            if (current_group is None or 
                step['type'] != current_group['type'] or
                step['paragraph_index'] != current_group['paragraph_index'] or
                step['is_verification'] or 
                step['is_decision'] or
                current_group['is_verification'] or
                current_group['is_decision']):
                
                # Save previous group
                if current_group:
                    grouped.append(current_group)
                
                # Start new group
                current_group = {
                    'content': step['content'],
                    'type': step['type'],
                    'confidence': step['confidence'],
                    'is_verification': step['is_verification'],
                    'is_decision': step['is_decision'],
                    'entities': step['entities'].copy(),
                    'paragraph_index': step['paragraph_index'],
                    'group_size': 1
                }
            else:
                # Add to current group
                current_group['content'] += ' ' + step['content']
                current_group['confidence'] = max(current_group['confidence'], step['confidence'])
                current_group['entities'].extend(step['entities'])
                current_group['entities'] = list(set(current_group['entities']))
                current_group['group_size'] += 1
        
        # Add final group
        if current_group:
            grouped.append(current_group)
        
        return grouped
    
    def _extract_key_steps(self, all_steps: List[Dict]) -> List[Dict]:
        """
        Extract only key reasoning steps to simplify the graph
        Groups similar steps and keeps only important transitions
        """
        if len(all_steps) <= 10:
            return all_steps
        
        key_steps = []
        current_type = None
        current_para = None
        accumulated_content = []
        accumulated_entities = []
        max_confidence = 0.0
        
        for step in all_steps:
            # Keep if it's a different type or paragraph
            if (step['type'] != current_type or 
                step['paragraph_index'] != current_para or
                step['is_verification'] or 
                step['is_decision']):
                
                # Save accumulated step if exists
                if accumulated_content:
                    key_steps.append({
                        'content': ' '.join(accumulated_content),
                        'type': current_type,
                        'confidence': max_confidence,
                        'is_verification': False,
                        'is_decision': False,
                        'entities': list(set(accumulated_entities))
                    })
                
                # Start new accumulation
                current_type = step['type']
                current_para = step['paragraph_index']
                accumulated_content = [step['content']]
                accumulated_entities = step['entities'].copy()
                max_confidence = step['confidence']
                
                # Always keep verifications and decisions as separate nodes
                if step['is_verification'] or step['is_decision']:
                    key_steps.append(step)
                    accumulated_content = []
                    accumulated_entities = []
            else:
                # Accumulate similar steps
                accumulated_content.append(step['content'])
                accumulated_entities.extend(step['entities'])
                max_confidence = max(max_confidence, step['confidence'])
        
        # Add final accumulated step
        if accumulated_content:
            key_steps.append({
                'content': ' '.join(accumulated_content),
                'type': current_type,
                'confidence': max_confidence,
                'is_verification': False,
                'is_decision': False,
                'entities': list(set(accumulated_entities))
            })
        
        return key_steps
    
    def get_session_graph(self, session_id: str) -> Dict[str, List[Dict]]:
        """Get linear graph data for a specific session (top to bottom flow)"""
        with self.driver.session() as session:
            # Get session node
            session_result = session.run("""
                MATCH (s:NemotronSession {id: $session_id})
                RETURN s
            """, session_id=session_id)
            
            session_record = session_result.single()
            if not session_record:
                return {'nodes': [], 'links': []}
            
            # Get all reasoning steps in order
            steps_result = session.run("""
                MATCH (r:ReasoningStep)
                WHERE r.id STARTS WITH $session_id
                RETURN r
                ORDER BY r.sequence_order
            """, session_id=session_id)
            
            # Get answer node
            answer_result = session.run("""
                MATCH (a:Answer)
                WHERE a.id STARTS WITH $session_id
                RETURN a
            """, session_id=session_id)
            
            nodes = []
            links = []
            
            # Add session node (top of graph)
            session_node = session_record['s']
            nodes.append({
                'id': session_node.element_id,
                'label': f"Q: {session_node.get('query', '')[:40]}",
                'type': 'Query',
                'val': 20,
                'level': 0  # Top level
            })
            
            # Add reasoning step nodes in order
            steps = list(steps_result)
            for idx, record in enumerate(steps):
                step = record['r']
                    
                # Determine step type for coloring
                step_labels = list(step.labels)
                if 'Verification' in step_labels:
                    step_type = 'Verification'
                elif 'Decision' in step_labels:
                    step_type = 'Decision'
                else:
                    step_type = step.get('type', 'reasoning').title()
                
                nodes.append({
                    'id': step.element_id,
                    'label': step.get('content', '')[:60],
                    'type': step_type,
                    'val': 12,
                    'confidence': step.get('confidence', 0.8),
                    'level': idx + 1  # Sequential levels
                })
            
            # Add answer node (bottom of graph)
            answer_record = answer_result.single()
            if answer_record:
                answer = answer_record['a']
                nodes.append({
                    'id': answer.element_id,
                    'label': f"A: {answer.get('content', '')[:60]}",
                    'type': 'Answer',
                    'val': 20,
                    'level': len(steps) + 1  # Bottom level
                })
            
            # Get all relationships (including branches) - simplified queries
            # Get STARTS_WITH
            starts = session.run("""
                MATCH (s:NemotronSession {id: $session_id})-[r:STARTS_WITH]->(first)
                RETURN s.id as source_id, first.id as target_id, type(r) as type
            """, session_id=session_id)
            for rec in starts:
                links.append({'source': session_node.element_id, 'target': next((n['id'] for n in nodes if n.get('label', '').startswith('Q:')), None), 'type': 'STARTS_WITH', 'strength': 1.0})
            
            # Get all relationships for this session
            all_rels = session.run("""
                MATCH (a)-[r]->(b)
                WHERE a.id STARTS WITH $session_id OR b.id STARTS WITH $session_id
                RETURN a, b, type(r) as rel_type
            """, session_id=session_id)
            
            # Map node IDs to element IDs
            node_map = {n.get('label', ''): n['id'] for n in nodes}
            
            for rec in all_rels:
                source_elem = rec['a'].element_id
                target_elem = rec['b'].element_id
                rel_type = rec['rel_type']
                
                # Determine strength based on relationship type
                strength_map = {
                    'STARTS_WITH': 1.0,
                    'LEADS_TO': 1.0,
                    'CONCLUDES_WITH': 1.0,
                    'VERIFIES': 0.7,
                    'BASED_ON': 0.6,
                    'SUPPORTED_BY': 0.8
                }
                
                links.append({
                    'source': source_elem,
                    'target': target_elem,
                    'type': rel_type,
                    'strength': strength_map.get(rel_type, 0.5)
                })
            
            return {'nodes': nodes, 'links': links}
    
    def get_all_sessions(self) -> List[Dict[str, Any]]:
        """Get all Nemotron sessions"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (s:NemotronSession)
                RETURN s.id as session_id, 
                       s.query as query,
                       s.verification_count as verifications,
                       s.has_self_correction as has_correction,
                       s.total_steps as step_count,
                       toString(s.timestamp) as timestamp
                ORDER BY s.timestamp DESC
            """)
            
            return [record.data() for record in result]
    
    def close(self):
        """Close database connection"""
        self.driver.close()


# Example usage and testing
def main():
    """Test the Nemotron KG builder"""
    
    kg_builder = NemotronKnowledgeGraphBuilder()
    
    try:
        # Test query
        test_query = "How many 'r's are in 'strawberry'?"
        
        print(f"Processing: {test_query}")
        print("="*80)
        
        result = kg_builder.process_query(test_query)
        
        print(f"\nSession ID: {result['session_id']}")
        print(f"Reasoning Steps: {result['reasoning_steps']}")
        print(f"Graph Stats: {result['graph_stats']}")
        print(f"\nMetadata:")
        for key, value in result['metadata'].items():
            print(f"  {key}: {value}")
        
        print(f"\n{'='*80}")
        print("THINKING:")
        print(f"{'='*80}")
        print(result['thinking'][:500] + "...")
        
        print(f"\n{'='*80}")
        print("ANSWER:")
        print(f"{'='*80}")
        print(result['answer'])
        
        # Get all sessions
        print(f"\n{'='*80}")
        print("ALL SESSIONS:")
        print(f"{'='*80}")
        sessions = kg_builder.get_all_sessions()
        for s in sessions:
            print(f"\n{s['session_id']}:")
            print(f"  Query: {s['query']}")
            print(f"  Steps: {s['step_count']}")
            print(f"  Verifications: {s['verifications']}")
        
    finally:
        kg_builder.close()


if __name__ == "__main__":
    main()
