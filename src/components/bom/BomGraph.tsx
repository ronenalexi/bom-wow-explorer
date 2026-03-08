import React, { useMemo, useCallback, useEffect, useState, createContext, useContext } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  BackgroundVariant,
  ConnectionLineType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Leaf, MoreHorizontal, Layers, Sun, Moon } from 'lucide-react';
import type { GraphNode, GraphEdge, BomRow } from '@/lib/bom';

// Context for callbacks
interface GraphCallbacks {
  onToggle: (seq: string) => void;
  onSelect: (seq: string) => void;
  onDoubleClick: (seq: string) => void;
  onOpenBrowser: (seq: string) => void;
}
const GraphCtx = createContext<GraphCallbacks>({
  onToggle: () => {},
  onSelect: () => {},
  onDoubleClick: () => {},
  onOpenBrowser: () => {},
});

// ---------- Radial Layout ----------

const NODE_WIDTH = 260;
const NODE_HEIGHT = 140;
const SMALL_NODE_W = 190;
const SMALL_NODE_H = 70;
const MIN_SPACING = 40; // minimum gap between node edges

function radialLayout(
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[],
  centerNodeId: string | null,
): { nodes: Node[]; edges: Edge[] } {
  if (graphNodes.length === 0) return { nodes: [], edges: [] };

  const childrenOf = new Map<string, string[]>();
  const parentOf = new Map<string, string>();
  for (const e of graphEdges) {
    if (!childrenOf.has(e.source)) childrenOf.set(e.source, []);
    childrenOf.get(e.source)!.push(e.target);
    parentOf.set(e.target, e.source);
  }

  let centerId = centerNodeId;
  if (!centerId || !graphNodes.find(n => n.id === centerId)) {
    centerId = graphNodes.find(n => !parentOf.has(n.id))?.id || graphNodes[0].id;
  }

  const positions = new Map<string, { x: number; y: number }>();
  const nodeAngles = new Map<string, number>();
  const visited = new Set<string>();

  positions.set(centerId, { x: 0, y: 0 });
  visited.add(centerId);

  // Place parent of center above
  const centerParent = parentOf.get(centerId);
  if (centerParent && graphNodes.find(n => n.id === centerParent)) {
    positions.set(centerParent, { x: 0, y: -400 });
    nodeAngles.set(centerParent, -Math.PI / 2);
    visited.add(centerParent);
  }

  function computeRadius(childCount: number, depth: number): number {
    // Ensure nodes don't overlap: circumference must fit all nodes
    const nodeSize = NODE_WIDTH + MIN_SPACING;
    const circumferenceNeeded = childCount * nodeSize;
    const radiusFromCircumference = circumferenceNeeded / (2 * Math.PI);
    const minRadius = 350 + depth * 80;
    return Math.max(minRadius, radiusFromCircumference);
  }

  function placeChildren(parentId: string, depth: number) {
    const kids = childrenOf.get(parentId) || [];
    const unvisited = kids.filter(k => !visited.has(k));
    if (unvisited.length === 0) return;

    const parentPos = positions.get(parentId)!;
    const radius = computeRadius(unvisited.length, depth);
    const isCenter = parentId === centerId;

    let baseAngle: number;
    let spread: number;

    if (isCenter) {
      if (centerParent && graphNodes.find(n => n.id === centerParent)) {
        baseAngle = Math.PI / 2;
        spread = Math.PI * 1.5;
      } else {
        baseAngle = -Math.PI / 2;
        spread = Math.PI * 2;
      }
    } else {
      const grandParent = parentOf.get(parentId);
      if (grandParent && positions.has(grandParent)) {
        const gpPos = positions.get(grandParent)!;
        baseAngle = Math.atan2(parentPos.y - gpPos.y, parentPos.x - gpPos.x);
      } else {
        baseAngle = Math.PI / 2;
      }
      // Dynamic spread: wider arc for more children, capped at 180 degrees
      const minArcPerChild = 0.35;
      spread = Math.min(Math.PI, Math.max(Math.PI * 0.5, unvisited.length * minArcPerChild));
    }

    for (let i = 0; i < unvisited.length; i++) {
      const kid = unvisited[i];
      let angle: number;
      if (unvisited.length === 1) {
        angle = baseAngle;
      } else {
        angle = baseAngle - spread / 2 + (spread / (unvisited.length - 1)) * i;
      }

      const x = parentPos.x + radius * Math.cos(angle);
      const y = parentPos.y + radius * Math.sin(angle);

      positions.set(kid, { x, y });
      nodeAngles.set(kid, angle);
      visited.add(kid);

      placeChildren(kid, depth + 1);
    }
  }

  placeChildren(centerId, 0);

  // Also place children of centerParent's other branches (siblings of center)
  if (centerParent && graphNodes.find(n => n.id === centerParent)) {
    placeChildren(centerParent, 1);
  }

  // Place any remaining unvisited nodes
  let offsetX = 0;
  for (const n of graphNodes) {
    if (!positions.has(n.id)) {
      positions.set(n.id, { x: offsetX, y: 600 });
      offsetX += NODE_WIDTH + MIN_SPACING;
    }
  }

  const nodes: Node[] = graphNodes.map(n => {
    const pos = positions.get(n.id)!;
    const w = n.type === 'item' ? NODE_WIDTH : SMALL_NODE_W;
    const h = n.type === 'item' ? NODE_HEIGHT : SMALL_NODE_H;
    const angle = nodeAngles.get(n.id);

    return {
      id: n.id,
      type: n.type,
      position: { x: pos.x - w / 2, y: pos.y - h / 2 },
      data: { ...n.data, angle, isCenter: n.id === centerId },
    };
  });

  const edges: Edge[] = graphEdges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'default',
    animated: false,
    style: { stroke: 'hsl(185 80% 40% / 0.4)', strokeWidth: 2 },
  }));

  return { nodes, edges };
}

