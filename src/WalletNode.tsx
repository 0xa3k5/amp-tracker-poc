import { Status, Tag, type TagProps } from "@edgeandnode/eds-react"
import { formatAddress } from "@edgeandnode/eds-utils"
import { ExchangeBinance, ExchangeUniswap, TokenAAVE, TokenUSDT } from "@web3icons/react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"

import type { CanvasNodeData } from "./canvasLayout.ts"
import { isVisible, useCanvasState } from "./canvasState.ts"
import { formatUsd } from "./format.ts"
import type { FlowKind } from "./incident.ts"

export type WalletCanvasNode = Node<CanvasNodeData, "wallet">

const KIND: Record<FlowKind, { name: string; tag: TagProps["variant"] }> = {
  binance: { name: "Binance", tag: "solar" },
  attacker: { name: "Attacker", tag: "sonja" },
  hop: { name: "Intermediary", tag: "muted" },
  frozen: { name: "Frozen", tag: "galactic" },
  held: { name: "Not frozen", tag: "sonja" },
  unlabelled: { name: "Unlabelled", tag: "muted" },
  defi: { name: "DEX or lending", tag: "elevated" },
}

const HANDLE = "i:opacity-0 i:pointer-events-none"

function Logo({ data }: { data: CanvasNodeData }) {
  if (data.kind === "binance") return <ExchangeBinance variant="branded" size={20} />
  if (data.kind === "frozen") return <TokenUSDT variant="branded" size={20} />
  if (/uniswap/i.test(data.label)) return <ExchangeUniswap variant="branded" size={20} />
  if (/aave/i.test(data.label)) return <TokenAAVE variant="branded" size={20} />
  return null
}

export function WalletNode({ data }: NodeProps<WalletCanvasNode>) {
  const { time, focus, selected } = useCanvasState()
  const kind = KIND[data.kind]
  const visible = isVisible(data.firstTs, time)
  const frozenLive = data.kind === "frozen" && visible

  return (
    <div
      title={data.address ?? data.label}
      data-kind={data.kind}
      data-hidden={!visible || undefined}
      data-dimmed={(focus !== null && !focus.has(data.id)) || undefined}
      data-selected={selected === data.id || undefined}
      data-clickable={data.address !== undefined || undefined}
      className="rounded-8 border-muted bg-subtle data-[kind=attacker]:border-status-error-default data-[kind=binance]:border-status-warning-default data-[kind=frozen]:border-status-info-default data-[kind=held]:border-status-error-muted data-selected:bg-elevated data-clickable:hover:border-default flex h-23 w-62 flex-col justify-between gap-1 border px-3 py-2.5 transition-[opacity,background-color] duration-300 data-clickable:cursor-pointer data-dimmed:opacity-25 data-hidden:opacity-10 data-selected:border-2"
    >
      <Handle type="target" position={Position.Left} className={HANDLE} />
      <span className="flex items-center gap-2">
        <Logo data={data} />
        <Tag size="xsmall" variant={kind.tag}>
          {kind.name}
        </Tag>
        {frozenLive ? <Status variant="info">Locked</Status> : null}
      </span>
      <span className="text-14 truncate">{data.label}</span>
      <span className="text-12 text-muted flex justify-between gap-2">
        <span className="font-mono">{data.address ? formatAddress(data.address) : ""}</span>
        <span className="text-default font-medium">{formatUsd(data.value)}</span>
      </span>
      <Handle type="source" position={Position.Right} className={HANDLE} />
    </div>
  )
}
