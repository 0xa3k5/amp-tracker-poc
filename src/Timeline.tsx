import { useEffect, useMemo, useRef, useState } from "react"
import { Address, Card, Chip, CodeInline, CopyButton, DescriptionList, Status } from "@edgeandnode/eds-react"
import { CaretDownInteractiveIcon, XIcon } from "@edgeandnode/eds-react/icons"
import { cn } from "@edgeandnode/eds-react/utils"

import { FREEZE_EVENTS, tokenBook } from "./data.ts"
import { formatAmount, formatBlock, formatInteger, formatTime, formatUnits, shortHash } from "./format.ts"
import { fullLabel, knownLabel, labelFor } from "./roles.ts"
import { isAddress, isFreeze, touches, type Trace } from "./trace.ts"
import type { DecodedEvent, Transaction, Transfer } from "./types.ts"

export interface TimelineFilter {
  label: string
  members: Set<string>
}

export interface TimelineFocus {
  hash: string
  nonce: number
}

interface TimelineProps {
  trace: Trace
  filter: TimelineFilter | null
  focus: TimelineFocus | null
  onClear: () => void
  className?: string
}

const AMOUNT_ARGS = new Set(["value", "wad", "amount", "_balance"])

function amountSummary(tx: Transaction, txTransfers: Array<Transfer>) {
  const destroyed = tx.events.find((event) => event.name === "DestroyedBlackFunds")?.args._balance
  if (destroyed) return `${formatUnits(destroyed, 6)} USDT destroyed`
  const byToken = new Map<string, number>()
  for (const t of txTransfers) byToken.set(t.token, (byToken.get(t.token) ?? 0) + Number(t.amount))
  const parts = [...byToken].map(([token, amount]) => `${formatAmount(amount)} ${token}`)
  if (parts.length === 0) return Number(tx.value_eth) > 0 ? `${formatAmount(Number(tx.value_eth))} ETH` : null
  return parts.length > 2 ? `${parts.slice(0, 2).join(", ")} +${parts.length - 2}` : parts.join(", ")
}

function LabelledAddress({ address }: { address: string }) {
  return (
    <span title={fullLabel(address)}>
      <Address address={address} size="small">
        {knownLabel(address)}
      </Address>
    </span>
  )
}

function ArgValue({ name, value, contract }: { name: string; value: string; contract: string }) {
  if (isAddress(value)) return <LabelledAddress address={value} />
  if (!/^\d+$/.test(value)) return <span className="font-mono break-all">{value}</span>
  const token = AMOUNT_ARGS.has(name) ? tokenBook.get(contract) : undefined
  if (token) return <span>{`${formatUnits(value, token.decimals)} ${token.symbol}`}</span>
  return <span className="font-mono break-all">{formatInteger(value)}</span>
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
            <ArgValue name={name} value={value} contract={event.contract} />
          </DescriptionList.Item>
        ))}
      </DescriptionList>
    </li>
  )
}

function TimelineDetails({ tx }: { tx: Transaction }) {
  return (
    <div className="flex flex-col gap-4 px-4 pt-1 pb-4">
      <DescriptionList size="small">
        <DescriptionList.Item label="Transaction" action={<CopyButton value={tx.hash} />}>
          <CodeInline>{shortHash(tx.hash)}</CodeInline>
        </DescriptionList.Item>
        <DescriptionList.Item label="Block">{formatBlock(tx.block_num)}</DescriptionList.Item>
        <DescriptionList.Item label="From">
          <LabelledAddress address={tx.from} />
        </DescriptionList.Item>
        <DescriptionList.Item label="To">
          <LabelledAddress address={tx.to} />
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
  )
}

function TimelineItem({
  tx,
  txTransfers,
  focused,
}: {
  tx: Transaction
  txTransfers: Array<Transfer>
  focused: boolean
}) {
  const [open, setOpen] = useState(false)
  const freeze = isFreeze(tx)
  const amount = amountSummary(tx, txTransfers)

  return (
    <li id={`tx-${tx.hash}`} className="not-first:border-subtle scroll-mt-2 not-first:border-t">
      <details
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        data-freeze={freeze || undefined}
        data-focused={focused || undefined}
        className="group data-focused:outline-status-info-default data-focused:outline-2 data-focused:-outline-offset-2"
      >
        <summary className="hover:bg-muted group-data-freeze:bg-status-info-subtle flex cursor-pointer list-none items-start gap-3 px-4 py-3">
          <span className="text-12 text-muted w-24 shrink-0">{formatTime(tx.ts)}</span>
          <span className="text-14 flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              {tx.method ? <CodeInline>{tx.method}</CodeInline> : <span>ETH transfer</span>}
              {freeze ? <Status variant="info">USDT freeze</Status> : null}
            </span>
            <span className="text-12 text-muted truncate">
              {labelFor(tx.from)} to {labelFor(tx.to)}
            </span>
          </span>
          {amount ? <span className="text-14 max-w-40 shrink-0 text-end">{amount}</span> : null}
          <CaretDownInteractiveIcon alt="" className="text-muted h-lh shrink-0" />
        </summary>
        {open ? <TimelineDetails tx={tx} /> : null}
      </details>
    </li>
  )
}

export function Timeline({ trace, filter, focus, onClear, className }: TimelineProps) {
  const listRef = useRef<HTMLOListElement>(null)
  const transfersByTx = useMemo(() => Map.groupBy(trace.transfers, (t) => t.tx_hash), [trace])
  const visible = useMemo(
    () =>
      filter
        ? trace.transactions.filter((tx) => touches(tx, transfersByTx.get(tx.hash) ?? [], filter.members))
        : trace.transactions,
    [trace, filter, transfersByTx],
  )

  useEffect(() => {
    if (!focus) return
    const item = listRef.current?.querySelector(`[id="tx-${focus.hash}"]`)
    const details = item?.querySelector("details")
    if (details) details.open = true
    item?.scrollIntoView({ block: "start", behavior: "smooth" })
  }, [focus])

  return (
    <Card variant="tertiary" as="section" className={cn("var-[padding=0] lg:h-200", className)}>
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <h2 className="text-18 font-medium">
            Timeline <span className="text-14 text-muted">{formatBlock(visible.length)} transactions</span>
          </h2>
          {filter ? (
            <Chip size="small" addonAfter={XIcon} onClick={onClear}>
              {filter.label}
            </Chip>
          ) : null}
        </div>
        {visible.length > 0 ? (
          <ol ref={listRef} className="border-subtle flex-1 overflow-y-auto border-t">
            {visible.map((tx) => (
              <TimelineItem
                key={tx.hash}
                tx={tx}
                txTransfers={transfersByTx.get(tx.hash) ?? []}
                focused={focus?.hash === tx.hash}
              />
            ))}
          </ol>
        ) : (
          <p className="border-subtle text-14 text-muted border-t p-4">No transactions touch this address.</p>
        )}
      </div>
    </Card>
  )
}
