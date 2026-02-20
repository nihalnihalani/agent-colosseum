'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  MatchState,
  MatchConfig,
  MatchPhase,
  Prediction,
  GameState,
  GameType,
  NegotiationGameState,
  AuctionGameState,
  GPUBiddingGameState,
  WSEvent,
} from '@/lib/types';

const MOCK_PERSONALITIES = ['aggressive', 'defensive', 'adaptive', 'chaotic'] as const;
const MOCK_MOVES = [
  'aggressive_bid_A',
  'defensive_spread',
  'bluff_B',
  'counter_C',
  'retreat',
  'fortify_A',
  'flank_B',
  'economy_boost',
];

function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMockPredictions(): Prediction[] {
  const count = 3;
  const predictions: Prediction[] = [];
  let remaining = 1.0;
  for (let i = 0; i < count; i++) {
    const confidence =
      i < count - 1
        ? parseFloat((Math.random() * remaining * 0.8).toFixed(2))
        : parseFloat(remaining.toFixed(2));
    remaining -= confidence;
    predictions.push({
      opponentMove: randomPick(MOCK_MOVES),
      confidence,
      counter: randomPick(MOCK_MOVES),
      reasoning: `Based on opponent history, this move has ${Math.round(confidence * 100)}% likelihood.`,
    });
  }
  return predictions.sort((a, b) => b.confidence - a.confidence);
}

const initialMatchState: MatchState = {
  matchId: '',
  gameType: 'resource_wars',
  agents: {
    red: { personality: 'aggressive' },
    blue: { personality: 'defensive' },
  },
  totalRounds: 10,
  currentRound: 0,
  gameState: {
    resources: { A: 100, B: 100, C: 100 },
    scores: { red: 0, blue: 0 },
  },
  phase: 'lobby',
  redPredictions: [],
  bluePredictions: [],
  accuracy: { red: 0, blue: 0 },
  totalFuturesSimulated: 0,
};

const MOCK_NEGOTIATION_MOVES = ['propose', 'counter_offer', 'accept', 'reject', 'bluff_walkaway'];
const MOCK_AUCTION_ITEMS = [
  'Alpha Core', 'Beta Shield', 'Gamma Drive', 'Delta Array',
  'Epsilon Node', 'Zeta Link', 'Eta Pulse', 'Theta Grid',
];

