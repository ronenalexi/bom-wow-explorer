import React, { useMemo, useCallback, useEffect, createContext, useContext } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Dagre from '@dagrejs/dagre';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Leaf, MoreHorizontal, Layers } from 'lucide-react';
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

// dagre layout
function layoutNodes(graphNodes: GraphNode[], graphEdges: GraphEdge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 120, marginx: 40, marginy: 40 });

  for (const n of graphNodes) {
    const w = n.type === 'item' ? 240 : 180;
    const h = n.type === 'item' ? 90 : 60;
    g.setNode(n.id, { width: w, height: h });
  }
  for (const e of graphEdges) {
    g.setEdge(e.source, e.target);
  }
  Dagre.layout(g);

  const nodes: Node[] = graphNodes.map(n => {
    const pos = g.node(n.id);
    const w = n.type === 'item' ? 240 : 180;
    const h = n.type === 'item' ? 90 : 60;
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
    animated: true,
    style: { stroke: 'hsl(185 80% 40% / 0.6)', strokeWidth: 2 },
  }));

  return { nodes, edges };
}

// Custom node: Item
function ItemNode({ id, data }: { id: string; data: { row: BomRow; isExpanded: boolean } }) {
  const { onToggle, onSelect, onDoubleClick } = useContext(GraphCtx);
  const { row, isExpanded } = data;

  return (
    <div
      className="bom-node-wrapper cursor-pointer"
      onClick={() => onSelect(id)}
      onDoubleClick={() => onDoubleClick(id)}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary/50 !border-primary/30 !w-2 !h-2" />
      <div className="w-[240px] rounded-lg border border-border bg-card p-3 glow-node hover:glow-primary transition-shadow duration-300">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-mono text-sm font-bold text-primary truncate">{row.Item}</div>
            <div className="text-xs text-muted-foreground truncate mt-0.5">{row.ItemDesc}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {row.QtyPerParent > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-accent/20 text-accent border-accent/30">
                x{row.QtyPerParent}
              </Badge>
            )}
          </div>
        </div>
        {row.HasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(id); }}
            className="mt-2 flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        ) : (
          <div className="mt-2 flex items-center gap-1 text-[11px] text-node-leaf/70">
            <Leaf className="w-3 h-3" /> Leaf
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary/50 !border-primary/30 !w-2 !h-2" />
    </div>
  );
}

// Custom node: More
function MoreNode({ id, data }: { id: string; data: { count: number; parentSeq: string } }) {
  const { onOpenBrowser } = useContext(GraphCtx);
  return (
    <div className="bom-node-wrapper">
      <Handle type="target" position={Position.Top} className="!bg-accent/50 !border-accent/30 !w-2 !h-2" />
      <button
        onClick={() => onOpenBrowser(data.parentSeq)}
        className="w-[180px] rounded-lg border border-accent/30 bg-accent/10 p-3 text-center hover:bg-accent/20 transition-colors glow-accent"
      >
        <MoreHorizontal className="w-4 h-4 mx-auto text-accent mb-1" />
        <div className="text-xs font-medium text-accent">+{data.count} more</div>
        <div className="text-[10px] text-muted-foreground">Click to browse</div>
      </button>
    </div>
  );
}

// Custom node: Children Group
function ChildrenGroupNode({ id, data }: { id: string; data: { count: number; parentSeq: string } }) {
  const { onOpenBrowser } = useContext(GraphCtx);
  return (
    <div className="bom-node-wrapper">
      <Handle type="target" position={Position.Top} className="!bg-primary/50 !border-primary/30 !w-2 !h-2" />
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
  callbacks: GraphCallbacks;
}

function BomGraphInner({ graphNodes, graphEdges, callbacks }: BomGraphInnerProps) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const { nodes: ln, edges: le } = layoutNodes(graphNodes, graphEdges);
    setNodes(ln);
    setEdges(le);
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
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
        defaultEdgeOptions={{ animated: true }}
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
  onToggle: (seq: string) => void;
  onSelect: (seq: string) => void;
  onDoubleClick: (seq: string) => void;
  onOpenBrowser: (seq: string) => void;
}

export default function BomGraph({ graphNodes, graphEdges, onToggle, onSelect, onDoubleClick, onOpenBrowser }: BomGraphProps) {
  const callbacks = useMemo(() => ({ onToggle, onSelect, onDoubleClick, onOpenBrowser }), [onToggle, onSelect, onDoubleClick, onOpenBrowser]);

  return (
    <ReactFlowProvider>
      <BomGraphInner graphNodes={graphNodes} graphEdges={graphEdges} callbacks={callbacks} />
    </ReactFlowProvider>
  );
}
