import Papa from 'papaparse';

export interface BomRow {
  Seq: string;
  Level: number;
  Item: string;
  ItemDesc: string;
  Parent: string;
  ParentDesc: string;
  QtyPerParent: number;
  CumQty: number;
  Path: string;
  HasChildren: boolean;
}

export interface TreeData {
  rows: BomRow[];
  childrenMap: Map<string, BomRow[]>; // parentSeq → children rows
  rowBySeq: Map<string, BomRow>;
  roots: BomRow[];
  parentMap: Map<string, string>; // childSeq → parentSeq
}

export function parseCSV(csvText: string): BomRow[] {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  return result.data.map((row: any, i: number) => ({
    Seq: row.Seq?.toString().trim() || String(i + 1),
    Level: parseInt(row.Level) || 0,
    Item: row.Item?.toString().trim() || '',
    ItemDesc: row.ItemDesc?.toString().trim() || row.Item_Desc?.toString().trim() || '',
    Parent: row.Parent?.toString().trim() || '',
    ParentDesc: row.ParentDesc?.toString().trim() || row.Parent_Desc?.toString().trim() || '',
    QtyPerParent: parseFloat(row.QtyPerParent) || parseFloat(row.Qty_Per_Parent) || 0,
    CumQty: parseFloat(row.CumQty) || parseFloat(row.Cum_Qty) || 0,
    Path: row.Path?.toString().trim() || '',
    HasChildren: String(row.HasChildren ?? row.Has_Children ?? 'false').trim().toLowerCase() === 'true',
  }));
}

export function buildTree(rows: BomRow[]): TreeData {
  const rowBySeq = new Map<string, BomRow>();
  const childrenMap = new Map<string, BomRow[]>();
  const parentMap = new Map<string, string>();
  const stack: string[] = [];

  const minLevel = rows.length > 0 ? Math.min(...rows.map(r => r.Level)) : 0;

  for (const row of rows) {
    rowBySeq.set(row.Seq, row);
    stack[row.Level] = row.Seq;

    if (row.Level > minLevel) {
      const parentSeq = stack[row.Level - 1];
      if (parentSeq) {
        if (!childrenMap.has(parentSeq)) childrenMap.set(parentSeq, []);
        childrenMap.get(parentSeq)!.push(row);
        parentMap.set(row.Seq, parentSeq);
      }
    }
  }

  const roots = rows.filter(r => r.Level === minLevel);
  return { rows, childrenMap, rowBySeq, roots, parentMap };
}

export const THRESHOLD_ALL = 25;
export const THRESHOLD_MORE = 150;

export interface GraphNode {
  id: string;
  type: 'item' | 'more' | 'children-group';
  data: any;
}
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export function deriveGraph(
  tree: TreeData,
  rootSeq: string,
  expandedNodes: Set<string>,
  focusedNode: string | null,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const visited = new Set<string>();

  function addChildren(parentSeq: string) {
    const children = tree.childrenMap.get(parentSeq) || [];
    const count = children.length;
    if (count === 0) return;

    if (count <= THRESHOLD_ALL) {
      for (const c of children) {
        addNode(c.Seq, parentSeq);
      }
    } else if (count <= THRESHOLD_MORE) {
      for (const c of children.slice(0, THRESHOLD_ALL)) {
        addNode(c.Seq, parentSeq);
      }
      const moreId = `more-${parentSeq}`;
      nodes.push({ id: moreId, type: 'more', data: { count: count - THRESHOLD_ALL, parentSeq } });
      edges.push({ id: `e-${parentSeq}-${moreId}`, source: parentSeq, target: moreId });
    } else {
      const groupId = `group-${parentSeq}`;
      nodes.push({ id: groupId, type: 'children-group', data: { count, parentSeq } });
      edges.push({ id: `e-${parentSeq}-${groupId}`, source: parentSeq, target: groupId });
    }
  }

  function addNode(seq: string, fromParent: string | null) {
    if (visited.has(seq)) return;
    visited.add(seq);
    const row = tree.rowBySeq.get(seq);
    if (!row) return;

    nodes.push({ id: seq, type: 'item', data: { row, isExpanded: expandedNodes.has(seq) } });
    if (fromParent) {
      edges.push({ id: `e-${fromParent}-${seq}`, source: fromParent, target: seq });
    }
    if (expandedNodes.has(seq)) {
      addChildren(seq);
    }
  }

  if (focusedNode) {
    const row = tree.rowBySeq.get(focusedNode);
    if (!row) return { nodes, edges };

    const pSeq = tree.parentMap.get(focusedNode);
    if (pSeq) {
      const pRow = tree.rowBySeq.get(pSeq);
      if (pRow) {
        nodes.push({ id: pSeq, type: 'item', data: { row: pRow, isExpanded: false } });
        edges.push({ id: `e-${pSeq}-${focusedNode}`, source: pSeq, target: focusedNode });
      }
    }
    visited.add(focusedNode);
    nodes.push({ id: focusedNode, type: 'item', data: { row, isExpanded: expandedNodes.has(focusedNode) } });
    if (expandedNodes.has(focusedNode)) {
      addChildren(focusedNode);
    }
  } else {
    addNode(rootSeq, null);
  }

  return { nodes, edges };
}

