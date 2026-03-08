import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Undo2 } from 'lucide-react';
import type { TreeData } from '@/lib/bom';

interface Props {
  tree: TreeData;
  rootSeq: string;
  onSelect: (seq: string) => void;
  selectedNode: string | null;
}

interface ArcData {
  seq: string;
  item: string;
  desc: string;
  qty: number;
  level: number;
  startAngle: number;
  endAngle: number;
  innerRadius: number;
  outerRadius: number;
}

const LEVEL_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(220, 60%, 55%)',
  'hsl(160, 50%, 45%)',
  'hsl(280, 45%, 55%)',
  'hsl(30, 65%, 50%)',
  'hsl(350, 50%, 50%)',
  'hsl(190, 55%, 45%)',
];

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, innerR: number, outerR: number, startAngle: number, endAngle: number) {
  const sweep = endAngle - startAngle;
  if (sweep >= 359.99) {
    const mid = startAngle + 180;
    return [
      arcPath(cx, cy, innerR, outerR, startAngle, mid),
      arcPath(cx, cy, innerR, outerR, mid, endAngle),
    ].join(' ');
  }
  const largeArc = sweep > 180 ? 1 : 0;
  const os = polarToCartesian(cx, cy, outerR, startAngle);
  const oe = polarToCartesian(cx, cy, outerR, endAngle);
  const is_ = polarToCartesian(cx, cy, innerR, endAngle);
  const ie = polarToCartesian(cx, cy, innerR, startAngle);
  return [
    `M ${os.x} ${os.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${oe.x} ${oe.y}`,
    `L ${is_.x} ${is_.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ie.x} ${ie.y}`,
    'Z',
  ].join(' ');
}

const RING_WIDTH = 55;
const CENTER_RADIUS = 60;
const MAX_DEPTH = 5;

