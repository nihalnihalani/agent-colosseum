'use client';

import React, { useEffect, useRef, useState } from 'react';

// ── Strategy colour palette (matches arena agent colours) ──────────────────
const STRATEGY_COLORS: Record<string, string> = {
  aggressive: '#ef4444',
  defensive:  '#3b82f6',
  adaptive:   '#a855f7',
  chaotic:    '#f59e0b',
  balanced:   '#10b981',
  random:     '#ec4899',
};

function getStrategyColor(name: string): string {
  const lower = (name ?? '').toLowerCase();
  for (const [key, color] of Object.entries(STRATEGY_COLORS)) {
    if (lower.includes(key)) return color;
  }
  // hash-based fallback for unknown personalities
  const hue = Math.abs(
    (name ?? '').split('').reduce((a, c) => (a << 5) - a + c.charCodeAt(0), 0)
  ) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

// Log-scale so huge win-counts don't blow up the sphere radius
function getNodeRadius(wins: number): number {
  return Math.max(5, Math.min(18, 5 + Math.log1p(wins) * 3));
}

// ── Types ──────────────────────────────────────────────────────────────────
export interface GraphNode {
  id: string;
  name: string;
  val?: number;
  type?: string;
  wins?: number;
  losses?: number;
  win_rate?: number;
  total_matches?: number;
  x?: number;
  y?: number;
  z?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type?: string;
  wins?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface StrategyGraph3DProps {
  data: GraphData;
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
}

// ── Component ──────────────────────────────────────────────────────────────
export function StrategyGraph3D({
  data,
  onNodeClick,
  onNodeHover,
}: StrategyGraph3DProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const graphRef      = useRef<any>(null);
  const animFrameRef  = useRef<number>(0);
  const lightAnimRef  = useRef<number>(0);
  const rotationRef   = useRef<number>(0);
  const initRef       = useRef(false);

  const [isClient,     setIsClient]     = useState(false);
  const [isLoading,    setIsLoading]    = useState(true);
  const [hoveredNode,  setHoveredNode]  = useState<GraphNode | null>(null);

  useEffect(() => { setIsClient(true); }, []);

  // ── One-time 3D graph init ────────────────────────────────────────────────
  useEffect(() => {
    if (!isClient || !containerRef.current || initRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const { default: ForceGraph3D } = await import('3d-force-graph');
        const THREE = await import('three');
        const { default: SpriteText }   = await import('three-spritetext');

        if (cancelled || !containerRef.current) return;
        initRef.current = true;
        containerRef.current.innerHTML = '';

        const w = containerRef.current.clientWidth  || 600;
        const h = containerRef.current.clientHeight || 400;

        const Graph = (ForceGraph3D as any)()(containerRef.current)
          .backgroundColor('rgba(0,0,0,0)')
          .showNavInfo(false)
          .enableNodeDrag(false)
          .width(w)
          .height(h)
          .nodeId('id')
          .linkSource('source')
          .linkTarget('target')

          // ── Nodes ──────────────────────────────────────────────────────────
          .nodeThreeObject((node: any) => {
            const wins   = node.wins   ?? 0;
            const losses = node.losses ?? 0;
            const radius = getNodeRadius(wins);
            const hex    = getStrategyColor(node.name ?? '');
            const color  = new THREE.Color(hex);
            const group  = new THREE.Group();

            // Core sphere – MeshLambertMaterial reacts to point lights
            group.add(new THREE.Mesh(
              new THREE.SphereGeometry(radius, 32, 32),
              new THREE.MeshLambertMaterial({
                color,
                emissive:          color,
                emissiveIntensity: 0.4,
                transparent:       true,
                opacity:           0.92,
              })
            ));

            // Outer glow halo (back-face only so it wraps around)
            group.add(new THREE.Mesh(
              new THREE.SphereGeometry(radius * 1.45, 16, 16),
              new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity:     0.07,
                side:        THREE.BackSide,
              })
            ));

            // Name label (above)
            const nameSprite = new SpriteText(node.name ?? '');
            nameSprite.color           = '#ffffff';
            nameSprite.fontWeight      = 'bold';
            nameSprite.textHeight      = 3.2;
            nameSprite.backgroundColor = 'rgba(0,0,0,0.65)';
            nameSprite.padding         = 2.5;
            nameSprite.borderRadius    = 4;
            nameSprite.position.y      = radius + 3.5;
            group.add(nameSprite);

            // Win/Loss counter (below)
            if (wins + losses > 0) {
              const wr  = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(0) : '?';
              const sub = new SpriteText(`${wins}W · ${losses}L · ${wr}%`);
              sub.color           = hex;
              sub.fontWeight      = 'bold';
              sub.textHeight      = 2.0;
              sub.backgroundColor = 'rgba(0,0,0,0.55)';
              sub.padding         = 2;
              sub.borderRadius    = 3;
              sub.position.y      = -(radius + 3.5);
              group.add(sub);
            }

            return group;
          })

          // ── Links ──────────────────────────────────────────────────────────
          .linkColor((l: any)    => l.type === 'BEATS' ? '#ff6b6b' : '#22d3ee')
          .linkWidth(0.7)
          .linkOpacity(0.25)
          .linkCurvature(0.35)
          .linkCurveRotation(Math.PI / 5)
          // Only BEATS edges carry flowing particles (shows win direction)
          .linkDirectionalParticles((l: any)      => l.type === 'BEATS' ? 22 : 8)
          .linkDirectionalParticleSpeed(0.004)
          .linkDirectionalParticleWidth((l: any)  => 2 + Math.log1p(l.wins ?? 1) * 0.6)
          .linkDirectionalParticleColor((l: any)  => l.type === 'BEATS' ? '#ff6b6b' : '#22d3ee')

          .onNodeClick((node: any) => {
            const dist = 80;
            const mag  = Math.hypot(node.x ?? 1, node.y ?? 1, node.z ?? 1);
            const r    = 1 + dist / Math.max(mag, 1);
            Graph.cameraPosition(
              { x: (node.x ?? 0) * r, y: (node.y ?? 0) * r, z: (node.z ?? 0) * r },
              node,
              2000,
            );
            onNodeClick?.(node);
          })
          .onNodeHover((node: any) => {
            if (containerRef.current)
              containerRef.current.style.cursor = node ? 'pointer' : '';
            setHoveredNode(node ?? null);
            onNodeHover?.(node ?? null);
          });

        // Force layout spread
        Graph.d3Force('charge')?.strength(-280);
        Graph.d3Force('link')?.distance(130);
        Graph.d3Force('center')?.strength(1.5);

        // ── 3-point animated lighting rig ───────────────────────────────────
        const scene = Graph.scene();
        if (scene) {
          scene.children = scene.children.filter(
            (c: any) => !(c instanceof THREE.Light)
          );
          scene.add(new THREE.AmbientLight(0x404040, 0.6));

          const dir = new THREE.DirectionalLight(0xffffff, 0.8);
          dir.position.set(100, 100, 100);
          scene.add(dir);

          const pRed  = new THREE.PointLight(0xff6b6b, 1.2, 450);
          const pCyan = new THREE.PointLight(0x22d3ee, 0.8, 350);
          const pPurp = new THREE.PointLight(0xa855f7, 0.5, 300);
          pRed.position.set( 80,  60,  80);
          pCyan.position.set(-80, -60, -80);
          pPurp.position.set(  0, 120, -120);
          scene.add(pRed, pCyan, pPurp);

          const animLights = () => {
            if (cancelled) return;
            const t = Date.now() * 0.001;
            pRed.intensity  = 1.0 + Math.sin(t * 0.7) * 0.3;
            pCyan.intensity = 0.6 + Math.cos(t * 0.5) * 0.2;
            pPurp.intensity = 0.3 + Math.sin(t * 0.3) * 0.15;
            pRed.position.x  = Math.cos(t * 0.22) * 110;
            pRed.position.z  = Math.sin(t * 0.22) * 110;
            pCyan.position.x = Math.cos(t * 0.30 + Math.PI) * 90;
            pCyan.position.z = Math.sin(t * 0.30 + Math.PI) * 90;
            lightAnimRef.current = requestAnimationFrame(animLights);
          };
          animLights();
        }

        // Camera: position + slow orbit for 3-D depth feeling
        Graph.cameraPosition({ x: 0, y: 50, z: 220 });

        let fitted = false;
        Graph.onEngineStop(() => {
          if (!fitted) { fitted = true; Graph.zoomToFit(900, 50); }
        });

        const orbit = () => {
          if (cancelled) return;
          rotationRef.current += 0.0007;
          Graph.cameraPosition({
            x: 190 * Math.sin(rotationRef.current),
            y: 50,
            z: 190 * Math.cos(rotationRef.current),
          });
          animFrameRef.current = requestAnimationFrame(orbit);
        };
        orbit();

        graphRef.current = Graph;
        Graph.graphData(data);
        setIsLoading(false);

      } catch (err) {
        console.error('StrategyGraph3D error:', err);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      cancelAnimationFrame(lightAnimRef.current);
      graphRef.current?._destructor?.();
      graphRef.current = null;
      initRef.current  = false;
    };
  }, [isClient]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update graph data when prop changes ──────────────────────────────────
  useEffect(() => {
    if (!graphRef.current) return;
    graphRef.current.graphData(data);
    // Refresh nodeThreeObject so colours/sizes update
    graphRef.current.nodeThreeObject(graphRef.current.nodeThreeObject());
  }, [data]);

  // ── Resize observer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      if (graphRef.current) {
        const { width: w, height: h } = entries[0].contentRect;
        graphRef.current.width(w).height(h);
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // ── SSR guard ─────────────────────────────────────────────────────────────
  if (!isClient) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/30 text-zinc-500">
        <div className="w-6 h-6 border-2 border-cyan-500/50 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 rounded-xl">
          <div className="text-center">
            <div className="w-9 h-9 border-2 border-cyan-500/60 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
              Building 3D graph…
            </p>
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredNode && (
        <div className="absolute top-3 left-3 z-10 px-3 py-2 rounded-lg bg-black/80 border border-white/10 backdrop-blur-sm pointer-events-none">
          <p className="text-xs font-bold text-white capitalize">{hoveredNode.name}</p>
          <p
            className="text-[10px] font-mono mt-0.5"
            style={{ color: getStrategyColor(hoveredNode.name ?? '') }}
          >
            {hoveredNode.wins ?? 0}W ·&nbsp;{hoveredNode.losses ?? 0}L
            {(hoveredNode.wins ?? 0) + (hoveredNode.losses ?? 0) > 0
              ? ` · ${(
                  ((hoveredNode.wins ?? 0) /
                    ((hoveredNode.wins ?? 0) + (hoveredNode.losses ?? 0))) *
                  100
                ).toFixed(0)}% WR`
              : ''}
          </p>
        </div>
      )}

      {/* Legend */}
      {!isLoading && (
        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1 pointer-events-none">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/60 border border-white/10">
            <span className="w-3 h-[2px] rounded" style={{ background: '#ff6b6b' }} />
            <span className="text-[9px] font-mono text-zinc-400">BEATS</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/60 border border-white/10">
            <span className="w-3 h-[2px] rounded" style={{ background: '#22d3ee' }} />
            <span className="text-[9px] font-mono text-zinc-400">LOSES_TO</span>
          </div>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
