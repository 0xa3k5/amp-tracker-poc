import { useMemo } from "react"
import { Button, CopyButton, DescriptionList, Status, Tag } from "@edgeandnode/eds-react"
import { XIcon } from "@edgeandnode/eds-react/icons"

import { addressBook, transactions, transfers } from "./data.ts"
import type { Details } from "./details.ts"
import { formatAmount, formatUsd } from "./format.ts"
import { fullLabel, labelFor, ROLES } from "./roles.ts"
import { SqlPanel } from "./SqlPanel.tsx"
import { Timeline, TimelineDetails } from "./Timeline.tsx"
import { freezeTargets, isFreeze, touches } from "./trace.ts"

const transfersByTx = Map.groupBy(transfers, (t) => t.tx_hash)
const frozen = new Set(transactions.filter(isFreeze).flatMap(freezeTargets))

function AddressDetails({ address }: { address: string }) {
  const info = addressBook.get(address)
  const summary = useMemo(() => {
    const members = new Set([address])
    const txs = transactions.filter((tx) => touches(tx, transfersByTx.get(tx.hash) ?? [], members))
    const own = transfers.filter((t) => t.from === address || t.to === address)
    let received = 0
    let sent = 0
    const tokens = new Map<string, { amount: number; usd: number }>()
    for (const t of own) {
      const sign = t.to === address ? 1 : -1
      const usd = Number(t.amount_usd ?? 0)
      if (sign > 0) received += usd
      else sent += usd
      const token = tokens.get(t.token) ?? { amount: 0, usd: 0 }
      token.amount += sign * Number(t.amount)
      token.usd += sign * usd
      tokens.set(t.token, token)
    }
    const holdings = [...tokens]
      .filter(([, h]) => h.amount > 0 && h.usd >= 0)
      .sort((a, b) => b[1].usd - a[1].usd)
      .slice(0, 4)
    return { txs, own, received, sent, holdings }
  }, [address])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {info ? (
            <Tag size="small" variant={ROLES[info.role].tag}>
              {ROLES[info.role].name}
            </Tag>
          ) : (
            <Tag size="small" variant="muted">
              Unlabelled
            </Tag>
          )}
          {frozen.has(address) ? <Status variant="info">USDT frozen by Tether</Status> : null}
        </div>
        <p className="text-12 text-muted flex items-center gap-1 font-mono break-all">
          {address}
          <CopyButton value={address} />
        </p>
        {info ? <p className="text-14 text-muted">{fullLabel(address)}</p> : null}
        {info ? <p className="text-12 text-muted">Label source: {info.source}</p> : null}
      </div>
      <DescriptionList size="small">
        <DescriptionList.Item label="Received">{formatUsd(summary.received)}</DescriptionList.Item>
        <DescriptionList.Item label="Sent">{formatUsd(summary.sent)}</DescriptionList.Item>
        <DescriptionList.Item label="Left at end of window">
          {summary.holdings.length > 0
            ? summary.holdings.map(([token, h]) => `${formatAmount(h.amount)} ${token}`).join(", ")
            : "Nothing traced"}
        </DescriptionList.Item>
      </DescriptionList>
      <div className="flex flex-col gap-3">
        <h3 className="text-16 font-medium">Transactions ({summary.txs.length})</h3>
        <Timeline transactions={summary.txs} transfers={summary.own} />
      </div>
    </div>
  )
}

function TransactionDetails({ hash }: { hash: string }) {
  const tx = transactions.find((t) => t.hash === hash)
  if (!tx) return <p className="text-14 text-muted">This transaction is not in the fixtures.</p>
  return (
    <div className="-mx-4">
      <TimelineDetails tx={tx} />
    </div>
  )
}

function title(details: Details) {
  switch (details.kind) {
    case "address":
      return labelFor(details.address)
    case "tx":
      return "Transaction"
    case "sql":
      return "How Amp got this"
    case "transactions":
      return `All ${transactions.length} transactions`
  }
}

export function DetailsPane({ details, onClose }: { details: Details | null; onClose: () => void }) {
  return (
    <div className="flex shrink-0 flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-20 font-medium break-words">{details ? title(details) : null}</h2>
        <Button variant="tertiary" size="small" addonBefore={XIcon} hideLabel onClick={onClose}>
          Close
        </Button>
      </div>
      {details?.kind === "address" ? <AddressDetails key={details.address} address={details.address} /> : null}
      {details?.kind === "tx" ? <TransactionDetails hash={details.hash} /> : null}
      {details?.kind === "sql" ? <SqlPanel key={details.query} initial={details.query} /> : null}
      {details?.kind === "transactions" ? <Timeline transactions={transactions} transfers={transfers} /> : null}
    </div>
  )
}