export function useMatchWebSocket(matchId: string | null) {
  const [matchState, setMatchState] = useState<MatchState>(initialMatchState);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingConfigRef = useRef<MatchConfig | null>(null);
  const handleEventRef = useRef<((event: WSEvent) => void) | null>(null);
  const isMock = process.env.NEXT_PUBLIC_MOCK_WS === 'true';

  const handleEvent = useCallback((event: WSEvent) => {
    switch (event.type) {
      case 'match_start':
        setMatchState((prev) => ({
          ...prev,
          matchId: event.matchId as string,
          gameType: (event.gameType as GameType) || 'resource_wars',
          agents: event.agents as MatchState['agents'],
          totalRounds: event.totalRounds as number,
          phase: 'lobby' as MatchPhase,
          currentRound: 0,
        }));
        break;

      case 'round_start': {
        const roundGameState = event.gameState as GameState;
        const updates: Partial<MatchState> = {
          currentRound: event.round as number,
          gameState: roundGameState,
          phase: 'thinking' as MatchPhase,
          redPredictions: [],
          bluePredictions: [],
          redMove: undefined,
          blueMove: undefined,
        };
        if (event.negotiationState) {
          updates.negotiationState = event.negotiationState as NegotiationGameState;
        }
        if (event.auctionState) {
          updates.auctionState = event.auctionState as AuctionGameState;
        }
        if (event.gpuBiddingState) {
          updates.gpuBiddingState = event.gpuBiddingState as GPUBiddingGameState;
        }
        setMatchState((prev) => ({ ...prev, ...updates }));
        break;
      }

      case 'thinking_start':
        setMatchState((prev) => ({
          ...prev,
          phase: 'thinking' as MatchPhase,
        }));
        break;

      case 'prediction': {
        const agent = event.agent as 'red' | 'blue';
        const prediction = event.prediction as Prediction;
        setMatchState((prev) => {
          const key = agent === 'red' ? 'redPredictions' : 'bluePredictions';
          return {
            ...prev,
            [key]: [...prev[key], prediction],
            totalFuturesSimulated: prev.totalFuturesSimulated + 1,
          };
        });
        break;
      }

      case 'thinking_end': {
        const agentEnd = event.agent as 'red' | 'blue';
        const predKey =
          agentEnd === 'red' ? 'redPredictions' : 'bluePredictions';
        const moveKey = agentEnd === 'red' ? 'redMove' : 'blueMove';
        setMatchState((prev) => ({
          ...prev,
          [predKey]: event.predictions as Prediction[],
          [moveKey]: event.chosenMove,
          phase: 'committed' as MatchPhase,
        }));
        break;
      }

      case 'collapse':
        setMatchState((prev) => ({
          ...prev,
          redPredictions: event.redPredictions as Prediction[],
          bluePredictions: event.bluePredictions as Prediction[],
          phase: 'revealed' as MatchPhase,
        }));
        break;

      case 'round_end': {
        const endUpdates: Partial<MatchState> = {
          gameState: {
            ...(event.gameState as GameState) || { resources: { A: 0, B: 0, C: 0 }, scores: event.scores as GameState['scores'] },
          },
          accuracy: event.accuracy as MatchState['accuracy'],
          phase: 'round_end' as MatchPhase,
        };
        if (event.negotiationState) {
          endUpdates.negotiationState = event.negotiationState as NegotiationGameState;
        }
        if (event.auctionState) {
          endUpdates.auctionState = event.auctionState as AuctionGameState;
        }
        if (event.gpuBiddingState) {
          endUpdates.gpuBiddingState = event.gpuBiddingState as GPUBiddingGameState;
        }
        setMatchState((prev) => ({
          ...prev,
          ...endUpdates,
          gameState: {
            ...prev.gameState,
            scores: event.scores as GameState['scores'],
          },
        }));
        break;
      }

      case 'match_end':
        setMatchState((prev) => ({
          ...prev,
          winner: event.winner as string,
          gameState: {
            ...prev.gameState,
            scores: event.finalScores as GameState['scores'],
          },
          accuracy: event.predictionAccuracy as MatchState['accuracy'],
          totalFuturesSimulated: event.totalFuturesSimulated as number,
          phase: 'match_end' as MatchPhase,
        }));
        break;
    }
  }, []);

  // Keep the ref updated with latest handleEvent
  handleEventRef.current = handleEvent;

  // Mock simulation
  const runMockMatch = useCallback(
    (config: MatchConfig) => {
      const totalRounds = config.totalRounds;
      const gameType = config.gameType as GameType;
      let round = 0;
      const scores = { red: 0, blue: 0 };
      const correctCounts = { red: 0, blue: 0 };
      let totalPredictions = 0;
      let totalFutures = 0;

      // Game-specific mock state
      let mockNegState: NegotiationGameState = {
        scores: { red: 0, blue: 0 },
        currentOffer: null,
        offerBy: null,
        dealPrice: null,
        dealRound: null,
        bluffsUsed: { red: 0, blue: 0 },
      };
      let mockAucState: AuctionGameState = {
        scores: { red: 0, blue: 0 },
        credits: { red: 1000, blue: 1000 },
        totalSpent: { red: 0, blue: 0 },
        currentItem: null,
        itemsRemaining: 8,
        wonItems: { red: [], blue: [] },
        bluffsUsed: { red: 0, blue: 0 },
      };

      handleEvent({
        type: 'match_start',
        matchId: `mock-${Date.now()}`,
        gameType: config.gameType,
        agents: {
          red: { personality: config.redPersonality },
          blue: { personality: config.bluePersonality },
        },
        totalRounds,
      });

      const runRound = () => {
        round++;
        if (round > totalRounds) {
          const redAcc =
            totalPredictions > 0
              ? correctCounts.red / (totalPredictions / 2)
              : 0;
          const blueAcc =
            totalPredictions > 0
              ? correctCounts.blue / (totalPredictions / 2)
              : 0;
          handleEvent({
            type: 'match_end',
            winner: scores.red > scores.blue ? 'red' : 'blue',
            finalScores: { ...scores },
            totalFuturesSimulated: totalFutures,
            predictionAccuracy: {
              red: parseFloat(redAcc.toFixed(2)),
              blue: parseFloat(blueAcc.toFixed(2)),
            },
          });
          return;
        }

        const resources = {
          A: 100 - round * 3,
          B: 100 - round * 2,
          C: 100 - round * 1,
        };

        // Build round_start event with game-specific state
        const roundStartEvent: WSEvent & Record<string, unknown> = {
          type: 'round_start',
          round,
          gameState: { resources, scores: { ...scores } },
        };

        if (gameType === 'negotiation') {
          roundStartEvent.negotiationState = { ...mockNegState };
        } else if (gameType === 'auction') {
          const itemIdx = round - 1;
          const itemName = MOCK_AUCTION_ITEMS[itemIdx] || `Item ${round}`;
          mockAucState.currentItem = { name: itemName, baseValue: 80 + Math.floor(Math.random() * 60) };
          mockAucState.itemsRemaining = Math.max(0, totalRounds - round);
          roundStartEvent.auctionState = { ...mockAucState, wonItems: { red: [...mockAucState.wonItems.red], blue: [...mockAucState.wonItems.blue] } };
        }

        handleEvent(roundStartEvent);

        // Thinking phase
        setTimeout(() => {
          handleEvent({ type: 'thinking_start', agent: 'red' });
          handleEvent({ type: 'thinking_start', agent: 'blue' });

          const redPreds = generateMockPredictions();
          const bluePreds = generateMockPredictions();
          totalFutures += redPreds.length + bluePreds.length;

          // Stream predictions
          let delay = 300;
          for (const [i, pred] of redPreds.entries()) {
            setTimeout(() => {
              handleEvent({
                type: 'prediction',
                agent: 'red',
                branchIndex: i,
                prediction: pred,
              });
            }, delay);
            delay += 400;
          }
          for (const [i, pred] of bluePreds.entries()) {
            setTimeout(() => {
              handleEvent({
                type: 'prediction',
                agent: 'blue',
                branchIndex: i,
                prediction: pred,
              });
            }, delay);
            delay += 400;
          }

          // Generate game-specific moves
          let redChosenMove = { type: redPreds[0].counter, target: 'A', amount: 40 };
          let blueChosenMove = { type: bluePreds[0].counter, target: 'B', amount: 35 };

          if (gameType === 'negotiation') {
            const rMove = randomPick(MOCK_NEGOTIATION_MOVES);
            const bMove = randomPick(MOCK_NEGOTIATION_MOVES);
            redChosenMove = { type: rMove, target: '', amount: rMove === 'propose' || rMove === 'counter_offer' ? Math.floor(Math.random() * 80) + 10 : 0 };
            blueChosenMove = { type: bMove, target: '', amount: bMove === 'propose' || bMove === 'counter_offer' ? Math.floor(Math.random() * 80) + 10 : 0 };
          } else if (gameType === 'auction') {
            const rBid = Math.floor(Math.random() * 200) + 20;
            const bBid = Math.floor(Math.random() * 200) + 20;
            redChosenMove = { type: 'bid', target: '', amount: Math.min(rBid, mockAucState.credits.red) };
            blueChosenMove = { type: Math.random() > 0.2 ? 'bid' : 'pass', target: '', amount: Math.min(bBid, mockAucState.credits.blue) };
          }

          // Thinking end
          setTimeout(() => {
            handleEvent({
              type: 'thinking_end',
              agent: 'red',
              predictions: redPreds,
              chosenMove: redChosenMove,
            });
            handleEvent({
              type: 'thinking_end',
              agent: 'blue',
              predictions: bluePreds,
              chosenMove: blueChosenMove,
            });

            // Collapse
            setTimeout(() => {
              const scoredRed = redPreds.map((p) => ({
                ...p,
                wasCorrect: Math.random() > 0.4,
              }));
              const scoredBlue = bluePreds.map((p) => ({
                ...p,
                wasCorrect: Math.random() > 0.5,
              }));

              totalPredictions += scoredRed.length + scoredBlue.length;
              correctCounts.red += scoredRed.filter(
                (p) => p.wasCorrect
              ).length;
              correctCounts.blue += scoredBlue.filter(
                (p) => p.wasCorrect
              ).length;

              handleEvent({
                type: 'collapse',
                redPredictions: scoredRed,
                bluePredictions: scoredBlue,
                resolution: {
                  winner: Math.random() > 0.5 ? 'red' : 'blue',
                  resourceChanges: {},
                },
              });

              // Round end
              setTimeout(() => {
                const roundWinner = Math.random() > 0.5 ? 'red' : 'blue';
                const points = Math.floor(Math.random() * 50) + 30;
                scores[roundWinner] += points;

                // Update game-specific state for mock
                if (gameType === 'negotiation') {
                  mockNegState = {
                    ...mockNegState,
                    scores: { ...scores },
                    currentOffer: redChosenMove.amount > 0 ? redChosenMove.amount : blueChosenMove.amount > 0 ? blueChosenMove.amount : mockNegState.currentOffer,
                    offerBy: redChosenMove.amount > 0 ? 'red' : blueChosenMove.amount > 0 ? 'blue' : mockNegState.offerBy,
                  };
                } else if (gameType === 'auction') {
                  const winner = roundWinner as 'red' | 'blue';
                  const bid = winner === 'red' ? redChosenMove.amount : blueChosenMove.amount;
                  mockAucState.credits[winner] -= Math.min(bid, mockAucState.credits[winner]);
                  mockAucState.totalSpent[winner] += Math.min(bid, mockAucState.credits[winner] + bid);
                  if (mockAucState.currentItem) {
                    mockAucState.wonItems[winner] = [
                      ...mockAucState.wonItems[winner],
                      { name: mockAucState.currentItem.name, bid, paid: bid, valuation: mockAucState.currentItem.baseValue + 20 },
                    ];
                  }
                  mockAucState.scores = { ...scores };
                }

                const redAcc =
                  totalPredictions > 0
                    ? correctCounts.red / (totalPredictions / 2)
                    : 0;
                const blueAcc =
                  totalPredictions > 0
                    ? correctCounts.blue / (totalPredictions / 2)
                    : 0;

                const roundEndEvent: WSEvent & Record<string, unknown> = {
                  type: 'round_end',
                  round,
                  scores: { ...scores },
                  accuracy: {
                    red: parseFloat(redAcc.toFixed(2)),
                    blue: parseFloat(blueAcc.toFixed(2)),
                  },
                  gameState: { resources, scores: { ...scores } },
                };

                if (gameType === 'negotiation') {
                  roundEndEvent.negotiationState = { ...mockNegState };
                } else if (gameType === 'auction') {
                  roundEndEvent.auctionState = { ...mockAucState, wonItems: { red: [...mockAucState.wonItems.red], blue: [...mockAucState.wonItems.blue] } };
                }

                handleEvent(roundEndEvent);

                // Next round
                mockTimerRef.current = setTimeout(runRound, 2000);
              }, 1500);
            }, 1000);
          }, delay + 500);
        }, 500);
      };

      mockTimerRef.current = setTimeout(runRound, 1000);
    },
    [handleEvent]
  );

  // Real WebSocket connection
  useEffect(() => {
    if (!matchId || isMock) return;

    const wsHost = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    const wsUrl = `${wsHost}/ws/match/${matchId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      // Drain any pending start_match that was queued before the connection opened
      if (pendingConfigRef.current) {
        const cfg = pendingConfigRef.current;
        pendingConfigRef.current = null;
        ws.send(JSON.stringify({
          type: 'start_match',
          gameType: cfg.gameType,
          redPersonality: cfg.redPersonality,
          bluePersonality: cfg.bluePersonality,
          rounds: cfg.totalRounds,
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSEvent;
        handleEventRef.current?.(data);
      } catch {
        console.error('Failed to parse WebSocket message');
      }
    };

    ws.onerror = () => {
      setError('WebSocket connection error');
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Don't auto-reconnect - user needs to refresh to get a new match
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [matchId, isMock]);

  const startMatch = useCallback(
    (config: MatchConfig) => {
      if (isMock) {
        setIsConnected(true);
        runMockMatch(config);
        return;
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'start_match',
            gameType: config.gameType,
            redPersonality: config.redPersonality,
            bluePersonality: config.bluePersonality,
            rounds: config.totalRounds,
          })
        );
      } else if (wsRef.current !== null) {
        // Socket is CONNECTING or CLOSING — queue to drain on open
        // Only the most-recent config is kept; earlier calls while CONNECTING are superseded.
        pendingConfigRef.current = config;
      } else {
        console.warn('[useMatchWebSocket] startMatch called but no WebSocket exists yet');
      }
    },
    [isMock, runMockMatch]
  );

  // Cleanup mock timers
  useEffect(() => {
    return () => {
      if (mockTimerRef.current) {
        clearTimeout(mockTimerRef.current);
      }
    };
  }, []);

  return { matchState, isConnected, startMatch, error };
}