export default function BomSunburst({ tree, rootSeq, onSelect, selectedNode }: Props) {
  const [zoomRoot, setZoomRoot] = useState<string | null>(null);
  const [hoveredSeq, setHoveredSeq] = useState<string | null>(null);

  // Zoom & pan state
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const effectiveRoot = zoomRoot || rootSeq;

  const arcs = useMemo(() => {
    const result: ArcData[] = [];

    function buildArcs(parentSeq: string, depth: number, startAngle: number, endAngle: number) {
      if (depth > MAX_DEPTH) return;
      const children = tree.childrenMap.get(parentSeq) || [];
      if (children.length === 0) return;

      const totalQty = children.reduce((s, c) => s + Math.max(c.QtyPerParent, 1), 0);
      const span = endAngle - startAngle;
      const gap = Math.min(1, span / children.length / 4);
      let angle = startAngle;

      for (const child of children) {
        const share = (Math.max(child.QtyPerParent, 1) / totalQty) * (span - gap * children.length);
        const sa = angle + gap / 2;
        const ea = angle + share + gap / 2;
        const innerR = CENTER_RADIUS + depth * RING_WIDTH;
        const outerR = innerR + RING_WIDTH - 2;

        result.push({
          seq: child.Seq,
          item: child.Item,
          desc: child.ItemDesc,
          qty: child.QtyPerParent,
          level: depth,
          startAngle: sa,
          endAngle: ea,
          innerRadius: innerR,
          outerRadius: outerR,
        });

        buildArcs(child.Seq, depth + 1, sa, ea);
        angle += share + gap;
      }
    }

    buildArcs(effectiveRoot, 0, 0, 360);
    return result;
  }, [tree, effectiveRoot]);

  const rootRow = tree.rowBySeq.get(effectiveRoot);
  const hoveredRow = hoveredSeq ? tree.rowBySeq.get(hoveredSeq) : null;

  const maxR = CENTER_RADIUS + MAX_DEPTH * RING_WIDTH + 20;
  const viewBox = `${-maxR} ${-maxR} ${maxR * 2} ${maxR * 2}`;

  // Arc click: zoom only for nodes with children, onSelect for leaves
  const handleArcClick = useCallback((seq: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomRoot(seq);
  }, []);

  // Center click: open side panel for the current zoomed item
  const handleCenterClick = useCallback(() => {
    if (effectiveRoot) {
      onSelect(effectiveRoot);
    }
  }, [effectiveRoot, onSelect]);

  // Back button
  const handleBackClick = useCallback(() => {
    if (!zoomRoot) return;
    const parent = tree.parentMap.get(zoomRoot);
    setZoomRoot(parent || null);
  }, [zoomRoot, tree]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(prev => Math.min(3, Math.max(0.5, prev - e.deltaY * 0.001)));
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, panX, panY };
  }, [panX, panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPanX(panStart.current.panX + dx / scale);
    setPanY(panStart.current.panY + dy / scale);
  }, [scale]);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center bg-background relative select-none">
      {/* Back button overlay */}
      {zoomRoot && (
        <button
          onClick={handleBackClick}
          className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 border border-border text-foreground text-xs font-medium transition-colors"
        >
          <Undo2 size={14} />
          חזרה
        </button>
      )}

      <svg
        viewBox={viewBox}
        className="w-full h-full max-w-[800px] max-h-[800px]"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <g transform={`translate(${panX}, ${panY}) scale(${scale})`}>
          {/* Center circle */}
          <circle
            cx={0} cy={0} r={CENTER_RADIUS}
            className="fill-primary/20 stroke-primary/40 cursor-pointer"
            strokeWidth={2}
            onClick={handleCenterClick}
          />
          <text x={0} y={-8} textAnchor="middle" className="fill-foreground text-[11px] font-bold pointer-events-none">
            {rootRow?.Item || 'Root'}
          </text>
          <text x={0} y={8} textAnchor="middle" className="fill-muted-foreground text-[9px] pointer-events-none">
            {rootRow?.ItemDesc?.slice(0, 20) || ''}
          </text>
          <text x={0} y={22} textAnchor="middle" className="fill-primary text-[8px] pointer-events-none">
            לחץ לפרטים
          </text>

          {/* Arcs */}
          {arcs.map((arc) => {
            const color = LEVEL_COLORS[arc.level % LEVEL_COLORS.length];
            const isSelected = arc.seq === selectedNode;
            const isHovered = arc.seq === hoveredSeq;
            return (
              <g key={arc.seq}>
                <path
                  d={arcPath(0, 0, arc.innerRadius, arc.outerRadius, arc.startAngle, arc.endAngle)}
                  fill={color}
                  opacity={isHovered ? 1 : isSelected ? 0.95 : 0.75}
                  stroke={isSelected ? 'hsl(var(--primary))' : 'hsl(var(--background))'}
                  strokeWidth={isSelected ? 2.5 : 1}
                  className="cursor-pointer transition-opacity duration-150"
                  onClick={(e) => handleArcClick(arc.seq, e)}
                  onMouseEnter={() => setHoveredSeq(arc.seq)}
                  onMouseLeave={() => setHoveredSeq(null)}
                />
                {(arc.endAngle - arc.startAngle) > 12 && (
                  (() => {
                    const midAngle = (arc.startAngle + arc.endAngle) / 2;
                    const midR = (arc.innerRadius + arc.outerRadius) / 2;
                    const pos = polarToCartesian(0, 0, midR, midAngle);
                    return (
                      <text
                        x={pos.x} y={pos.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="fill-foreground text-[7px] font-medium pointer-events-none"
                        transform={`rotate(${midAngle > 90 && midAngle < 270 ? midAngle + 180 : midAngle}, ${pos.x}, ${pos.y})`}
                      >
                        {arc.item.slice(0, 12)}
                      </text>
                    );
                  })()
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {hoveredRow && (
        <div className="absolute top-4 right-4 bg-card border border-border rounded-lg p-3 shadow-lg text-xs space-y-1 max-w-[220px] pointer-events-none z-10">
          <p className="font-bold text-foreground">{hoveredRow.Item}</p>
          <p className="text-muted-foreground">{hoveredRow.ItemDesc}</p>
          <div className="flex gap-3 text-muted-foreground">
            <span>Qty: <span className="text-foreground font-medium">{hoveredRow.QtyPerParent}</span></span>
            <span>Level: <span className="text-foreground font-medium">{hoveredRow.Level}</span></span>
          </div>
          {(tree.childrenMap.get(hoveredRow.Seq) || []).length > 0 && (
            <p className="text-primary text-[10px]">לחץ כדי להתקרב</p>
          )}
        </div>
      )}
    </div>
  );
}
