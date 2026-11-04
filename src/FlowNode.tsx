import { Tag } from "@edgeandnode/eds-react"
import { SnowflakeIcon } from "@edgeandnode/eds-react/icons"
import { formatAddress } from "@edgeandnode/eds-utils"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"

import { ROLES } from "./roles.ts"
import type { Role } from "./types.ts"

export type FlowNodeData = {
  address: string
  label: string
  role: Role | undefined
  frozen: boolean
  selected: boolean
  dimmed: boolean
}

export type AddressNode = Node<FlowNodeData, "address">

export const NODE_WIDTH = 224
export const NODE_HEIGHT = 92

const HANDLE_CLASSES = "i:size-2 i:rounded-full i:border i:border-strong i:bg-elevated"

export function FlowNode({ data }: NodeProps<AddressNode>) {
  const role = data.role ? ROLES[data.role] : undefined
  return (
    <div
      data-role={data.role}
      data-selected={data.selected || undefined}
      data-dimmed={data.dimmed || undefined}
      className="
        rounded-8 border-muted bg-subtle hover:border-default data-selected:bg-elevated data-[role=attacker]:border-status-error-default data-[role=binance]:border-status-warning-default data-[role=bridge]:border-brand-default data-[role=exchange]:border-default data-[role=issuer]:border-status-success-default flex
        w-56
        cursor-pointer
        flex-col
        gap-2
        border
        p-3
        transition
        data-dimmed:opacity-40
      "
    >
      <Handle type="target" position={Position.Left} className={HANDLE_CLASSES} />
      <span className="flex items-center gap-2">
        {role ? (
          <Tag size="xsmall" variant={role.tag}>
            {role.name}
          </Tag>
        ) : null}
        {data.frozen ? (
          <Tag size="xsmall" variant="galactic" addonBefore={SnowflakeIcon}>
            Frozen
          </Tag>
        ) : null}
      </span>
      <span className="text-14 truncate">{data.label}</span>
      <span className="text-12 text-muted font-mono">{formatAddress(data.address)}</span>
      <Handle type="source" position={Position.Right} className={HANDLE_CLASSES} />
    </div>
  )
}
