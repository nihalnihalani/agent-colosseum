"""
Nemotron Reasoning Service
Integrates Llama-3.3-Nemotron-Super-49B with knowledge graph building
"""

import os
import logging
from typing import Dict, Tuple, Any, Optional
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'))

# Setup logging
logger = logging.getLogger(__name__)

# Import Nemotron agent and KG builder
try:
    from agents.nemotron import get_detailed_reasoning_response
    from nemotron_kg_builder import NemotronKnowledgeGraphBuilder
    NEMOTRON_AVAILABLE = True
    logger.info("✅ Nemotron agent and KG builder imported successfully")
except ImportError as e:
    logger.warning(f"⚠️ Nemotron components not available: {e}")
    NEMOTRON_AVAILABLE = False


class NemotronService:
    """
    Service for handling Nemotron reasoning with knowledge graph integration
    """
    
    def __init__(self):
        self.nemotron_available = NEMOTRON_AVAILABLE
        self.kg_builder = None
        
        # Initialize KG builder if available
        if NEMOTRON_AVAILABLE:
            try:
                self.kg_builder = NemotronKnowledgeGraphBuilder()
                logger.info("✅ Nemotron KG builder initialized")
            except Exception as e:
                logger.warning(f"⚠️ Nemotron KG builder initialization failed: {e}")
                self.kg_builder = None
    
    def get_reasoning_response_with_graph(
        self,
        user_input: str,
        session_id: Optional[str] = None,
        build_graph: bool = True
    ) -> Tuple[str, str, Dict[str, Any]]:
        """
        Get reasoning response from Nemotron and optionally build knowledge graph
        
        Args:
            user_input: User's question
            session_id: Optional session ID
            build_graph: Whether to build the knowledge graph
        
        Returns:
            Tuple of (thinking, answer, metadata)
        """
        
        if not self.nemotron_available:
            return self._fallback_response(user_input)
        
        try:
            if build_graph and self.kg_builder:
                # Process with full KG building
                result = self.kg_builder.process_query(user_input, session_id)
                
                metadata = {
                    'session_id': result['session_id'],
                    'reasoning_steps': result['reasoning_steps'],
                    'graph_stats': result['graph_stats'],
                    'metadata': result['metadata'],
                    'nemotron_enabled': True,
                    'kg_enabled': True
                }
                
                return result['thinking'], result['answer'], metadata
            else:
                # Just get reasoning without KG
                result = get_detailed_reasoning_response(user_input)
                
                metadata = {
                    'session_id': session_id or f"nemotron_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    'reasoning_steps': len(result['reasoning_steps']),
                    'metadata': result['metadata'],
                    'nemotron_enabled': True,
                    'kg_enabled': False
                }
                
                return result['thinking'], result['answer'], metadata
                
        except Exception as e:
            logger.error(f"❌ Nemotron processing failed: {e}")
            return self._fallback_response(user_input)
    
    def _fallback_response(self, user_input: str) -> Tuple[str, str, Dict[str, Any]]:
        """Fallback when Nemotron is not available"""
        thinking = f"Processing query: {user_input}"
        answer = "Nemotron service is currently unavailable. Please check configuration."
        metadata = {
            'nemotron_enabled': False,
            'kg_enabled': False,
            'error': 'Nemotron not available'
        }
        return thinking, answer, metadata
    
    def health_check(self) -> Dict[str, Any]:
        """Check service health"""
        return {
            'nemotron_available': self.nemotron_available,
            'kg_builder_ready': self.kg_builder is not None,
            'service_ready': self.nemotron_available and self.kg_builder is not None,
            'timestamp': datetime.now().isoformat()
        }
    
    def get_all_sessions(self) -> list:
        """Get all Nemotron sessions from KG"""
        if self.kg_builder:
            try:
                return self.kg_builder.get_all_sessions()
            except Exception as e:
                logger.error(f"❌ Failed to get sessions: {e}")
                return []
        return []
    
    def get_session_graph(self, session_id: str) -> Dict:
        """Get graph data for a specific session"""
        if self.kg_builder:
            try:
                return self.kg_builder.get_session_graph(session_id)
            except Exception as e:
                logger.error(f"❌ Failed to get session graph: {e}")
                return {'nodes': [], 'links': []}
        return {'nodes': [], 'links': []}
    
    def close(self):
        """Close connections"""
        if self.kg_builder:
            try:
                self.kg_builder.close()
                logger.info("✅ Nemotron KG builder closed")
            except Exception as e:
                logger.error(f"❌ Error closing KG builder: {e}")


# Singleton instance
_nemotron_service = None

def get_nemotron_service() -> NemotronService:
    """Get or create the Nemotron service singleton"""
    global _nemotron_service
    if _nemotron_service is None:
        _nemotron_service = NemotronService()
    return _nemotron_service


if __name__ == "__main__":
    # Test the service
    service = get_nemotron_service()
    
    print("Nemotron Service Health Check:")
    print(service.health_check())
    
    print("\nTesting with query...")
    thinking, answer, metadata = service.get_reasoning_response_with_graph(
        "How many 'r's are in 'strawberry'?"
    )
    
    print(f"\nThinking: {thinking[:200]}...")
    print(f"\nAnswer: {answer}")
    print(f"\nMetadata: {metadata}")
