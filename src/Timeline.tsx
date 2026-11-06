import { useEffect, useMemo, useRef, useState } from "react"
import { Address, CodeInline, CopyButton, DescriptionList, Link, Status } from "@edgeandnode/eds-react"
import { CaretDownInteractiveIcon } from "@edgeandnode/eds-react/icons"

import { FREEZE_EVENTS, tokenBook } from "./data.ts"
import { txUrl } from "./explorer.ts"
import { formatBlock, formatInteger, formatTime, formatUnits, shortHash } from "./format.ts"
import { fullLabel, knownLabel, labelFor } from "./roles.ts"
import { TokenAmount, TokenMark } from "./TokenAmount.tsx"
import { isAddress, isFreeze } from "./trace.ts"
import type { DecodedEvent, Transaction, Transfer } from "./types.ts"

interface TimelineProps {
  transactions: Array<Transaction>
  transfers: Array<Transfer>
  focus?: string | null | undefined
}

const AMOUNT_ARGS = new Set(["value", "wad", "amount", "_balance"])

function tokenTransfer(tx: Transaction) {
  const [event] = tx.events
  if (tx.events.length !== 1 || event?.name !== "Transfer" || event.contract !== tx.to) return null
  const { from, to, value } = event.args
  if (!from || !to || !value) return null
  return { from, to, value, contract: event.contract }
}

function AmountSummary({ tx, txTransfers }: { tx: Transaction; txTransfers: Array<Transfer> }) {
  const destroyed = tx.events.find((event) => event.name === "DestroyedBlackFunds")?.args._balance
  if (destroyed) return <span>{`${formatUnits(destroyed, 6)} USDT destroyed`}</span>
  const byToken = new Map<string, number>()
  for (const t of txTransfers) byToken.set(t.token, (byToken.get(t.token) ?? 0) + Number(t.amount))
  if (byToken.size === 0 && Number(tx.value_eth) > 0) byToken.set("ETH", Number(tx.value_eth))
  if (byToken.size === 0) return null
  const parts = [...byToken]
  return (
    <span className="flex flex-col items-end gap-1">
      {parts.slice(0, 2).map(([token, amount]) => (
        <TokenAmount key={token} symbol={token} amount={amount} />
      ))}
      {parts.length > 2 ? <span className="text-12 text-muted">{`+${parts.length - 2} more`}</span> : null}
    </span>
  )
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
  if (token) {
    return (
      <span className="inline-flex items-center gap-1">
        <TokenMark symbol={token.symbol} />
        {`${formatUnits(value, token.decimals)} ${token.symbol}`}
      </span>
    )
  }
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

export function TimelineDetails({ tx }: { tx: Transaction }) {
  const transfer = tokenTransfer(tx)
  return (
    <div className="flex flex-col gap-4 px-4 pt-1 pb-4">
      <DescriptionList size="small">
        <DescriptionList.Item label="Transaction" action={<CopyButton value={tx.hash} />}>
          <span className="flex flex-wrap items-center gap-2">
            <CodeInline>{shortHash(tx.hash)}</CodeInline>
            <Link href={txUrl(tx.hash)} target="_blank" variant="secondary" className="text-12">
              Etherscan
            </Link>
          </span>
        </DescriptionList.Item>
        <DescriptionList.Item label="Block">{formatBlock(tx.block_num)}</DescriptionList.Item>
        <DescriptionList.Item label="From">
          <LabelledAddress address={transfer?.from ?? tx.from} />
        </DescriptionList.Item>
        <DescriptionList.Item label="To">
          <LabelledAddress address={transfer?.to ?? tx.to} />
        </DescriptionList.Item>
        {transfer ? (
          <DescriptionList.Item label="Value">
            <ArgValue name="value" value={transfer.value} contract={transfer.contract} />
          </DescriptionList.Item>
        ) : null}
      </DescriptionList>
      {transfer ? null : tx.events.length > 0 ? (
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
  const transfer = tokenTransfer(tx)

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
              {labelFor(transfer?.from ?? tx.from)} to {labelFor(transfer?.to ?? tx.to)}
            </span>
          </span>
          <span className="text-14 shrink-0 text-end">
            <AmountSummary tx={tx} txTransfers={txTransfers} />
          </span>
          <CaretDownInteractiveIcon alt="" className="text-muted h-lh shrink-0" />
        </summary>
        {open ? <TimelineDetails tx={tx} /> : null}
      </details>
    </li>
  )
}

export function Timeline({ transactions, transfers, focus }: TimelineProps) {
  const listRef = useRef<HTMLOListElement>(null)
  const transfersByTx = useMemo(() => Map.groupBy(transfers, (t) => t.tx_hash), [transfers])

  useEffect(() => {
    if (!focus) return
    const item = listRef.current?.querySelector(`[id="tx-${focus}"]`)
    const details = item?.querySelector("details")
    if (details) details.open = true
    item?.scrollIntoView({ block: "start" })
  }, [focus])

  if (transactions.length === 0) return <p className="text-14 text-muted">No transactions in the window.</p>

  return (
    <ol ref={listRef} className="border-subtle rounded-8 border">
      {transactions.map((tx) => (
        <TimelineItem
          key={tx.hash}
          tx={tx}
          txTransfers={transfersByTx.get(tx.hash) ?? []}
          focused={focus === tx.hash}
        />
      ))}
    </ol>
  )
}
