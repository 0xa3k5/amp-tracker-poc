import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { Button, SegmentedControl } from "@edgeandnode/eds-react"
import { useEDS } from "@edgeandnode/eds-react/hooks"
import { PlayIcon } from "@edgeandnode/eds-react/icons"
import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react"

import { canvasLayout, type LayoutMode } from "./canvasLayout.ts"
import { CanvasStateContext } from "./canvasState.ts"
import { CanvasSummary } from "./CanvasSummary.tsx"
import { useOpenDetails } from "./details.ts"
import { FlowEdge, type FlowCanvasEdge } from "./FlowEdge.tsx"
import type { Incident } from "./incident.ts"
import { Scrubber } from "./Scrubber.tsx"
import { storySteps } from "./story.ts"
import { StoryPlayer } from "./StoryPlayer.tsx"
import { STEPS, timeScale } from "./timeScale.ts"
import { WalletNode, type WalletCanvasNode } from "./WalletNode.tsx"

import "@xyflow/react/dist/style.css"

const NODE_TYPES: NodeTypes = { wallet: WalletNode }
const EDGE_TYPES: EdgeTypes = { flow: FlowEdge }

const FLOW_STYLE = {
  "--xy-background-color": "var(--background-color-canvas)",
  "--xy-controls-button-background-color": "var(--background-color-subtle)",
  "--xy-controls-button-background-color-hover": "var(--background-color-elevated)",
  "--xy-controls-button-color": "var(--text-color-muted)",
  "--xy-controls-button-color-hover": "var(--text-color-default)",
  "--xy-controls-button-border-color": "var(--border-color-muted)",
  "--xy-node-border-radius": "8px",
} as CSSProperties

function Canvas({ incident }: { incident: Incident }) {
  const open = useOpenDetails()
  const flow = useReactFlow()
  const { activeTheme } = useEDS()

  const scale = useMemo(() => {
    const times = incident.flow.links
      .map((link) => link.firstTs)
      .filter(Boolean)
      .sort()
    return timeScale(times[0] ?? incident.window?.fromTs ?? "", incident.window?.toTs ?? times.at(-1) ?? "")
  }, [incident])

  const [mode, setMode] = useState<LayoutMode>("hops")
  const [expanded, setExpanded] = useState(false)
  const layout = useMemo(() => canvasLayout(incident, { mode, expanded, scale }), [incident, mode, expanded, scale])

  const [nodes, setNodes, onNodesChange] = useNodesState<WalletCanvasNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowCanvasEdge>([])
  useEffect(() => {
    setNodes(layout.nodes.map((node) => ({ ...node, type: "wallet" })))
    setEdges(layout.edges.map((edge) => ({ ...edge, type: "flow" })))
    const timer = setTimeout(() => void flow.fitView({ padding: 0.08, duration: 500 }), 60)
    return () => clearTimeout(timer)
  }, [layout, setNodes, setEdges, flow])

  const [step, setStep] = useState(STEPS)
  const onStepChange = useCallback((next: number) => setStep(next), [])
  const time = scale.toTime(step)

  const [selected, setSelected] = useState<string | null>(null)
  const focus = useMemo(() => {
    if (!selected) return null
    const set = new Set([selected])
    for (const edge of layout.edges) {
      if (edge.source === selected) set.add(edge.target)
      if (edge.target === selected) set.add(edge.source)
    }
    return set
  }, [layout, selected])

  const steps = useMemo(() => storySteps(incident), [incident])
  const [storyIndex, setStoryIndex] = useState<number | null>(null)

  const state = useMemo(() => ({ time, focus, selected }), [time, focus, selected])

  return (
    <CanvasStateContext value={state}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        colorMode={activeTheme}
        minZoom={0.1}
        nodesConnectable={false}
        edgesFocusable={false}
        onNodeClick={(_event, node) => {
          setSelected(node.id === selected ? null : node.id)
          if (node.data.address) open({ kind: "address", address: node.data.address })
          else if (node.data.kind === "frozen") open({ kind: "frozen" })
        }}
        onPaneClick={() => setSelected(null)}
        proOptions={{ hideAttribution: true }}
        style={FLOW_STYLE}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="var(--border-color-default)" />
        <Controls showInteractive={false} position="bottom-right" />
        <Panel position="top-left">
          <CanvasSummary
            incident={incident}
            nodes={nodes}
            edges={edges}
            time={time}
            selected={selected}
            onSelect={setSelected}
          />
        </Panel>
        <Panel position="top-right">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="primary"
              size="small"
              addonBefore={PlayIcon}
              disabled={storyIndex !== null}
              onClick={() => {
                setStep(0)
                setStoryIndex(0)
              }}
            >
              Play story
            </Button>
            <SegmentedControl
              size="small"
              aria-label="Layout"
              value={mode}
              onValueChange={(value) => setMode(value as LayoutMode)}
            >
              <SegmentedControl.Option value="hops">By hop</SegmentedControl.Option>
              <SegmentedControl.Option value="time">By time</SegmentedControl.Option>
            </SegmentedControl>
            <Button variant="secondary" size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Hide smaller wallets" : `Show ${layout.minorCount} smaller wallets`}
            </Button>
          </div>
        </Panel>
        {storyIndex !== null ? (
          <StoryPlayer
            steps={steps}
            index={storyIndex}
            scale={scale}
            step={step}
            onIndexChange={setStoryIndex}
            onStepChange={onStepChange}
            onSelect={setSelected}
          />
        ) : null}
        <Panel position="bottom-center">
          <Scrubber scale={scale} step={step} moments={incident.moments} onStepChange={onStepChange} />
        </Panel>
      </ReactFlow>
    </CanvasStateContext>
  )
}

export function CanvasView({ incident }: { incident: Incident }) {
  return (
    <div className="relative min-h-0 flex-1">
      <ReactFlowProvider>
        <Canvas incident={incident} />
      </ReactFlowProvider>
    </div>
  )
}
