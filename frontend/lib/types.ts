export type GameType = 'resource_wars' | 'negotiation' | 'auction';

export interface GameState {
  resources: { A: number; B: number; C: number };
  scores: { red: number; blue: number };
}

export interface NegotiationGameState {
  scores: { red: number; blue: number };
  currentOffer: number | null;
  offerBy: string | null;
  dealPrice: number | null;
  dealRound: number | null;
  bluffsUsed: { red: number; blue: number };
}

export interface AuctionItem {
  name: string;
  baseValue: number;
}

export interface AuctionWonItem {
  name: string;
  bid: number;
  paid: number;
  valuation: number;
}

export interface AuctionGameState {
  scores: { red: number; blue: number };
  credits: { red: number; blue: number };
  totalSpent: { red: number; blue: number };
  currentItem: AuctionItem | null;
  itemsRemaining: number;
  wonItems: { red: AuctionWonItem[]; blue: AuctionWonItem[] };
  bluffsUsed: { red: number; blue: number };
}

export interface Prediction {
  opponentMove: string;
  confidence: number;
  counter: string;
  reasoning: string;
  wasCorrect?: boolean;
}

export interface Move {
  type: string;
  target: string;
  amount: number;
}

export interface AgentConfig {
  personality: 'aggressive' | 'defensive' | 'adaptive' | 'chaotic';
}

export type MatchPhase =
  | 'lobby'
  | 'thinking'
  | 'committed'
  | 'revealed'
  | 'round_end'
  | 'match_end';

export interface CollapseResult {
  redCorrect: boolean[];
  blueCorrect: boolean[];
  resolution: {
    winner: string;
    resourceChanges: Record<string, Record<string, number>>;
  };
}

export interface MatchState {
  matchId: string;
  gameType: GameType;
  agents: { red: AgentConfig; blue: AgentConfig };
  totalRounds: number;
  currentRound: number;
  gameState: GameState;
  negotiationState?: NegotiationGameState;
  auctionState?: AuctionGameState;
  phase: MatchPhase;
  redPredictions: Prediction[];
  bluePredictions: Prediction[];
  redMove?: Move;
  blueMove?: Move;
  accuracy: { red: number; blue: number };
  totalFuturesSimulated: number;
  winner?: string;
}

export interface MatchConfig {
  gameType: GameType;
  redPersonality: AgentConfig['personality'];
  bluePersonality: AgentConfig['personality'];
  totalRounds: number;
}

// Audience poll types
export interface AudienceVote {
  round: number;
  votedFor: 'red' | 'blue';
  wasCorrect?: boolean;
}

export interface AudiencePollState {
  currentVote: 'red' | 'blue' | null;
  votes: AudienceVote[];
  totalCorrect: number;
  totalVoted: number;
}

// Match history types
export interface MatchSummary {
  matchId: string;
  gameType: GameType;
  winner?: string;
  finalScores?: { red: number; blue: number };
  predictionAccuracy?: { red: number; blue: number };
  totalRounds?: number;
  redPersonality: string;
  bluePersonality: string;
  createdAt?: string;
  state?: string;
}

// Replay types
export interface ReplayEvent {
  type: string;
  timestamp: number;
  [key: string]: unknown;
}

// WebSocket event types
export type WSEventType =
  | 'match_start'
  | 'round_start'
  | 'thinking_start'
  | 'prediction'
  | 'thinking_end'
  | 'collapse'
  | 'round_end'
  | 'match_end'
  | 'ping';

export interface WSEvent {
  type: WSEventType;
  [key: string]: unknown;
}

export interface MatchStartEvent {
  type: 'match_start';
  matchId: string;
  gameType: string;
  agents: { red: AgentConfig; blue: AgentConfig };
  totalRounds: number;
}

export interface RoundStartEvent {
  type: 'round_start';
  round: number;
  gameState: GameState;
}

export interface ThinkingStartEvent {
  type: 'thinking_start';
  agent: 'red' | 'blue';
}

export interface PredictionEvent {
  type: 'prediction';
  agent: 'red' | 'blue';
  branchIndex: number;
  prediction: Prediction;
}

export interface ThinkingEndEvent {
  type: 'thinking_end';
  agent: 'red' | 'blue';
  predictions: Prediction[];
  chosenMove: Move;
}

export interface CollapseEvent {
  type: 'collapse';
  redPredictions: Prediction[];
  bluePredictions: Prediction[];
  resolution: CollapseResult['resolution'];
}

export interface RoundEndEvent {
  type: 'round_end';
  round: number;
  scores: { red: number; blue: number };
  accuracy: { red: number; blue: number };
  gameState: GameState;
}

export interface MatchEndEvent {
  type: 'match_end';
  winner: string;
  finalScores: { red: number; blue: number };
  totalFuturesSimulated: number;
  predictionAccuracy: { red: number; blue: number };
}
