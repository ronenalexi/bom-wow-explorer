import React, { useMemo, useCallback, useEffect, useState, createContext, useContext } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
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
import Dagre from '@dagrejs/dagre';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Leaf, MoreHorizontal, Layers, Package } from 'lucide-react';
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

// ---------- Dagre Tree Layout ----------

const NODE_WIDTH = 240;
const NODE_HEIGHT = 120;
const SMALL_NODE_W = 170;
const SMALL_NODE_H = 60;

function dagreLayout(
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[],
): { nodes: Node[]; edges: Edge[] } {
  if (graphNodes.length === 0) return { nodes: [], edges: [] };

  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',
    nodesep: 60,
    ranksep: 100,
    edgesep: 30,
    marginx: 40,
    marginy: 40,
  });

  for (const n of graphNodes) {
    const w = n.type === 'item' ? NODE_WIDTH : SMALL_NODE_W;
    const h = n.type === 'item' ? NODE_HEIGHT : SMALL_NODE_H;
    g.setNode(n.id, { width: w, height: h });
  }

  for (const e of graphEdges) {
    g.setEdge(e.source, e.target);
  }

  Dagre.layout(g);

  const nodes: Node[] = graphNodes.map(n => {
    const pos = g.node(n.id);
    const w = n.type === 'item' ? NODE_WIDTH : SMALL_NODE_W;
    const h = n.type === 'item' ? NODE_HEIGHT : SMALL_NODE_H;
    return {
      id: n.id,
      type: n.type,
      position: { x: pos.x - w / 2, y: pos.y - h / 2 },
      data: n.data,
    };
  });

  const edges: Edge[] = graphEdges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'smoothstep',
    animated: false,
    style: { stroke: 'hsl(var(--primary) / 0.35)', strokeWidth: 2 },
  }));

  return { nodes, edges };
}

// ---------- Custom Nodes ----------

function ItemNode({ id, data }: { id: string; data: { row: BomRow; isExpanded: boolean } }) {
  const { onToggle, onSelect, onDoubleClick } = useContext(GraphCtx);
  const { row, isExpanded } = data;
  const isRoot = row.Level === 0 || !row.Parent;
  const isLeaf = !row.HasChildren;

  return (
    <div
      className="cursor-pointer group"
      onClick={() => onSelect(id)}
      onDoubleClick={() => onDoubleClick(id)}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary/40 !border-primary/20 !w-2 !h-2" />

      <div className={`
        w-[240px] rounded-lg border transition-all duration-200
        ${isRoot
          ? 'bg-primary/10 border-primary/40 shadow-md shadow-primary/10'
          : isLeaf
            ? 'bg-card border-border/60 group-hover:border-muted-foreground/40'
            : 'bg-card border-border group-hover:border-primary/40 shadow-sm'
        }
      `}>
        {/* Header */}
        <div className={`px-3 py-2 border-b ${isRoot ? 'border-primary/20' : 'border-border/40'}`}>
          <div className="flex items-center gap-2">
            <div className={`
              w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold shrink-0
              ${isRoot
                ? 'bg-primary/20 text-primary'
                : isLeaf
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }
            `}>
              {row.Level}
            </div>
            <span className={`font-mono text-xs font-semibold truncate ${isRoot ? 'text-primary' : 'text-foreground'}`}>
              {row.Item}
            </span>
            {row.QtyPerParent > 0 && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-auto shrink-0 bg-accent/15 text-accent border-accent/20 font-bold">
                ×{row.QtyPerParent}
              </Badge>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-3 py-2">
          <p className="text-[11px] text-muted-foreground truncate leading-tight">{row.ItemDesc}</p>

          {/* Expand / Leaf indicator */}
          <div className="mt-2">
            {row.HasChildren ? (
              <button
                onClick={(e) => { e.stopPropagation(); onToggle(id); }}
                className={`
                  flex items-center gap-1.5 text-[10px] font-medium transition-colors
                  ${isExpanded ? 'text-primary' : 'text-muted-foreground hover:text-primary'}
                `}
              >
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                {isExpanded ? 'Collapse' : 'Expand'}
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                <Leaf className="w-3 h-3" />
                <span>Leaf</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-primary/40 !border-primary/20 !w-2 !h-2" />
    </div>
  );
}

function MoreNode({ id, data }: { id: string; data: { count: number; parentSeq: string } }) {
  const { onOpenBrowser } = useContext(GraphCtx);
  return (
    <div>
      <Handle type="target" position={Position.Top} className="!bg-accent/40 !border-accent/20 !w-2 !h-2" />
      <button
        onClick={() => onOpenBrowser(data.parentSeq)}
        className="w-[170px] rounded-lg border border-accent/30 bg-accent/5 p-3 text-center hover:bg-accent/15 transition-colors"
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
    <div>
      <Handle type="target" position={Position.Top} className="!bg-primary/40 !border-primary/20 !w-2 !h-2" />
      <button
        onClick={() => onOpenBrowser(data.parentSeq)}
        className="w-[170px] rounded-lg border border-primary/30 bg-primary/5 p-3 text-center hover:bg-primary/15 transition-colors"
      >
        <Layers className="w-4 h-4 mx-auto text-primary mb-1" />
        <div className="text-sm font-bold text-primary">{data.count} Children</div>
        <div className="text-[10px] text-muted-foreground">Click to browse</div>
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
    const { nodes: ln, edges: le } = dagreLayout(graphNodes, graphEdges);
    setNodes(ln);
    setEdges(le);
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
  }, [graphNodes, graphEdges, setNodes, setEdges, fitView]);

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
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="hsl(var(--muted-foreground) / 0.15)" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === 'more') return 'hsl(var(--accent))';
            if (n.type === 'children-group') return 'hsl(var(--primary))';
            return 'hsl(var(--muted-foreground) / 0.3)';
          }}
          maskColor="hsl(var(--background) / 0.85)"
          className="!bg-card !border-border"
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
