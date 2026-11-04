import { Address, Card, Chip, CodeInline, CopyButton, DescriptionList, Status } from "@edgeandnode/eds-react"
import { CaretDownInteractiveIcon, XIcon } from "@edgeandnode/eds-react/icons"
import { cn } from "@edgeandnode/eds-react/utils"

import { addressBook, FREEZE_EVENTS } from "./data.ts"
import { formatAmount, formatBlock, formatTime, shortHash } from "./format.ts"
import { labelFor } from "./roles.ts"
import { isAddress, touches, type Trace } from "./trace.ts"
import type { DecodedEvent, Transaction, Transfer } from "./types.ts"

interface TimelineProps {
  trace: Trace
  selected: string | null
  onClear: () => void
  className?: string
}

function amountSummary(tx: Transaction, txTransfers: Array<Transfer>) {
  const destroyed = tx.events.find((event) => event.name === "DestroyedBlackFunds")?.args._balance
  if (destroyed) return `${formatAmount(Number(destroyed))} USDT destroyed`
  const byToken = new Map<string, number>()
  for (const t of txTransfers) byToken.set(t.token, (byToken.get(t.token) ?? 0) + Number(t.amount))
  const parts = [...byToken].map(([token, amount]) => `${formatAmount(amount)} ${token}`)
  if (parts.length === 0) return Number(tx.value_eth) > 0 ? `${formatAmount(Number(tx.value_eth))} ETH` : null
  return parts.length > 2 ? `${parts.slice(0, 2).join(", ")} +${parts.length - 2}` : parts.join(", ")
}

function ArgValue({ value }: { value: string }) {
  if (isAddress(value)) {
    return (
      <Address address={value} size="small">
        {addressBook.get(value)?.label}
      </Address>
    )
  }
  return <span className="font-mono">{/^\d+$/.test(value) ? formatAmount(Number(value)) : value}</span>
}

function EventItem({ event }: { event: DecodedEvent }) {
  const freeze = FREEZE_EVENTS.has(event.name)
  return (
    <li
      data-freeze={freeze || undefined}
      className="border-muted data-freeze:border-status-info-default flex flex-col gap-2 border-s-2 ps-3"
    >
      <div className="text-14 flex flex-wrap items-center gap-2">
        <span className="font-medium">{event.name}</span>
        <span className="text-12 text-muted">on {labelFor(event.contract)}</span>
      </div>
      <DescriptionList size="small">
        {Object.entries(event.args).map(([name, value]) => (
          <DescriptionList.Item key={name} label={name}>
            <ArgValue value={value} />
          </DescriptionList.Item>
        ))}
      </DescriptionList>
    </li>
  )
}

function TimelineItem({ tx, txTransfers }: { tx: Transaction; txTransfers: Array<Transfer> }) {
  const freeze = tx.events.some((event) => FREEZE_EVENTS.has(event.name))
  const amount = amountSummary(tx, txTransfers)

  return (
    <li className="not-first:border-subtle not-first:border-t">
      <details data-freeze={freeze || undefined} className="group">
        <summary className="hover:bg-muted group-data-freeze:bg-status-info-subtle flex cursor-pointer list-none items-start gap-3 px-4 py-3">
          <span className="text-12 text-muted w-24 shrink-0">{formatTime(tx.ts)}</span>
          <span className="text-14 flex flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              {tx.method ? <CodeInline>{tx.method}</CodeInline> : <span>ETH transfer</span>}
              {freeze ? <Status variant="info">USDT freeze</Status> : null}
            </span>
            <span className="text-12 text-muted truncate">
              {labelFor(tx.from)} to {labelFor(tx.to)}
            </span>
          </span>
          {amount ? <span className="text-14 shrink-0 text-end">{amount}</span> : null}
          <CaretDownInteractiveIcon alt="" className="text-muted h-lh shrink-0" />
        </summary>
        <div className="flex flex-col gap-4 px-4 pt-1 pb-4">
          <DescriptionList size="small">
            <DescriptionList.Item label="Transaction" action={<CopyButton value={tx.hash} />}>
              <CodeInline>{shortHash(tx.hash)}</CodeInline>
            </DescriptionList.Item>
            <DescriptionList.Item label="Block">{formatBlock(tx.block_num)}</DescriptionList.Item>
            <DescriptionList.Item label="From">
              <Address address={tx.from} size="small">
                {addressBook.get(tx.from)?.label}
              </Address>
            </DescriptionList.Item>
            <DescriptionList.Item label="To">
              <Address address={tx.to} size="small">
                {addressBook.get(tx.to)?.label}
              </Address>
            </DescriptionList.Item>
          </DescriptionList>
          {tx.events.length > 0 ? (
            <ul className="flex flex-col gap-4">
              {tx.events.map((event, index) => (
                <EventItem key={index} event={event} />
              ))}
            </ul>
          ) : (
            <p className="text-12 text-muted">No decoded events. Plain ETH transfers emit no logs.</p>
          )}
        </div>
      </details>
    </li>
  )
}

export function Timeline({ trace, selected, onClear, className }: TimelineProps) {
  const transfersByTx = Map.groupBy(trace.transfers, (t) => t.tx_hash)
  const visible = selected
    ? trace.transactions.filter((tx) => touches(tx, transfersByTx.get(tx.hash) ?? [], selected))
    : trace.transactions

  return (
    <Card variant="tertiary" as="section" className={cn("var-[padding=0] lg:h-200", className)}>
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <h2 className="text-18 font-medium">
            Timeline <span className="text-14 text-muted">{visible.length} transactions</span>
          </h2>
          {selected ? (
            <Chip size="small" addonAfter={XIcon} onClick={onClear}>
              {labelFor(selected)}
            </Chip>
          ) : null}
        </div>
        <ol className="border-subtle flex-1 overflow-y-auto border-t">
          {visible.map((tx) => (
            <TimelineItem key={tx.hash} tx={tx} txTransfers={transfersByTx.get(tx.hash) ?? []} />
          ))}
        </ol>
      </div>
    </Card>
  )
}