export function getAncestors(tree: TreeData, seq: string): BomRow[] {
  const path: BomRow[] = [];
  let current: string | undefined = seq;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const row = tree.rowBySeq.get(current);
    if (row) path.unshift(row);
    current = tree.parentMap.get(current);
  }
  return path;
}

export function expandPathToNode(tree: TreeData, seq: string): string[] {
  const ancestors = getAncestors(tree, seq);
  // Return all ancestor seqs except the target itself (those need to be expanded)
  return ancestors.slice(0, -1).map(r => r.Seq);
}

export const DEMO_CSV = `Seq,Level,Item,ItemDesc,Parent,ParentDesc,QtyPerParent,CumQty,Path,HasChildren
1,0,BIKE-001,Mountain Bike Pro,,,,1,BIKE-001,True
2,1,FRAME-001,Aluminum Frame 6061,BIKE-001,Mountain Bike Pro,1,1,BIKE-001>FRAME-001,True
3,2,TUBE-001,Main Tube,FRAME-001,Aluminum Frame 6061,1,1,BIKE-001>FRAME-001>TUBE-001,False
4,2,TUBE-002,Seat Tube,FRAME-001,Aluminum Frame 6061,1,1,BIKE-001>FRAME-001>TUBE-002,False
5,2,TUBE-003,Down Tube,FRAME-001,Aluminum Frame 6061,1,1,BIKE-001>FRAME-001>TUBE-003,False
6,2,WELD-001,Weld Kit TIG,FRAME-001,Aluminum Frame 6061,1,1,BIKE-001>FRAME-001>WELD-001,False
7,2,PAINT-001,Powder Coat Matte,FRAME-001,Aluminum Frame 6061,1,1,BIKE-001>FRAME-001>PAINT-001,False
8,1,WHEEL-F,Front Wheel Assembly,BIKE-001,Mountain Bike Pro,1,1,BIKE-001>WHEEL-F,True
9,2,RIM-001,Alloy Rim 29er,WHEEL-F,Front Wheel Assembly,1,1,BIKE-001>WHEEL-F>RIM-001,False
10,2,SPOKE-001,Steel Spokes,WHEEL-F,Front Wheel Assembly,32,32,BIKE-001>WHEEL-F>SPOKE-001,False
11,2,HUB-F,Front Hub Sealed,WHEEL-F,Front Wheel Assembly,1,1,BIKE-001>WHEEL-F>HUB-F,True
12,3,BEARING-001,Cartridge Bearing,HUB-F,Front Hub Sealed,2,2,BIKE-001>WHEEL-F>HUB-F>BEARING-001,False
13,3,AXLE-001,Thru-Axle 15mm,HUB-F,Front Hub Sealed,1,1,BIKE-001>WHEEL-F>HUB-F>AXLE-001,False
14,2,TIRE-001,Trail Tire 29x2.4,WHEEL-F,Front Wheel Assembly,1,1,BIKE-001>WHEEL-F>TIRE-001,False
15,1,WHEEL-R,Rear Wheel Assembly,BIKE-001,Mountain Bike Pro,1,1,BIKE-001>WHEEL-R,True
16,2,RIM-002,Alloy Rim 29er,WHEEL-R,Rear Wheel Assembly,1,1,BIKE-001>WHEEL-R>RIM-002,False
17,2,SPOKE-002,Steel Spokes,WHEEL-R,Rear Wheel Assembly,32,32,BIKE-001>WHEEL-R>SPOKE-002,False
18,2,HUB-R,Rear Hub Freehub,WHEEL-R,Rear Wheel Assembly,1,1,BIKE-001>WHEEL-R>HUB-R,True
19,3,BEARING-002,Cartridge Bearing,HUB-R,Rear Hub Freehub,2,2,BIKE-001>WHEEL-R>HUB-R>BEARING-002,False
20,3,FREEHUB-001,Micro Spline Body,HUB-R,Rear Hub Freehub,1,1,BIKE-001>WHEEL-R>HUB-R>FREEHUB-001,False
21,3,CASSETTE-001,12-Speed Cassette,HUB-R,Rear Hub Freehub,1,1,BIKE-001>WHEEL-R>HUB-R>CASSETTE-001,False
22,2,TIRE-002,Trail Tire 29x2.4,WHEEL-R,Rear Wheel Assembly,1,1,BIKE-001>WHEEL-R>TIRE-002,False
23,1,BRAKE-F,Front Disc Brake,BIKE-001,Mountain Bike Pro,1,1,BIKE-001>BRAKE-F,True
24,2,ROTOR-001,203mm Rotor,BRAKE-F,Front Disc Brake,1,1,BIKE-001>BRAKE-F>ROTOR-001,False
25,2,PAD-001,Sintered Brake Pads,BRAKE-F,Front Disc Brake,2,2,BIKE-001>BRAKE-F>PAD-001,False
26,2,CALIPER-001,4-Piston Caliper,BRAKE-F,Front Disc Brake,1,1,BIKE-001>BRAKE-F>CALIPER-001,False
27,2,LEVER-001,Brake Lever,BRAKE-F,Front Disc Brake,1,1,BIKE-001>BRAKE-F>LEVER-001,False
28,2,HOSE-001,Hydraulic Hose,BRAKE-F,Front Disc Brake,1,1,BIKE-001>BRAKE-F>HOSE-001,False
29,1,BRAKE-R,Rear Disc Brake,BIKE-001,Mountain Bike Pro,1,1,BIKE-001>BRAKE-R,True
30,2,ROTOR-002,180mm Rotor,BRAKE-R,Rear Disc Brake,1,1,BIKE-001>BRAKE-R>ROTOR-002,False
31,2,PAD-002,Sintered Brake Pads,BRAKE-R,Rear Disc Brake,2,2,BIKE-001>BRAKE-R>PAD-002,False
32,2,CALIPER-002,2-Piston Caliper,BRAKE-R,Rear Disc Brake,1,1,BIKE-001>BRAKE-R>CALIPER-002,False
33,1,DRIVE-001,Drivetrain Assembly,BIKE-001,Mountain Bike Pro,1,1,BIKE-001>DRIVE-001,True
34,2,CHAIN-001,12-Speed Chain,DRIVE-001,Drivetrain Assembly,1,1,BIKE-001>DRIVE-001>CHAIN-001,False
35,2,CRANK-001,Carbon Crankset,DRIVE-001,Drivetrain Assembly,1,1,BIKE-001>DRIVE-001>CRANK-001,True
36,3,RING-001,32T Chainring,CRANK-001,Carbon Crankset,1,1,BIKE-001>DRIVE-001>CRANK-001>RING-001,False
37,3,BB-001,Press-Fit BB,CRANK-001,Carbon Crankset,1,1,BIKE-001>DRIVE-001>CRANK-001>BB-001,False
38,2,DERAIL-001,Rear Derailleur,DRIVE-001,Drivetrain Assembly,1,1,BIKE-001>DRIVE-001>DERAIL-001,False
39,2,SHIFTER-001,Trigger Shifter,DRIVE-001,Drivetrain Assembly,1,1,BIKE-001>DRIVE-001>SHIFTER-001,False
40,1,FORK-001,Suspension Fork 150mm,BIKE-001,Mountain Bike Pro,1,1,BIKE-001>FORK-001,True
41,2,STANCHION-001,Stanchion 36mm,FORK-001,Suspension Fork 150mm,2,2,BIKE-001>FORK-001>STANCHION-001,False
42,2,DAMPER-001,Charger Damper,FORK-001,Suspension Fork 150mm,1,1,BIKE-001>FORK-001>DAMPER-001,False
43,2,SPRING-001,Air Spring,FORK-001,Suspension Fork 150mm,1,1,BIKE-001>FORK-001>SPRING-001,False
44,2,SEAL-001,Dust Seal Kit,FORK-001,Suspension Fork 150mm,1,1,BIKE-001>FORK-001>SEAL-001,False
45,1,SEAT-001,Dropper Post Assembly,BIKE-001,Mountain Bike Pro,1,1,BIKE-001>SEAT-001,True
46,2,POST-001,Dropper Post 170mm,SEAT-001,Dropper Post Assembly,1,1,BIKE-001>SEAT-001>POST-001,False
47,2,SADDLE-001,Trail Saddle,SEAT-001,Dropper Post Assembly,1,1,BIKE-001>SEAT-001>SADDLE-001,False
48,2,CLAMP-001,Seat Clamp 34.9,SEAT-001,Dropper Post Assembly,1,1,BIKE-001>SEAT-001>CLAMP-001,False
49,1,HBAR-001,Carbon Handlebar,BIKE-001,Mountain Bike Pro,1,1,BIKE-001>HBAR-001,True
50,2,GRIP-001,Lock-On Grips,HBAR-001,Carbon Handlebar,2,2,BIKE-001>HBAR-001>GRIP-001,False
51,2,STEM-001,35mm Stem,HBAR-001,Carbon Handlebar,1,1,BIKE-001>HBAR-001>STEM-001,False
52,2,SPACER-001,Headset Spacer Kit,HBAR-001,Carbon Handlebar,1,1,BIKE-001>HBAR-001>SPACER-001,False`;
