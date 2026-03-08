import React, { useState, useMemo, useCallback } from 'react';
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
    // Full circle — draw two half-arcs
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

  const handleArcClick = useCallback((seq: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const children = tree.childrenMap.get(seq) || [];
    if (children.length > 0) {
      setZoomRoot(seq);
    }
    onSelect(seq);
  }, [tree, onSelect]);

  const handleBackClick = useCallback(() => {
    if (!zoomRoot) return;
    const parent = tree.parentMap.get(zoomRoot);
    setZoomRoot(parent || null);
  }, [zoomRoot, tree]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-background relative select-none">
      <svg viewBox={viewBox} className="w-full h-full max-w-[800px] max-h-[800px]">
        {/* Center circle */}
        <circle
          cx={0} cy={0} r={CENTER_RADIUS}
          className="fill-primary/20 stroke-primary/40 cursor-pointer"
          strokeWidth={2}
          onClick={handleBackClick}
        />
        <text x={0} y={-8} textAnchor="middle" className="fill-foreground text-[11px] font-bold pointer-events-none">
          {rootRow?.Item || 'Root'}
        </text>
        <text x={0} y={8} textAnchor="middle" className="fill-muted-foreground text-[9px] pointer-events-none">
          {rootRow?.ItemDesc?.slice(0, 20) || ''}
        </text>
        {zoomRoot && (
          <text x={0} y={22} textAnchor="middle" className="fill-primary text-[8px] pointer-events-none">
            ↩ click to go back
          </text>
        )}

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
              {/* Label — only if arc is big enough */}
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
            <p className="text-primary text-[10px]">Click to zoom in</p>
          )}
        </div>
      )}
    </div>
  );
}
