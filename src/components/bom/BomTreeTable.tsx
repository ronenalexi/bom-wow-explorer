import React, { useState, useCallback, useMemo } from 'react';
import type { TreeData, BomRow } from '@/lib/bom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronRight, ChevronDown, Minus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  tree: TreeData;
  rootSeq: string;
  onSelect: (seq: string) => void;
  selectedNode: string | null;
}

interface FlatRow {
  row: BomRow;
  depth: number;
  hasChildren: boolean;
}

export default function BomTreeTable({ tree, rootSeq, onSelect, selectedNode }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([rootSeq]));

  const toggleExpand = useCallback((seq: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(seq)) {
        // Collapse: remove this and all descendants
        next.delete(seq);
        const removeDesc = (s: string) => {
          const children = tree.childrenMap.get(s) || [];
          for (const c of children) { next.delete(c.Seq); removeDesc(c.Seq); }
        };
        removeDesc(seq);
      } else {
        next.add(seq);
      }
      return next;
    });
  }, [tree]);

  // Flatten the tree based on expanded state
  const flatRows = useMemo(() => {
    const result: FlatRow[] = [];
    const rootRow = tree.rowBySeq.get(rootSeq);
    if (!rootRow) return result;

    const walk = (seq: string, depth: number) => {
      const row = tree.rowBySeq.get(seq);
      if (!row) return;
      const children = tree.childrenMap.get(seq) || [];
      result.push({ row, depth, hasChildren: children.length > 0 });
      if (expanded.has(seq)) {
        for (const child of children) {
          walk(child.Seq, depth + 1);
        }
      }
    };

    walk(rootSeq, 0);
    return result;
  }, [tree, rootSeq, expanded]);

  const INDENT = 24;

  return (
    <ScrollArea className="h-full w-full">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-[40%] text-xs">Item</TableHead>
            <TableHead className="text-xs">Description</TableHead>
            <TableHead className="text-xs w-20 text-right">Qty</TableHead>
            <TableHead className="text-xs w-20 text-right">Cum Qty</TableHead>
            <TableHead className="text-xs w-16 text-center">Level</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {flatRows.map(({ row, depth, hasChildren }) => {
            const isSelected = row.Seq === selectedNode;
            return (
              <TableRow
                key={row.Seq}
                className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/40'}`}
                onClick={() => onSelect(row.Seq)}
              >
                <TableCell className="py-1.5">
                  <div className="flex items-center" style={{ paddingLeft: depth * INDENT }}>
                    {/* Connector lines */}
                    {depth > 0 && (
                      <div className="flex items-center mr-1">
                        {Array.from({ length: depth }).map((_, i) => (
                          <div key={i} className="w-[1px] h-6 bg-border mx-[3px]" />
                        ))}
                      </div>
                    )}
                    {/* Expand/collapse */}
                    <button
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-accent shrink-0 mr-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) toggleExpand(row.Seq);
                      }}
                    >
                      {hasChildren ? (
                        expanded.has(row.Seq) ? (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        )
                      ) : (
                        <Minus className="w-2.5 h-2.5 text-border" />
                      )}
                    </button>
                    <span className="font-mono text-xs text-foreground font-medium">{row.Item}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground py-1.5 truncate max-w-[200px]">
                  {row.ItemDesc}
                </TableCell>
                <TableCell className="text-xs text-foreground py-1.5 text-right font-mono">
                  {row.QtyPerParent}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground py-1.5 text-right font-mono">
                  {row.CumQty || '-'}
                </TableCell>
                <TableCell className="text-xs text-center py-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">
                    {row.Level}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
