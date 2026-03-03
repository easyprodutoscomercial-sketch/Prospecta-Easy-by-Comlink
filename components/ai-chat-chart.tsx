'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface DataItem { name: string; value: number; color?: string }

interface FlowNode { id: string; label: string; type: 'start' | 'decision' | 'action' | 'end' }
interface FlowEdge { from: string; to: string; label?: string }

export type ChartBlock =
  | { chart_type: 'pie' | 'bar' | 'funnel'; title: string; data: DataItem[] }
  | { chart_type: 'flowchart'; title: string; nodes: FlowNode[]; edges: FlowEdge[] };

const DEFAULT_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#a3a3a3', '#14b8a6',
];

function getColor(index: number, color?: string) {
  return color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

function PieChartView({ data }: { data: DataItem[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0" style={{ width: 120, height: 120 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={55}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={getColor(i, entry.color)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        {data.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px]">
            <span
              className="shrink-0 w-2 h-2 rounded-full"
              style={{ backgroundColor: getColor(i, entry.color) }}
            />
            <span className="text-purple-200/70 truncate">{entry.name}</span>
            <span className="text-white font-medium ml-auto">{entry.value}</span>
            {total > 0 && (
              <span className="text-purple-400/50 text-[10px]">
                {((entry.value / total) * 100).toFixed(0)}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChartView({ data }: { data: DataItem[] }) {
  return (
    <div style={{ width: '100%', height: Math.max(data.length * 32 + 20, 80) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 10, top: 4, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fill: '#c4b5fd', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e0f35',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {data.map((entry, i) => (
              <Cell key={i} fill={getColor(i, entry.color)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function FunnelView({ data }: { data: DataItem[] }) {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="flex flex-col gap-1.5">
      {data.map((entry, i) => {
        const pct = (entry.value / maxValue) * 100;
        const color = getColor(i, entry.color);
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[11px] text-purple-200/70 w-[90px] truncate text-right">
              {entry.name}
            </span>
            <div className="flex-1 h-5 bg-purple-900/30 rounded-md overflow-hidden relative">
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: color }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-medium">
                {entry.value} ({pct.toFixed(0)}%)
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Flowchart ---

interface LayoutNode extends FlowNode {
  col: number;
  row: number;
}

function topoSort(nodes: FlowNode[], edges: FlowEdge[]): string[] {
  const inDeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    inDeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    adj.get(e.from)?.push(e.to);
    inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
  }
  const queue: string[] = [];
  for (const [id, deg] of inDeg) if (deg === 0) queue.push(id);
  const order: string[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    order.push(cur);
    for (const next of adj.get(cur) || []) {
      inDeg.set(next, (inDeg.get(next) || 0) - 1);
      if (inDeg.get(next) === 0) queue.push(next);
    }
  }
  // append any remaining (cycles)
  for (const n of nodes) if (!order.includes(n.id)) order.push(n.id);
  return order;
}

function layoutNodes(nodes: FlowNode[], edges: FlowEdge[]): LayoutNode[] {
  const order = topoSort(nodes, edges);
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const childrenOf = new Map<string, string[]>();
  for (const e of edges) {
    const list = childrenOf.get(e.from) || [];
    list.push(e.to);
    childrenOf.set(e.from, list);
  }

  const placed = new Map<string, { row: number; col: number }>();
  let currentRow = 0;

  for (const id of order) {
    if (placed.has(id)) continue;
    const node = nodeMap.get(id);
    if (!node) continue;

    const children = (childrenOf.get(id) || []).filter(cid => !placed.has(cid));

    // Decision nodes with 2 children: place children side by side on next row
    if (node.type === 'decision' && children.length === 2) {
      placed.set(id, { row: currentRow, col: 1 });
      currentRow++;
      placed.set(children[0], { row: currentRow, col: 0 });
      placed.set(children[1], { row: currentRow, col: 2 });
      currentRow++;
    } else {
      placed.set(id, { row: currentRow, col: 1 });
      currentRow++;
    }
  }

  return nodes.map(n => {
    const pos = placed.get(n.id) || { row: 0, col: 1 };
    return { ...n, row: pos.row, col: pos.col };
  });
}

const NODE_W = 140;
const NODE_H = 40;
const COL_GAP = 160;
const ROW_GAP = 70;
const COLS = [0, 1, 2];

function nodeCenter(n: LayoutNode) {
  const x = n.col * COL_GAP + COL_GAP / 2;
  const y = n.row * ROW_GAP + ROW_GAP / 2;
  return { x, y };
}

function NodeShape({ node }: { node: LayoutNode }) {
  const { x, y } = nodeCenter(node);
  const left = x - NODE_W / 2;
  const top = y - NODE_H / 2;

  const base = 'absolute flex items-center justify-center text-[10px] font-medium leading-tight text-center px-1';

  if (node.type === 'start') {
    return (
      <div
        className={`${base} rounded-full border-2 border-emerald-500 bg-emerald-500/20 text-emerald-300`}
        style={{ left, top, width: NODE_W, height: NODE_H }}
      >
        {node.label}
      </div>
    );
  }
  if (node.type === 'end') {
    return (
      <div
        className={`${base} rounded-full border-2 border-red-500 bg-red-500/20 text-red-300`}
        style={{ left, top, width: NODE_W, height: NODE_H }}
      >
        {node.label}
      </div>
    );
  }
  if (node.type === 'decision') {
    const size = NODE_H + 4;
    return (
      <div
        className="absolute flex items-center justify-center"
        style={{ left: x - size / 2, top: y - size / 2, width: size, height: size }}
      >
        <div
          className="absolute inset-0 border-2 border-yellow-500 bg-yellow-500/20 rounded-md"
          style={{ transform: 'rotate(45deg)' }}
        />
        <span className="relative z-10 text-[9px] font-medium text-yellow-300 leading-tight text-center px-1 max-w-[60px]">
          {node.label}
        </span>
      </div>
    );
  }
  // action
  return (
    <div
      className={`${base} rounded-lg border-2 border-blue-500 bg-blue-500/20 text-blue-300`}
      style={{ left, top, width: NODE_W, height: NODE_H }}
    >
      {node.label}
    </div>
  );
}

function FlowchartView({ nodes, edges }: { nodes: FlowNode[]; edges: FlowEdge[] }) {
  const layout = useMemo(() => layoutNodes(nodes, edges), [nodes, edges]);
  const nodeMap = useMemo(() => new Map(layout.map(n => [n.id, n])), [layout]);

  const maxRow = Math.max(...layout.map(n => n.row), 0);
  const maxCol = Math.max(...layout.map(n => n.col), ...COLS.slice(0, 1));
  const svgW = (maxCol + 1) * COL_GAP;
  const svgH = (maxRow + 1) * ROW_GAP;

  return (
    <div className="overflow-x-auto">
      <div className="relative" style={{ width: svgW, height: svgH, minHeight: 80 }}>
        {/* Edges */}
        <svg className="absolute inset-0" width={svgW} height={svgH} style={{ pointerEvents: 'none' }}>
          <defs>
            <marker id="fc-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6" fill="none" stroke="#a78bfa" strokeWidth="1.5" />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const from = nodeMap.get(e.from);
            const to = nodeMap.get(e.to);
            if (!from || !to) return null;
            const fc = nodeCenter(from);
            const tc = nodeCenter(to);

            // Determine source/target attachment points
            let x1 = fc.x, y1 = fc.y, x2 = tc.x, y2 = tc.y;

            if (from.row === to.row) {
              // horizontal
              x1 = fc.x + (tc.x > fc.x ? NODE_W / 2 : -NODE_W / 2);
              y1 = fc.y;
              x2 = tc.x + (tc.x > fc.x ? -NODE_W / 2 : NODE_W / 2);
              y2 = tc.y;
            } else {
              // vertical (or diagonal)
              y1 = fc.y + NODE_H / 2;
              y2 = tc.y - NODE_H / 2;
            }

            const midY = (y1 + y2) / 2;

            // path: use a simple elbow if not straight column
            let d: string;
            if (Math.abs(x1 - x2) < 4) {
              d = `M${x1},${y1} L${x2},${y2}`;
            } else {
              d = `M${x1},${y1} L${x1},${midY} L${x2},${midY} L${x2},${y2}`;
            }

            const labelX = (x1 + x2) / 2;
            const labelY = Math.abs(x1 - x2) < 4 ? (y1 + y2) / 2 - 6 : midY - 6;

            return (
              <g key={i}>
                <path d={d} fill="none" stroke="#a78bfa" strokeWidth="1.5" markerEnd="url(#fc-arrow)" />
                {e.label && (
                  <text x={labelX} y={labelY} textAnchor="middle" fill="#c4b5fd" fontSize="9" fontWeight="500">
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {layout.map(n => (
          <NodeShape key={n.id} node={n} />
        ))}
      </div>
    </div>
  );
}

// --- Main component ---

export default function ChatChart({ chart }: { chart: ChartBlock }) {
  if (chart.chart_type === 'flowchart') {
    if (!chart.nodes || chart.nodes.length === 0) return null;
    return (
      <div className="my-2 bg-[#1e0f35]/60 border border-purple-500/20 rounded-xl p-3">
        <p className="text-[11px] font-semibold text-purple-200/80 mb-2">{chart.title}</p>
        <FlowchartView nodes={chart.nodes} edges={chart.edges || []} />
      </div>
    );
  }

  const filteredData = chart.data.filter(d => d.value > 0 || chart.chart_type === 'funnel');

  if (filteredData.length === 0) {
    return null;
  }

  return (
    <div className="my-2 bg-[#1e0f35]/60 border border-purple-500/20 rounded-xl p-3">
      <p className="text-[11px] font-semibold text-purple-200/80 mb-2">{chart.title}</p>
      {chart.chart_type === 'pie' && <PieChartView data={filteredData} />}
      {chart.chart_type === 'bar' && <BarChartView data={filteredData} />}
      {chart.chart_type === 'funnel' && <FunnelView data={filteredData} />}
    </div>
  );
}
