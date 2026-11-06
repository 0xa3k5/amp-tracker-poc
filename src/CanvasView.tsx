import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { useEDS } from "@edgeandnode/eds-react/hooks"
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
  useStore,
  ViewportPortal,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react"

import { cardBox, focusViewport, inView, startViewport, visibleArea, type Box } from "./canvasFocus.ts"
import { canvasLayout, takeoverIds } from "./canvasLayout.ts"
import { CanvasStateContext } from "./canvasState.ts"
import { CanvasSummary } from "./CanvasSummary.tsx"
import { DelegationEdge, type DelegationCanvasEdge } from "./DelegationEdge.tsx"
import { useOpenDetails } from "./details.ts"
import { FlowEdge, type FlowCanvasEdge } from "./FlowEdge.tsx"
import { formatBlock } from "./format.ts"
import { FreezeNotice } from "./FreezeNotice.tsx"
import { takeover } from "./freezes.ts"
import type { Incident } from "./incident.ts"
import { LiveFeed } from "./LiveFeed.tsx"
import { liveGraph } from "./liveGraph.ts"
import { eventTx, feedEvents, HACK_END_BLOCK, useLive, type LiveEvent } from "./liveStream.ts"
import { Scrubber } from "./Scrubber.tsx"
import { storySteps, unlitSteps } from "./story.ts"
import { StoryPlayer } from "./StoryPlayer.tsx"
import { STEPS, timeScale } from "./timeScale.ts"
import { WalletNode, type WalletCanvasNode } from "./WalletNode.tsx"

import "@xyflow/react/dist/style.css"

const NODE_TYPES: NodeTypes = { wallet: WalletNode }
const EDGE_TYPES: EdgeTypes = { flow: FlowEdge, delegation: DelegationEdge }
const PANEL_MARGIN = 15
const GAP = 8
const MOVE_MS = 600
const REAPPLY_MS = 1200
const CONTROLS_SPACE = 48

const FLOW_STYLE = {
  "--xy-background-color": "var(--background-color-canvas)",
  "--xy-controls-button-background-color": "var(--background-color-subtle)",
  "--xy-controls-button-background-color-hover": "var(--background-color-elevated)",
  "--xy-controls-button-color": "var(--text-color-muted)",
  "--xy-controls-button-color-hover": "var(--text-color-default)",
  "--xy-controls-button-border-color": "var(--border-color-muted)",
  "--xy-node-border-radius": "8px",
} as CSSProperties

export interface Lookup {
  address: string
  at: number
}

interface CanvasProps {
  incident: Incident
  rightInset: number
  lookup: Lookup | null
}

type FocusRequest =
  | { kind: "start" }
  | { kind: "node"; primary: string; others: Array<string> }
  | { kind: "keep"; primary: string }

