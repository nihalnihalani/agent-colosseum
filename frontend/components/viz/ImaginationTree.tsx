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

function brighten(hex: string, t: number): string {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color('#ffffff'), t);
  return `#${c.getHexString()}`;
}

export default function ImaginationTree({
  predictions,
  phase,
  agentColor,
  agentName,
}: ImaginationTreeProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const graphRef      = useRef<any>(null);
  const animFrameRef  = useRef<number>(0);
  const lightAnimRef  = useRef<number>(0);
  const rotationRef   = useRef<number>(0);
  const initRef       = useRef(false);
  const spriteTextRef = useRef<any>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  const agentColorRef = useRef(agentColor);
  agentColorRef.current = agentColor;

  const linkColorRef = useRef(brighten(agentColor, 0.45));
  linkColorRef.current = brighten(agentColor, 0.45);

  // ── Graph data builder ────────────────────────────────────────────────────
  const buildGraphData = useCallback(
    (count: number, currentPhase: string) => {
      const nodes: GraphNode[] = [{
        id: 'root', label: agentName,
        color: agentColor, isRoot: true,
      }];
      const links: GraphLink[] = [];

      if (currentPhase === 'waiting' || count === 0) return { nodes, links };

      predictions.slice(0, count).forEach((pred, i) => {
        const id = `pred-${i}`;
        let nodeColor = agentColor;
        let conf = pred.confidence;

        if (currentPhase === 'revealed') {
          if (pred.wasCorrect === true)  { nodeColor = '#ffd700'; conf = 1.0; }
          else if (pred.wasCorrect === false) { conf = 0.3; }
        }

        nodes.push({
          id, label: `${pred.opponentMove}\n${Math.round(pred.confidence * 100)}%`,
          color: nodeColor, isRoot: false, confidence: conf, wasCorrect: pred.wasCorrect,
        });
        links.push({
          source: 'root', target: id,
          color: currentPhase === 'revealed' && pred.wasCorrect === true
            ? '#ffd700' : linkColorRef.current,
          width: 2 + pred.confidence * 6,
        });
      });
      return { nodes, links };
    },
    [predictions, agentColor, agentName]
  );

  // ── Incremental reveal — 1200 ms per node ────────────────────────────────
  useEffect(() => {
    if (phase === 'thinking') {
      setVisibleCount(0);
      let n = 0;
      const iv = setInterval(() => {
        n++;
        setVisibleCount(n);
        if (n >= predictions.length) clearInterval(iv);
      }, 1200);
      return () => clearInterval(iv);
    }
    setVisibleCount(phase === 'waiting' ? 0 : predictions.length);
  }, [phase, predictions.length]);

  // ── One-time graph initialisation ────────────────────────────────────────
  useEffect(() => {
    if (initRef.current) return;
    let cancelled = false;

    (async () => {
      const { default: ForceGraph3D } = await import('3d-force-graph');
      const { default: SpriteText }   = await import('three-spritetext');
      if (cancelled || !containerRef.current) return;

      spriteTextRef.current = SpriteText;
      initRef.current = true;

      const graph = (ForceGraph3D as any)()(containerRef.current)
        .backgroundColor('rgba(0,0,0,0)')
        .showNavInfo(false)
        .enableNodeDrag(false)
        .graphData({ nodes: [{ id: 'root', label: agentName, color: agentColor, isRoot: true }], links: [] })
        .nodeId('id')
        .linkSource('source')
        .linkTarget('target')

        // ── LINKS — dense slow particles create a "bead chain" look ───────
        .linkWidth(0.8)
        .linkOpacity(0.15)
        .linkColor((l: any) => l.color ?? linkColorRef.current)
        .linkCurvature(0.2)
        .linkCurveRotation(Math.PI / 4)
        .linkDirectionalParticles(22)
        .linkDirectionalParticleSpeed(0.003)
        .linkDirectionalParticleWidth((l: any) => 3 + (l.width ?? 2) * 0.45)
        .linkDirectionalParticleColor((l: any) => l.color ?? linkColorRef.current)

        // ── NODES — MeshLambertMaterial (reference project style) ─────────
        .nodeThreeObject((node: any) => {
          const isRoot  = node.isRoot;
          const radius  = isRoot ? 9 : 6;
          const color   = new THREE.Color(node.color ?? agentColorRef.current);
          const opacity = isRoot ? 1.0 : Math.max(0.5, node.confidence ?? 0.6);

          const group = new THREE.Group();

          // Core sphere
          group.add(new THREE.Mesh(
            new THREE.SphereGeometry(radius, 32, 32),
            new THREE.MeshLambertMaterial({
              color,
              emissive: color,
              emissiveIntensity: isRoot ? 0.5 : 0.3,
              transparent: true,
              opacity,
            })
          ));

          // Outer glow (1.3×)
          group.add(new THREE.Mesh(
            new THREE.SphereGeometry(radius * 1.3, 16, 16),
            new THREE.MeshBasicMaterial({
              color, transparent: true,
              opacity: isRoot ? 0.10 : 0.05,
            })
          ));

          // Label above node
          const ST = spriteTextRef.current;
          if (ST) {
            const s = new ST(node.label ?? '');
            s.color = '#ffffff';
            s.fontWeight = 'bold';
            s.textHeight  = isRoot ? 3.0 : 2.4;
            s.backgroundColor = 'rgba(0,0,0,0.65)';
            s.padding     = 2.5;
            s.borderRadius = 3;
            s.position.y  = radius + 2;
            group.add(s);
          }
          return group;
        });

      // ── Force layout — spread nodes like the reference project ────────────
      graph.d3Force('charge')?.strength(-280);
      graph.d3Force('link')?.distance(90);
      graph.d3Force('center')?.strength(2);

      // ── Animated 3-point lighting rig (from reference) ────────────────────
      const scene = graph.scene();
      if (scene) {
        scene.children = scene.children.filter((c: any) => !(c instanceof THREE.Light));

        scene.add(new THREE.AmbientLight(0x404040, 0.5));

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(100, 100, 100);
        scene.add(dirLight);

        const agentHex = new THREE.Color(agentColor).getHex();
        const pLight1 = new THREE.PointLight(agentHex, 1.2, 400);
        pLight1.position.set(50, 50, 50);
        scene.add(pLight1);

        const pLight2 = new THREE.PointLight(0xffffff, 0.6, 250);
        pLight2.position.set(-50, -50, -50);
        scene.add(pLight2);

        const pLight3 = new THREE.PointLight(0x4ecdc4, 0.4, 200);
        pLight3.position.set(0, 100, -100);
        scene.add(pLight3);

        const animateLights = () => {
          if (cancelled) return;
          const t = Date.now() * 0.001;
          pLight1.intensity = 1.0 + Math.sin(t * 0.7) * 0.3;
          pLight2.intensity = 0.5 + Math.cos(t * 0.5) * 0.15;
          pLight3.intensity = 0.3 + Math.sin(t * 0.3) * 0.1;
          pLight1.position.x = Math.cos(t * 0.22) * 90;
          pLight1.position.z = Math.sin(t * 0.22) * 90;
          pLight2.position.x = Math.cos(t * 0.3 + Math.PI) * 70;
          pLight2.position.z = Math.sin(t * 0.3 + Math.PI) * 70;
          lightAnimRef.current = requestAnimationFrame(animateLights);
        };
        animateLights();
      }

      // Camera at z=130, gentle orbit at r=120
      graph.cameraPosition({ x: 0, y: 35, z: 130 });
      graphRef.current = graph;

      // Auto-fit once on physics settle
      let fitted = false;
      graph.onEngineStop(() => {
        if (!fitted) {
          fitted = true;
          graphRef.current?.zoomToFit(700, 28);
        }
      });

      // Very slow orbit for 3D depth feel
      const orbit = () => {
        if (cancelled || !graphRef.current) return;
        rotationRef.current += 0.001;
        graphRef.current.cameraPosition({
          x: 120 * Math.sin(rotationRef.current),
          y: 35,
          z: 120 * Math.cos(rotationRef.current),
        });
        animFrameRef.current = requestAnimationFrame(orbit);
      };
      orbit();
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      cancelAnimationFrame(lightAnimRef.current);
      graphRef.current?.renderer?.()?.dispose();
      graphRef.current?._destructor?.();
      graphRef.current = null;
      initRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update graph when data/phase changes ─────────────────────────────────
  useEffect(() => {
    if (!graphRef.current) return;
    const data = buildGraphData(visibleCount, phase);
    graphRef.current.graphData(data);
    graphRef.current.nodeThreeObject(graphRef.current.nodeThreeObject());
    // No zoomToFit here — handled once by onEngineStop
  }, [visibleCount, phase, buildGraphData]);

  // ── Resize observer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      if (graphRef.current) {
        const { width, height } = entries[0].contentRect;
        graphRef.current.width(width).height(height);
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }} />
  );
}
