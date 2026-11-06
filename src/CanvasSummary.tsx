import { Button, Tag } from "@edgeandnode/eds-react"
import { CaretDownIcon, CaretUpIcon } from "@edgeandnode/eds-react/icons"
import type { Node } from "@xyflow/react"

import type { CanvasNodeData } from "./canvasLayout.ts"
import { isVisible } from "./canvasState.ts"
import { tokenColor } from "./FlowEdge.tsx"
import { formatBlock, formatUsd } from "./format.ts"
import { DATASET_NAME, frozenAddresses } from "./freezes.ts"
import type { Incident } from "./incident.ts"
import type { LiveFrozen } from "./liveGraph.ts"
import { HACK_END_BLOCK, LIVE_DATASET, type LiveMode } from "./liveStream.ts"
import { SourceLabel } from "./SourceLabel.tsx"
import { TokenMark } from "./TokenAmount.tsx"

const LEGEND = ["USDT", "USDC", "ETH"]

interface CanvasSummaryProps {
  incident: Incident
  nodes: Array<Node<CanvasNodeData>>
  time: string
  selected: string | null
  onFocus: (id: string | null) => void
  liveFrozen: LiveFrozen | null
  quiet: { mode: LiveMode; small: number } | null
  collapsed: boolean | null
  onToggle: () => void
}

const attackerFreezes = frozenAddresses.filter((f) => !f.binance).flatMap((f) => f.tokens)

export function CanvasSummary({
  incident,
  nodes,
  time,
  selected,
  onFocus,
  liveFrozen,
  quiet,
  collapsed,
  onToggle,
}: CanvasSummaryProps) {
  const kindOf = new Map(incident.flow.nodes.map((node) => [node.id, node.kind]))
  let taken = 0
  for (const link of incident.flow.links) {
    if (isVisible(link.firstTs, time) && kindOf.get(link.source) === "binance") taken += link.value
  }
  let frozen = attackerFreezes.filter((t) => t.ts <= time).reduce((sum, t) => sum + (t.usd ?? 0), 0)
  const newFrozen = liveFrozen && liveFrozen.events.length > 0 ? liveFrozen : null
  frozen += newFrozen?.usd ?? 0
  const share = incident.taken > 0 ? frozen / incident.taken : 0

  const largest = (kind: string) =>
    nodes.filter((node) => node.data.kind === kind).sort((a, b) => b.data.value - a.data.value)[0]
  const landed = largest("attacker")
  const stopped = largest("frozen")
  const away = largest("held")
  const notFrozen = Math.max(0, incident.taken - incident.frozen)
  const steps = [
    landed && { node: landed, title: "Where it landed", detail: formatUsd(landed.data.value) },
    stopped && { node: stopped, title: "What issuers froze", detail: formatUsd(incident.frozen) },
    away && {
      node: away,
      title: "Not frozen on chain",
      detail: `${formatUsd(notFrozen)}, of which ${formatUsd(away.data.value)} is still in attacker wallets`,
    },
  ].filter((step) => !!step)

  const focusOn = (id: string) => onFocus(selected === id ? null : id)
  const headline = `${taken > 0 ? `${formatUsd(taken)} left Binance.` : "Nothing has left Binance yet."} ${
    frozen > 0 ? `Issuers froze ${formatUsd(frozen)}.` : taken > 0 ? "No freezes yet." : ""
  }`
  const toggle =
    collapsed === null ? null : (
      <Button
        variant="tertiary"
        size="small"
        addonBefore={collapsed ? CaretDownIcon : CaretUpIcon}
        hideLabel
        className="shrink-0"
        onClick={onToggle}
      >
        {collapsed ? "Show summary" : "Hide summary"}
      </Button>
    )

  if (collapsed) {
    return (
      <div className="rounded-8 border-muted bg-subtle flex max-w-88 items-center gap-2 border py-1 ps-3 pe-1">
        <p className="text-14 font-medium">{headline}</p>
        {toggle}
      </div>
    )
  }

  return (
    <div className="rounded-8 border-muted bg-subtle flex w-88 flex-col gap-4 border p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-20 font-medium text-balance">{headline}</p>
          {toggle}
        </div>
        <p className="text-12 text-muted flex flex-wrap items-center gap-2">
          Ethereum
          <SourceLabel source="amp" detail="Transfers out of the Binance wallets" />
          <SourceLabel source="dataset" detail={`Freeze events and amounts from ${DATASET_NAME}`} />
        </p>
        {quiet ? (
          <p className="text-12 text-muted">
            {quiet.mode === "connecting" ? "Connecting to the stream" : "Nothing new"} after block{" "}
            {formatBlock(HACK_END_BLOCK)}
            {quiet.small > 0 ? `, ${quiet.small} small ${quiet.small === 1 ? "transfer" : "transfers"} hidden` : ""}
          </p>
        ) : null}
        {newFrozen ? (
          <p className="text-12 text-muted flex flex-wrap items-center gap-2">
            <Tag size="xsmall" variant="brand">
              New
            </Tag>
            {newFrozen.usd > 0
              ? `${formatUsd(newFrozen.usd)} frozen after the hack window`
              : `${newFrozen.events.length} new ${newFrozen.events.length === 1 ? "freeze" : "freezes"}`}
            <SourceLabel source="dataset" detail={`Freeze events streamed from ${LIVE_DATASET}`} />
          </p>
        ) : null}
        <div role="img" aria-label="Share frozen" className="bg-strong flex h-2 overflow-clip rounded-full">
          <div className="bg-status-info-default h-full transition-[width]" style={{ width: `${share * 100}%` }} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-caption text-10 text-muted">Start here</p>
        <ol className="flex flex-col">
          {steps.map((step, index) => (
            <li key={step.node.id}>
              <button
                type="button"
                data-selected={selected === step.node.id || undefined}
                onClick={() => focusOn(step.node.id)}
                className="rounded-6 hover:bg-muted data-selected:bg-default flex w-full items-start gap-3 px-2 py-2 text-start"
              >
                <span className="border-default text-12 flex size-5 shrink-0 items-center justify-center rounded-full border">
                  {index + 1}
                </span>
                <span className="flex flex-col">
                  <span className="text-14">{step.title}</span>
                  <span className="text-12 text-muted">{step.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <ul className="text-12 text-muted flex flex-wrap gap-x-3 gap-y-1">
        {LEGEND.map((token) => (
          <li key={token} className="flex items-center gap-1">
            <span className="h-0.5 w-3 rounded-full" style={{ background: tokenColor(token) }} />
            <TokenMark symbol={token} size={12} />
            {token}
          </li>
        ))}
        <li className="flex items-center gap-1">
          <span className="h-0.5 w-3 rounded-full" style={{ background: tokenColor("other") }} />
          Other
        </li>
      </ul>
    </div>
  )
}