function Canvas({ incident, rightInset, lookup }: CanvasProps) {
  const open = useOpenDetails()
  const flow = useReactFlow()
  const { activeTheme } = useEDS()
  const width = useStore((s) => s.width)
  const height = useStore((s) => s.height)

  const scale = useMemo(() => {
    const times = incident.flow.links
      .map((link) => link.firstTs)
      .filter(Boolean)
      .sort()
    const first = [takeover?.grant.ts, times[0]].filter((ts) => ts !== undefined).sort()[0]
    return timeScale(first ?? incident.window?.fromTs ?? "", incident.window?.toTs ?? times.at(-1) ?? "")
  }, [incident])

  const layout = useMemo(() => canvasLayout(incident), [incident])

  const [nodes, setNodes, onNodesChange] = useNodesState<WalletCanvasNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowCanvasEdge | DelegationCanvasEdge>([])
  useEffect(() => {
    setNodes(layout.nodes.map((node) => ({ ...node, type: "wallet" })))
    setEdges([
      ...layout.edges.map((edge) => ({ ...edge, type: "flow" as const })),
      ...layout.delegations.map((edge) => ({ ...edge, type: "delegation" as const })),
    ])
  }, [layout, setNodes, setEdges])

  const { events, mode } = useLive()
  const feed = useMemo(() => feedEvents(events), [events])
  const liveLayer = useMemo(() => liveGraph(incident, layout.nodes, events), [incident, layout, events])
  useEffect(() => {
    setNodes((current) => [
      ...current.filter((node) => !node.data.live),
      ...liveLayer.nodes.map((node) => ({ ...node, type: "wallet" as const })),
    ])
    setEdges((current) => [
      ...current.filter((edge) => !edge.data?.live),
      ...liveLayer.edges.map((edge) => ({ ...edge, type: "flow" as const })),
    ])
  }, [liveLayer, setNodes, setEdges])

  const [step, setStep] = useState(STEPS)
  const onStepChange = useCallback((next: number) => setStep(next), [])
  const time = scale.toTime(step)

  const steps = useMemo(() => {
    const built = storySteps(incident)
    const unlit = unlitSteps(incident, built)
    if (unlit.length > 0) console.error(`Story steps that light no card: ${unlit.join("; ")}`)
    return built
  }, [incident])
  const [storyIndex, setStoryIndex] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)
  const playing = storyIndex !== null && !paused
  const lit = useMemo(() => (storyIndex === null ? null : new Set(steps[storyIndex]?.nodeIds)), [steps, storyIndex])

  const showLive = storyIndex === null && step >= STEPS

  const [selected, setSelected] = useState<string | null>(null)
  const [liveFocus, setLiveFocus] = useState<Set<string> | null>(null)

  const neighbours = useCallback(
    (id: string) => {
      const set = new Set([id])
      for (const edge of edges) {
        if (edge.source === id) set.add(edge.target)
        if (edge.target === id) set.add(edge.source)
      }
      return set
    },
    [edges],
  )

  const focus = useMemo(() => {
    if (lit) return lit
    if (liveFocus && showLive) return liveFocus
    if (!selected) return null
    return neighbours(selected)
  }, [selected, lit, liveFocus, showLive, neighbours])

  const state = useMemo(
    () => ({ time, focus, selected, lit, live: showLive, touched: liveLayer.touched }),
    [time, focus, selected, lit, showLive, liveLayer],
  )

  const summaryRef = useRef<HTMLDivElement>(null)
  const storyRef = useRef<HTMLDivElement>(null)
  const scrubberRef = useRef<HTMLDivElement>(null)
  const playingRef = useRef(playing)
  playingRef.current = playing

  const area = useCallback(() => {
    const below = (element: HTMLElement | null) => (element ? element.offsetHeight + PANEL_MARGIN + GAP : 0)
    return visibleArea(width, height, {
      top: storyRef.current ? below(storyRef.current) : PANEL_MARGIN,
      right: rightInset + PANEL_MARGIN,
      bottom: below(scrubberRef.current),
      left: playingRef.current || !summaryRef.current ? 0 : summaryRef.current.offsetWidth + PANEL_MARGIN + GAP,
    })
  }, [width, height, rightInset])

  const boxOf = useCallback(
    (id: string): Box | null => {
      const node = flow.getNode(id)
      return node ? cardBox(node.position) : null
    },
    [flow],
  )

  const lastRequest = useRef<{ request: FocusRequest; at: number } | null>(null)
  const apply = useCallback(
    (request: FocusRequest, duration: number) => {
      if (width === 0 || height === 0) return
      if (request.kind === "start") {
        const boxes = layout.nodes
          .filter((node) => ["binance", "operator", "contract"].includes(node.data.kind))
          .map((node) => cardBox(node.position))
        if (boxes.length > 0) void flow.setViewport(startViewport(boxes, area()), { duration })
        return
      }
      const primary = boxOf(request.primary)
      if (!primary) return
      if (request.kind === "keep" && inView(primary, flow.getViewport(), area())) return
      const others = request.kind === "node" ? request.others.map(boxOf).filter((box) => box !== null) : []
      void flow.setViewport(focusViewport(primary, others, area()), { duration })
    },
    [width, height, layout, flow, area, boxOf],
  )

  const focusOn = useCallback(
    (request: FocusRequest, duration = MOVE_MS) => {
      lastRequest.current = { request, at: performance.now() }
      apply(request, duration)
    },
    [apply],
  )

  const started = useRef(false)
  useEffect(() => {
    if (started.current || width === 0 || nodes.length === 0) return
    started.current = true
    focusOn({ kind: "start" }, 0)
  }, [width, nodes.length, focusOn])

  useEffect(() => {
    const last = lastRequest.current
    if (last && performance.now() - last.at < REAPPLY_MS) apply(last.request, MOVE_MS)
  }, [width, height, rightInset, apply])

  const focusNode = useCallback(
    (id: string | null) => {
      setLiveFocus(null)
      setSelected(id)
      if (id === null) focusOn({ kind: "start" })
      else focusOn({ kind: "node", primary: id, others: [...neighbours(id)].filter((other) => other !== id) })
    },
    [focusOn, neighbours],
  )

  useEffect(() => {
    if (!lookup) return
    const id =
      liveLayer.idFor(lookup.address) ??
      incident.nodeIdFor(lookup.address) ??
      (takeoverIds.includes(lookup.address) ? lookup.address : null)
    if (!id || !flow.getNode(id)) return
    setStoryIndex(null)
    setPaused(false)
    focusNode(id)
  }, [lookup])

  const isInView = useCallback(
    (id: string) => {
      const box = boxOf(id)
      return box !== null && inView(box, flow.getViewport(), area())
    },
    [boxOf, flow, area],
  )

  const focusIds = useCallback(
    (primary: string, others: Array<string>) => focusOn({ kind: "node", primary, others }, 1000),
    [focusOn],
  )

  const pickLive = (event: LiveEvent) => {
    const addresses = event.kind === "transfer" ? [event.from, event.to] : [event.address]
    const ids = addresses.map(liveLayer.idFor).filter((id) => id !== null)
    setStoryIndex(null)
    setPaused(false)
    setStep(STEPS)
    setSelected(null)
    setLiveFocus(ids.length > 0 ? new Set(ids) : null)
    if (ids[0]) focusOn({ kind: "node", primary: ids[0], others: ids.slice(1) })
    open({ kind: "live", hash: eventTx(event) })
  }

  const togglePlay = () => {
    setLiveFocus(null)
    if (storyIndex === null) {
      setStep(0)
      setPaused(false)
      setStoryIndex(0)
    } else setPaused(!paused)
  }
  const changeIndex = useCallback((index: number | null) => {
    setStoryIndex(index)
    if (index === null) setPaused(false)
  }, [])
  const closeStory = useCallback(() => {
    setStoryIndex(null)
    setPaused(false)
    setSelected(null)
    focusOn({ kind: "start" })
  }, [focusOn])

  const quiet = feed.shown.length === 0
  const sideStyle = { right: rightInset } satisfies CSSProperties

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
          setLiveFocus(null)
          setSelected(node.id === selected ? null : node.id)
          lastRequest.current = { request: { kind: "keep", primary: node.id }, at: performance.now() }
          if (node.data.address) open({ kind: "address", address: node.data.address })
          else if (node.data.kind === "frozen") open({ kind: "frozen" })
        }}
        onPaneClick={() => {
          setSelected(null)
          setLiveFocus(null)
        }}
        proOptions={{ hideAttribution: true }}
        style={FLOW_STYLE}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="var(--border-color-default)" />
        <Controls showInteractive={false} position="bottom-right" style={sideStyle} />
        <Panel position="top-left">
          <div
            ref={summaryRef}
            data-hidden={playing || undefined}
            className="flex flex-col gap-3 transition-opacity duration-300 data-hidden:pointer-events-none data-hidden:opacity-0"
            aria-hidden={playing || undefined}
          >
            <CanvasSummary
              incident={incident}
              nodes={nodes}
              time={time}
              selected={selected}
              onFocus={focusNode}
              liveFrozen={showLive ? liveLayer.frozen : null}
              quiet={quiet ? { mode, small: feed.small } : null}
            />
            {quiet ? null : <LiveFeed onPick={pickLive} />}
          </div>
        </Panel>
        {showLive ? (
          <Panel position="top-right" style={sideStyle}>
            <FreezeNotice onPick={pickLive} />
          </Panel>
        ) : null}
        {showLive && liveLayer.column ? (
          <ViewportPortal>
            <div
              className="text-14 text-default absolute flex flex-col"
              style={{ transform: `translate(${liveLayer.column.x}px, ${liveLayer.column.y - 56}px)` }}
            >
              <span className="font-medium">New</span>
              <span className="text-12 text-muted">After block {formatBlock(HACK_END_BLOCK)}</span>
            </div>
          </ViewportPortal>
        ) : null}
        {storyIndex !== null ? (
          <Panel position="top-left" className="pointer-events-none flex justify-center" style={{ right: rightInset }}>
            <StoryPlayer
              ref={storyRef}
              steps={steps}
              index={storyIndex}
              paused={paused}
              scale={scale}
              step={step}
              onIndexChange={changeIndex}
              onStepChange={onStepChange}
              onSelect={setSelected}
              onFocus={focusIds}
              isInView={isInView}
              onClose={closeStory}
            />
          </Panel>
        ) : null}
        <Panel
          position="bottom-left"
          className="pointer-events-none flex justify-center"
          style={{ left: CONTROLS_SPACE, right: rightInset + CONTROLS_SPACE }}
        >
          <Scrubber
            ref={scrubberRef}
            scale={scale}
            step={step}
            moments={incident.moments}
            playing={playing}
            started={storyIndex !== null}
            onPlayToggle={togglePlay}
            onStepChange={onStepChange}
            onPause={() => setPaused(true)}
          />
        </Panel>
      </ReactFlow>
    </CanvasStateContext>
  )
}

export function CanvasView({ incident, rightInset, lookup }: CanvasProps) {
  return (
    <div className="relative min-h-0 flex-1">
      <ReactFlowProvider>
        <Canvas incident={incident} rightInset={rightInset} lookup={lookup} />
      </ReactFlowProvider>
    </div>
  )
}
