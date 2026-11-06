import { Status, Tag } from "@edgeandnode/eds-react"

import { formatAmount, formatBlock, formatTime, formatUsd } from "./format.ts"
import { ISSUERS } from "./freezes.ts"
import type { LiveEvent } from "./liveStream.ts"
import { labelFor } from "./roles.ts"
import type { StreamFreeze } from "./stream.ts"
import { TokenAmount } from "./TokenAmount.tsx"

export function freezeTitle(event: StreamFreeze) {
  const issuer = ISSUERS[event.token] ?? event.token
  if (event.action === "unfreeze") return `${issuer} unfroze ${event.token}`
  if (event.action === "seize" && event.amount !== null)
    return `${issuer} seized ${formatAmount(Number(event.amount))} ${event.token}`
  return `${issuer} ${event.action === "seize" ? "seized" : "froze"} ${event.token}`
}

export function LiveEventRow({ event, route = false }: { event: LiveEvent; route?: boolean }) {
  return (
    <span className="flex min-w-0 flex-col gap-1">
      {event.kind === "transfer" ? (
        <span className="text-14 flex flex-wrap items-center gap-x-2 gap-y-1">
          <TokenAmount symbol={event.token} amount={Number(event.amount)} />
          {event.amount_usd !== undefined ? (
            <span className="text-muted">{formatUsd(Number(event.amount_usd))}</span>
          ) : null}
        </span>
      ) : (
        <span className="text-14 flex flex-wrap items-center gap-2">
          <Status variant={event.action === "unfreeze" ? "default" : "info"}>{freezeTitle(event)}</Status>
          {event.watched ? null : (
            <Tag size="xsmall" variant="muted">
              Not a watched wallet
            </Tag>
          )}
        </span>
      )}
      {event.kind === "freeze" ? (
        <span className="text-12 text-muted truncate">{labelFor(event.address)}</span>
      ) : route ? (
        <span className="text-12 text-muted truncate">
          {labelFor(event.from)} to {labelFor(event.to)}
        </span>
      ) : null}
      <span className="text-12 text-muted">
        Block {formatBlock(event.block_num)} · {formatTime(event.ts)}
      </span>
    </span>
  )
}
