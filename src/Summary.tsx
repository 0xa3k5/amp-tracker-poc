import { formatAmount, formatPercent, formatTime, formatUsd } from "./format.ts"
import { BINANCE_REPORTED_FROZEN, DATASET_NAME, freezeTotals } from "./freezes.ts"
import type { Incident } from "./incident.ts"
import { SourceLabel } from "./SourceLabel.tsx"
import { CompareButton } from "./SqlButton.tsx"

export function Summary({ incident }: { incident: Incident }) {
  const { taken, frozen } = incident
  const share = taken > 0 ? Math.min(1, frozen / taken) : 0

  return (
    <section aria-label="Summary" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-32 max-w-200 font-medium text-balance">
          {formatUsd(taken)} left Binance on Ethereum. Issuers froze {formatUsd(frozen)} of it.
        </p>
        <p className="text-14 text-muted flex flex-wrap items-center gap-2">
          Ethereum only, hack window
          {incident.window ? ` ${formatTime(incident.window.fromTs)} to ${formatTime(incident.window.toTs)}` : null}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <div
          role="img"
          aria-label={`${formatPercent(share)} frozen`}
          className="bg-strong flex h-3 overflow-clip rounded-full"
        >
          <div className="bg-status-info-default h-full" style={{ width: `${share * 100}%` }} />
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            <div className="flex items-center gap-2">
              <span aria-hidden className="bg-status-info-default size-2.5 rounded-full" />
              <dt className="text-14 text-muted">Frozen by {freezeTotals.issuers} issuers</dt>
              <dd className="text-14 flex items-center gap-2 font-medium">
                {formatUsd(frozen)} · {formatPercent(share)} · {incident.frozenWallets} wallets
                <SourceLabel
                  source="dataset"
                  detail={`Freeze events from ${DATASET_NAME}. Amounts are net inflow inside the hack window, not absolute balances.`}
                />
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <span aria-hidden className="bg-strong size-2.5 rounded-full" />
              <dt className="text-14 text-muted">Not frozen on chain</dt>
              <dd className="text-14 flex items-center gap-2 font-medium">
                {formatUsd(Math.max(0, taken - frozen))}
                <SourceLabel source="amp" detail="Transfers out of the Binance wallets, priced where a price exists" />
              </dd>
            </div>
          </dl>
          <CompareButton />
        </div>
        <p className="text-12 text-muted max-w-200">
          USD totals count priced tokens only. {incident.unpricedTokens} tokens have no price, and ETH moved inside
          contract calls is not in the data.
          {freezeTotals.unpriced.length > 0
            ? ` Also frozen, without a USD price: ${freezeTotals.unpriced.map(([token, amount]) => `${formatAmount(amount)} ${token}`).join(" and ")}.`
            : null}
        </p>
        <p className="text-12 text-muted flex max-w-200 flex-wrap items-center gap-2">
          For context, Binance reports {formatUsd(BINANCE_REPORTED_FROZEN)} frozen or intercepted across all chains.
          <SourceLabel source="outside" detail="Binance's initial incident report, 30 October 2026" />
        </p>
      </div>
    </section>
  )
}
