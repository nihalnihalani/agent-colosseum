'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';

interface Prediction {
  opponentMove: string;
  confidence: number;
  counter: string;
  reasoning: string;
  wasCorrect?: boolean;
}

interface ImaginationTreeProps {
  predictions: Prediction[];
  phase: 'waiting' | 'thinking' | 'committed' | 'revealed';
  agentColor: string;
  agentName: string;
}

interface GraphNode {
  id: string;
  label: string;
  color: string;
  isRoot: boolean;
  confidence?: number;
  wasCorrect?: boolean;
  x?: number;
  y?: number;
  z?: number;
}

interface GraphLink {
  source: string;
  target: string;
  color: string;
  width: number;
}

export default function ImaginationTree({
  predictions,
  phase,
  agentColor,
  agentName,
}: ImaginationTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const rotationRef = useRef<number>(0);
  const initRef = useRef(false);
  const spriteTextRef = useRef<any>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  // Stable refs for values used inside the graph's nodeThreeObject callback
  const agentColorRef = useRef(agentColor);
  agentColorRef.current = agentColor;

  // Build graph data from predictions
  const buildGraphData = useCallback(
    (count: number, currentPhase: string) => {
      const nodes: GraphNode[] = [
        {
          id: 'root',
          label: agentName,
          color: agentColor,
          isRoot: true,
        },
      ];
      const links: GraphLink[] = [];

      if (currentPhase === 'waiting' || count === 0) {
        return { nodes, links };
      }

      const visible = predictions.slice(0, count);
      visible.forEach((pred, i) => {
        const nodeId = `pred-${i}`;
        const isCorrect = pred.wasCorrect;
        let nodeColor = agentColor;
        let nodeConfidence = pred.confidence;

        if (currentPhase === 'revealed') {
          if (isCorrect === true) {
            nodeColor = '#ffd700';
            nodeConfidence = 1.0;
          } else if (isCorrect === false) {
            nodeConfidence = 0.1;
          }
        }

        nodes.push({
          id: nodeId,
          label: `${pred.opponentMove}\n${Math.round(pred.confidence * 100)}%`,
          color: nodeColor,
          isRoot: false,
          confidence: nodeConfidence,
          wasCorrect: isCorrect,
        });

        links.push({
          source: 'root',
          target: nodeId,
          color: nodeColor,
          width: pred.confidence * 3,
        });
      });

      return { nodes, links };
    },
    [predictions, agentColor, agentName]
  );

  // Incrementally show nodes during thinking phase
  useEffect(() => {
    if (phase === 'thinking') {
      setVisibleCount(0);
      let count = 0;
      const interval = setInterval(() => {
        count++;
        setVisibleCount(count);
        if (count >= predictions.length) {
          clearInterval(interval);
        }
      }, 300);
      return () => clearInterval(interval);
    } else if (phase === 'waiting') {
      setVisibleCount(0);
    } else {
      setVisibleCount(predictions.length);
    }
  }, [phase, predictions.length]);

  // Initialize graph ONCE
  useEffect(() => {
    if (initRef.current) return;
    let cancelled = false;

    (async () => {
      const ForceGraph3DModule = await import('3d-force-graph');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ForceGraph3D = ForceGraph3DModule.default as any;
      const SpriteTextModule = await import('three-spritetext');
      const SpriteText = SpriteTextModule.default;

      if (cancelled || !containerRef.current) return;

      spriteTextRef.current = SpriteText;
      initRef.current = true;

      const initialData = {
        nodes: [
          {
            id: 'root',
            label: agentName,
            color: agentColor,
            isRoot: true,
          },
        ],
        links: [] as GraphLink[],
      };

      const graph = ForceGraph3D()(containerRef.current)
        .backgroundColor('rgba(0,0,0,0)')
        .showNavInfo(false)
        .enableNodeDrag(false)
        .graphData(initialData)
        .nodeId('id')
        .linkSource('source')
        .linkTarget('target')
        .linkWidth((link: any) => link.width || 1)
        .linkColor((link: any) => link.color || agentColorRef.current)
        .linkDirectionalParticles(3)
        .linkDirectionalParticleSpeed(0.005)
        .linkDirectionalParticleWidth(2)
        .linkDirectionalParticleColor(
          (link: any) => link.color || agentColorRef.current
        )
        .nodeThreeObject((node: any) => {
          const group = new THREE.Group();

          const isRoot = node.isRoot;
          const radius = isRoot ? 8 : 5;
          const color = new THREE.Color(
            node.color || agentColorRef.current
          );
          const opacity = isRoot
            ? 1.0
            : node.confidence != null
              ? node.confidence
              : 0.5;

          // Core sphere
          const geometry = new THREE.SphereGeometry(radius, 32, 32);
          const material = new THREE.MeshPhongMaterial({
            color,
            emissive: color,
            emissiveIntensity: isRoot ? 0.4 : 0.2,
            transparent: true,
            opacity,
          });
          group.add(new THREE.Mesh(geometry, material));

          // Glow effect
          const glowGeo = new THREE.SphereGeometry(radius * 1.5, 16, 16);
          const glowMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.1,
          });
          group.add(new THREE.Mesh(glowGeo, glowMat));

          // Label
          const ST = spriteTextRef.current;
          if (ST) {
            const sprite = new ST(node.label || '');
            sprite.color = '#ffffff';
            sprite.textHeight = 2.5;
            sprite.position.y = radius + 4;
            group.add(sprite);
          }

          return group;
        });

      // Force configuration
      graph.d3Force('charge')?.strength(-150);
      graph.d3Force('link')?.distance(60);
      graph.d3Force('center')?.strength(1);

      // Camera position
      graph.cameraPosition({ x: 0, y: 0, z: 200 });

      graphRef.current = graph;

      // Auto-orbit camera
      const animate = () => {
        if (cancelled || !graphRef.current) return;
        rotationRef.current += 0.002;
        const distance = 200;
        graphRef.current.cameraPosition({
          x: distance * Math.sin(rotationRef.current),
          y: 30,
          z: distance * Math.cos(rotationRef.current),
        });
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
    })();

    return () => {
      cancelled = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (graphRef.current) {
        const renderer = graphRef.current.renderer?.();
        if (renderer) renderer.dispose();
        graphRef.current._destructor?.();
        graphRef.current = null;
      }
      initRef.current = false;
    };
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update graph data when phase or visible count changes
  useEffect(() => {
    if (!graphRef.current) return;
    const data = buildGraphData(visibleCount, phase);
    graphRef.current.graphData(data);
    // Force nodeThreeObject refresh to pick up color/opacity changes
    graphRef.current.nodeThreeObject(graphRef.current.nodeThreeObject());
  }, [visibleCount, phase, buildGraphData]);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (graphRef.current) {
          graphRef.current.width(entry.contentRect.width);
          graphRef.current.height(entry.contentRect.height);
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    />
  );
}
