import { useMemo, type CSSProperties } from "react"
import dagre from "@dagrejs/dagre"
import { Card } from "@edgeandnode/eds-react"
import { useEDS } from "@edgeandnode/eds-react/hooks"
import { cn } from "@edgeandnode/eds-react/utils"
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type NodeTypes,
} from "@xyflow/react"

import { addressBook } from "./data.ts"
import { FlowNode, NODE_HEIGHT, NODE_WIDTH, type AddressNode } from "./FlowNode.tsx"
import { formatAmount } from "./format.ts"
import { fullLabel, labelFor } from "./roles.ts"
import type { FlowEdge, Trace, TraceNode } from "./trace.ts"

import "@xyflow/react/dist/style.css"

const NODE_TYPES: NodeTypes = { address: FlowNode }

const FLOW_STYLE = {
  "--xy-background-color": "var(--background-color-canvas)",
  "--xy-edge-stroke": "var(--border-color-elevated)",
  "--xy-edge-label-color": "var(--text-color-muted)",
  "--xy-edge-label-background-color": "var(--background-color-canvas)",
  "--xy-controls-button-background-color": "var(--background-color-subtle)",
  "--xy-controls-button-background-color-hover": "var(--background-color-elevated)",
  "--xy-controls-button-color": "var(--text-color-muted)",
  "--xy-controls-button-color-hover": "var(--text-color-default)",
  "--xy-controls-button-border-color": "var(--border-color-muted)",
} as CSSProperties

interface FlowGraphProps {
  trace: Trace
  selected: string | null
  onSelect: (address: string | null) => void
  className?: string
}

function layout(trace: Trace) {
  const graph = new dagre.graphlib.Graph()
  graph.setGraph({ rankdir: "LR", nodesep: 32, ranksep: 140 })
  graph.setDefaultEdgeLabel(() => ({}))
  for (const node of trace.nodes) graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  for (const edge of trace.edges) graph.setEdge(edge.from, edge.to)
  dagre.layout(graph)
  return new Map(
    trace.nodes.map((node) => {
      const { x, y } = graph.node(node.id)
      return [node.id, { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 }]
    }),
  )
}

function edgeLabel(edge: FlowEdge) {
  const tokens = [...edge.tokens].sort((a, b) => b[1].usd - a[1].usd || b[1].amount - a[1].amount)
  const shown = tokens.slice(0, 2).map(([token, { amount }]) => `${formatAmount(amount)} ${token}`)
  return tokens.length > 2 ? `${shown.join(", ")} +${tokens.length - 2}` : shown.join(", ")
}

function nodeData(trace: Trace, node: TraceNode) {
  if (node.group) {
    const parent = node.id.slice(node.group.length + 1)
    const count = node.members.length
    return {
      address: null,
      label: `${count} ${node.group === "out" ? "recipients" : "senders"}`,
      title: `${count} unlabelled addresses that only ${node.group === "out" ? "received from" : "sent to"} ${labelFor(parent)}`,
      role: undefined,
      frozen: false,
      count,
    }
  }
  const address = node.members[0]!
  return {
    address,
    label: labelFor(address),
    title: fullLabel(address) ?? address,
    role: addressBook.get(address)?.role,
    frozen: trace.frozen.has(address),
    count: 1,
  }
}

export function FlowGraph({ trace, selected, onSelect, className }: FlowGraphProps) {
  const { activeTheme } = useEDS()
  const positions = useMemo(() => layout(trace), [trace])

  const neighbours = useMemo(() => {
    if (!selected) return null
    const set = new Set([selected])
    for (const edge of trace.edges) {
      if (edge.from === selected) set.add(edge.to)
      if (edge.to === selected) set.add(edge.from)
    }
    return set
  }, [trace, selected])

  const focus = useMemo(() => {
    const ids = new Set([trace.root])
    for (const edge of trace.edges) {
      if (edge.from === trace.root) ids.add(edge.to)
      if (edge.to === trace.root) ids.add(edge.from)
    }
    return [...ids].map((id) => ({ id }))
  }, [trace])

  const nodes: Array<AddressNode> = trace.nodes.map((node) => ({
    id: node.id,
    type: "address",
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    data: {
      ...nodeData(trace, node),
      root: node.id === trace.root,
      selected: node.id === selected,
      dimmed: neighbours !== null && !neighbours.has(node.id),
    },
  }))

  const maxUsd = Math.max(1, ...trace.edges.map((edge) => edge.usd))
  const edges: Array<Edge> = trace.edges.map((edge) => {
    const active = selected !== null && (edge.from === selected || edge.to === selected)
    const stroke = active ? "var(--border-color-brand-default)" : "var(--border-color-elevated)"
    return {
      id: `${edge.from}>${edge.to}`,
      source: edge.from,
      target: edge.to,
      label: edgeLabel(edge),
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
      style: { stroke, strokeWidth: 1 + 7 * Math.sqrt(edge.usd / maxUsd) },
      zIndex: active ? 1 : 0,
    }
  })

  return (
    <Card
      variant="tertiary"
      as="section"
      aria-label="Fund flow"
      className={cn("var-[padding=0] overflow-clip", className)}
    >
      <ReactFlow
        key={trace.root}
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        colorMode={activeTheme}
        fitView
        fitViewOptions={{ padding: 0.15, nodes: focus }}
        minZoom={0.05}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        onNodeClick={(_event, node) => onSelect(node.id === selected ? null : node.id)}
        onPaneClick={() => onSelect(null)}
        proOptions={{ hideAttribution: true }}
        style={FLOW_STYLE}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="var(--border-color-default)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </Card>
  )
}