// ---------- Custom Nodes ----------

function ItemNode({ id, data }: { id: string; data: { row: BomRow; isExpanded: boolean; isCenter?: boolean } }) {
  const { onToggle, onSelect, onDoubleClick } = useContext(GraphCtx);
  const { row, isExpanded, isCenter } = data;
  const isRoot = row.Level === 0 || !row.Parent;
  const isLeaf = !row.HasChildren;

  return (
    <div
      className="bom-node-wrapper cursor-pointer"
      onClick={() => onSelect(id)}
      onDoubleClick={() => onDoubleClick(id)}
    >
      {/* All 4 handles for radial connections */}
      <Handle type="target" position={Position.Top} className="!bg-primary/50 !border-primary/30 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} id="left-t" className="!bg-primary/50 !border-primary/30 !w-2 !h-2" />
      <Handle type="target" position={Position.Right} id="right-t" className="!bg-primary/50 !border-primary/30 !w-2 !h-2" />
      <Handle type="target" position={Position.Bottom} id="bottom-t" className="!bg-primary/50 !border-primary/30 !w-2 !h-2" />

      <div className={`
        w-[260px] rounded-xl border p-4 transition-all duration-300
        ${isCenter
          ? 'bg-gradient-to-br from-primary/20 to-card border-primary/60 shadow-[0_0_30px_hsl(185_100%_48%/0.2)] scale-105'
          : isRoot
            ? 'bg-gradient-to-br from-card to-secondary border-primary/40 shadow-lg'
            : isLeaf
              ? 'bg-card/80 border-node-leaf/30 hover:border-node-leaf/60'
              : 'bg-card border-border hover:border-primary/50'
        }
      `}>
        <div className="flex items-center gap-2 mb-2">
          <div className={`
            w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold
            ${isRoot || isCenter
              ? 'bg-primary/20 text-primary'
              : isLeaf
                ? 'bg-node-leaf/15 text-node-leaf'
                : 'bg-secondary text-muted-foreground'
            }
          `}>
            L{row.Level}
          </div>
          <div className="flex-1" />
          {row.QtyPerParent > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-accent/20 text-accent border-accent/30 font-bold">
              ×{row.QtyPerParent}
            </Badge>
          )}
        </div>

        <div className={`font-mono text-sm font-bold truncate ${isRoot || isCenter ? 'text-primary' : 'text-foreground'}`}>
          {row.Item}
        </div>
        <div className="text-xs text-muted-foreground truncate mt-1">{row.ItemDesc}</div>

        <div className="mt-3 pt-2 border-t border-border/50">
          {row.HasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(id); }}
              className={`
                flex items-center gap-1.5 text-[11px] font-medium transition-all duration-200
                ${isExpanded ? 'text-primary' : 'text-primary/60 hover:text-primary'}
              `}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${
                isExpanded ? 'bg-primary/20 rotate-0' : 'bg-primary/10 -rotate-90'
              }`}>
                <ChevronDown className="w-3 h-3" />
              </div>
              {isExpanded ? 'Collapse' : 'Expand children'}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-node-leaf/70">
              <div className="w-5 h-5 rounded-full bg-node-leaf/10 flex items-center justify-center">
                <Leaf className="w-3 h-3" />
              </div>
              <span>Leaf component</span>
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-primary/50 !border-primary/30 !w-2 !h-2" />
      <Handle type="source" position={Position.Left} id="left-s" className="!bg-primary/50 !border-primary/30 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} id="right-s" className="!bg-primary/50 !border-primary/30 !w-2 !h-2" />
      <Handle type="source" position={Position.Top} id="top-s" className="!bg-primary/50 !border-primary/30 !w-2 !h-2" />
    </div>
  );
}

function MoreNode({ id, data }: { id: string; data: { count: number; parentSeq: string } }) {
  const { onOpenBrowser } = useContext(GraphCtx);
  return (
    <div className="bom-node-wrapper">
      <Handle type="target" position={Position.Top} className="!bg-accent/50 !border-accent/30 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} id="left-t" className="!bg-accent/50 !border-accent/30 !w-2 !h-2" />
      <Handle type="target" position={Position.Right} id="right-t" className="!bg-accent/50 !border-accent/30 !w-2 !h-2" />
      <button
        onClick={() => onOpenBrowser(data.parentSeq)}
        className="w-[180px] rounded-lg border border-accent/30 bg-accent/10 p-3 text-center hover:bg-accent/20 transition-colors"
      >
        <MoreHorizontal className="w-4 h-4 mx-auto text-accent mb-1" />
        <div className="text-xs font-medium text-accent">+{data.count} more</div>
        <div className="text-[10px] text-muted-foreground">Click to browse</div>
      </button>
    </div>
  );
}

function ChildrenGroupNode({ id, data }: { id: string; data: { count: number; parentSeq: string } }) {
  const { onOpenBrowser } = useContext(GraphCtx);
  return (
    <div className="bom-node-wrapper">
      <Handle type="target" position={Position.Top} className="!bg-primary/50 !border-primary/30 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} id="left-t" className="!bg-primary/50 !border-primary/30 !w-2 !h-2" />
      <Handle type="target" position={Position.Right} id="right-t" className="!bg-primary/50 !border-primary/30 !w-2 !h-2" />
      <button
        onClick={() => onOpenBrowser(data.parentSeq)}
        className="w-[180px] rounded-lg border border-primary/30 bg-primary/10 p-3 text-center hover:bg-primary/20 transition-colors animate-pulse-glow"
      >
        <Layers className="w-5 h-5 mx-auto text-primary mb-1" />
        <div className="text-sm font-bold text-primary">{data.count} Children</div>
        <div className="text-[10px] text-muted-foreground">Click to browse all</div>
      </button>
    </div>
  );
}

const nodeTypes = {
  item: ItemNode,
  more: MoreNode,
  'children-group': ChildrenGroupNode,
};

interface BomGraphInnerProps {
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  centerNodeId: string | null;
  callbacks: GraphCallbacks;
}

function BomGraphInner({ graphNodes, graphEdges, centerNodeId, callbacks }: BomGraphInnerProps) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const { nodes: ln, edges: le } = radialLayout(graphNodes, graphEdges, centerNodeId);
    setNodes(ln);
    setEdges(le);
    setTimeout(() => fitView({ padding: 0.2, duration: 600 }), 50);
  }, [graphNodes, graphEdges, centerNodeId, setNodes, setEdges, fitView]);

  return (
    <GraphCtx.Provider value={callbacks}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        nodesDraggable={true}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{ animated: false }}
        connectionLineType={ConnectionLineType.SmoothStep}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(222 15% 15%)" />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === 'more') return 'hsl(38 95% 55%)';
            if (n.type === 'children-group') return 'hsl(185 100% 48%)';
            return 'hsl(222 20% 25%)';
          }}
          maskColor="hsl(222 25% 6% / 0.8)"
        />
      </ReactFlow>
    </GraphCtx.Provider>
  );
}

interface BomGraphProps {
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  centerNodeId: string | null;
  onToggle: (seq: string) => void;
  onSelect: (seq: string) => void;
  onDoubleClick: (seq: string) => void;
  onOpenBrowser: (seq: string) => void;
}

export default function BomGraph({ graphNodes, graphEdges, centerNodeId, onToggle, onSelect, onDoubleClick, onOpenBrowser }: BomGraphProps) {
  const callbacks = useMemo(() => ({ onToggle, onSelect, onDoubleClick, onOpenBrowser }), [onToggle, onSelect, onDoubleClick, onOpenBrowser]);

  return (
    <ReactFlowProvider>
      <BomGraphInner graphNodes={graphNodes} graphEdges={graphEdges} centerNodeId={centerNodeId} callbacks={callbacks} />
    </ReactFlowProvider>
  );
}
