from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from datetime import datetime
from services.nemotron_service import get_nemotron_service
from dotenv import load_dotenv

# Load environment variables from parent directory
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize Nemotron service
nemotron_service = None

def init_nemotron_service():
    """Initialize the Nemotron service"""
    global nemotron_service
    try:
        nemotron_service = get_nemotron_service()
        health = nemotron_service.health_check()
        if health['service_ready']:
            print("Nemotron service initialized successfully")
        else:
            print("Nemotron service initialized but not fully ready")
    except Exception as e:
        print(f"Failed to initialize Nemotron service: {e}")
        nemotron_service = None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    # Get Nemotron service health
    nemotron_health = None
    if nemotron_service:
        nemotron_health = nemotron_service.health_check()
    
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'nemotron_service': nemotron_health,
        'model': 'Llama-3.3-Nemotron-Super-49B'
    })

@app.route('/api/chat', methods=['POST'])
def chat_with_agent():
    """Chat with Nemotron reasoning model and build knowledge graph"""
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        session_id = data.get('session_id')
        build_graph = data.get('build_graph', True)
        
        if not user_message:
            return jsonify({'error': 'message is required'}), 400
        
        if not nemotron_service:
            return jsonify({'error': 'Nemotron service not initialized'}), 500
        
        # Get response from Nemotron with knowledge graph
        thinking, answer, metadata = nemotron_service.get_reasoning_response_with_graph(
            user_message, session_id, build_graph
        )
        
        return jsonify({
            'success': True,
            'session_id': metadata.get('session_id'),
            'thinking': thinking,
            'answer': answer,
            'response': answer,  # For backward compatibility
            'thoughts': thinking,  # For backward compatibility
            'message': 'Chat processed successfully',
            'reasoning_steps': metadata.get('reasoning_steps', 0),
            'graph_stats': metadata.get('graph_stats', {}),
            'metadata': {
                'verification_count': metadata.get('metadata', {}).get('verification_count', 0),
                'has_self_correction': metadata.get('metadata', {}).get('has_self_correction', False),
                'reasoning_depth': metadata.get('metadata', {}).get('reasoning_depth', 0),
                'nemotron_enabled': True,
                'kg_enabled': build_graph
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/graph-data', methods=['GET'])
def get_graph_data():
    """Get Nemotron knowledge graph data for visualization"""
    try:
        if not nemotron_service:
            return jsonify({'error': 'Nemotron service not initialized'}), 500
        
        # Get the latest session
        sessions = nemotron_service.get_all_sessions()
        if not sessions:
            return jsonify({'nodes': [], 'links': []})
        
        # Get graph for the latest session
        latest_session_id = sessions[0]['session_id']
        graph_data = nemotron_service.get_session_graph(latest_session_id)
        
        # Transform the data for 3d-force-graph format
        nodes = []
        links = []
        
        for node in graph_data['nodes']:
            nodes.append({
                'id': node['id'],
                'name': node.get('label', ''),
                'label': node.get('label', ''),
                'type': node['type'],
                'val': node.get('val', 10),
                'level': node.get('level', 0),
                'confidence': node.get('confidence'),
                'color': get_node_color(node['type'])
            })
        
        for link in graph_data['links']:
            links.append({
                'source': link['source'],
                'target': link['target'],
                'type': link['type'],
                'value': 1.0
            })
        
        return jsonify({
            'nodes': nodes,
            'links': links,
            'session_id': latest_session_id
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    """Get all Nemotron reasoning sessions"""
    try:
        if not nemotron_service:
            return jsonify({'error': 'Nemotron service not initialized'}), 500
        
        sessions = nemotron_service.get_all_sessions()
        return jsonify({'sessions': sessions})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/session/<session_id>', methods=['GET'])
def get_session_details(session_id):
    """Get graph data for a specific Nemotron session"""
    try:
        if not nemotron_service:
            return jsonify({'error': 'Nemotron service not initialized'}), 500
        
        graph_data = nemotron_service.get_session_graph(session_id)
        return jsonify(graph_data)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/clear-database', methods=['DELETE'])
def clear_database():
    """Clear all data from the Neo4j knowledge graph"""
    try:
        if not nemotron_service:
            return jsonify({'error': 'Nemotron service not initialized'}), 500

        if not nemotron_service.kg_builder:
            return jsonify({'error': 'Knowledge graph builder not available'}), 500

        with nemotron_service.kg_builder.driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")

        return jsonify({'success': True, 'message': 'Database cleared successfully'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/patterns', methods=['GET'])
def get_patterns():
    """Get pattern statistics from the knowledge graph"""
    try:
        if not nemotron_service:
            return jsonify({'error': 'Nemotron service not initialized'}), 500

        if not nemotron_service.kg_builder:
            return jsonify({'error': 'Knowledge graph builder not available'}), 500

        with nemotron_service.kg_builder.driver.session() as session:
            # Get relationship type counts
            rel_result = session.run(
                "MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count ORDER BY count DESC"
            )
            relationship_types = [{'type': record['type'], 'count': record['count']} for record in rel_result]

            # Get node label counts
            node_result = session.run(
                "MATCH (n) UNWIND labels(n) AS label RETURN label, count(*) AS count ORDER BY count DESC"
            )
            node_types = [{'type': record['label'], 'count': record['count']} for record in node_result]

        return jsonify({
            'success': True,
            'patterns': {
                'relationship_types': relationship_types,
                'node_types': node_types,
                'total_relationships': sum(r['count'] for r in relationship_types),
                'total_nodes': sum(n['count'] for n in node_types)
            }
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


def get_node_color(node_type):
    """Get color for different Nemotron node types"""
    color_map = {
        # Nemotron node types
        'Query': '#4A90E2',                    # Blue
        'Answer': '#E74C3C',                   # Red
        'Verification': '#FFD700',             # Gold
        'Decision': '#FF8C00',                 # Orange
        'Execution': '#4169E1',                # Royal Blue
        'Problemunderstanding': '#50C878',     # Green
        'Problem_Understanding': '#50C878',    # Green (alt)
        'Decomposition': '#20B2AA',            # Teal
        'Conclusion': '#9B59B6',               # Purple
        'ReasoningStep': '#357ABD',            # Light Blue
        # Legacy types
        'Session': '#4A90E2',
        'Thought': '#357ABD', 
        'Entity': '#50C878',
        'Tool': '#FF6B6B',
        'unknown': '#888888'
    }
    return color_map.get(node_type, '#888888')

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Initialize Nemotron service
    print("="*80)
    print("Starting Thinking Graph with Nemotron Reasoning")
    print("="*80)
    init_nemotron_service()
    
    # Get port from environment variable or default to 8000
    port = int(os.environ.get('BACKEND_PORT', os.environ.get('PORT', 8000)))
    
    # Use Waitress production server
    try:
        from waitress import serve
        print(f"\n🚀 Nemotron Reasoning Server")
        print(f" * Model: Llama-3.3-Nemotron-Super-49B")
        print(f" * Running on http://127.0.0.1:{port}")
        print(f" * Health: http://127.0.0.1:{port}/health")
        print(f" * Graph: http://127.0.0.1:{port}/api/graph-data")
        print("="*80 + "\n")
        serve(app, host='0.0.0.0', port=port)
    except ImportError:
        print("Waitress not installed, falling back to Flask dev server")
        app.run(debug=False, host='0.0.0.0', port=port)