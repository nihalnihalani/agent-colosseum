// API service for communicating with the backend

export interface ChatResponse {
  success: boolean;
  session_id: string;
  thinking: string;
  answer: string;
  response: string;
  thoughts: string;
  message: string;
  reasoning_steps: number;
  graph_stats: Record<string, any>;
  metadata: {
    verification_count: number;
    has_self_correction: boolean;
    reasoning_depth: number;
    nemotron_enabled: boolean;
    kg_enabled: boolean;
  };
}

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  label: string;
  level: number;
  confidence: number;
  val: number;
  color: string;
}

export interface GraphLink {
  source: string;
  target: string;
  type: string;
  value: number;
}

export interface GraphData {
  nodes: Array<GraphNode>;
  links: Array<GraphLink>;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  nemotron_service: Record<string, any>;
  model: string;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }

  async healthCheck(): Promise<HealthCheckResponse> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  }

  async sendChatMessage(message: string, sessionId?: string): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        session_id: sessionId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getGraphData(): Promise<GraphData> {
    const response = await fetch(`${this.baseUrl}/api/graph-data`);
    if (!response.ok) {
      throw new Error(`Graph data request failed: ${response.statusText}`);
    }
    return response.json();
  }

  async clearDatabase(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/clear-database`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Clear database request failed: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getSessions(): Promise<{ sessions: any[] }> {
    const response = await fetch(`${this.baseUrl}/api/sessions`);
    if (!response.ok) {
      throw new Error(`Get sessions request failed: ${response.statusText}`);
    }
    return response.json();
  }

  async getSessionDetails(sessionId: string): Promise<{ session: any }> {
    const response = await fetch(`${this.baseUrl}/api/session/${sessionId}`);
    if (!response.ok) {
      throw new Error(`Get session details request failed: ${response.statusText}`);
    }
    return response.json();
  }

  async getPatterns(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/patterns`);
    if (!response.ok) {
      throw new Error(`Get patterns request failed: ${response.statusText}`);
    }
    return response.json();
  }
}

export const apiService = new ApiService();