import { formatPercent, formatTime, formatUsd } from "./format.ts"
import type { Incident } from "./incident.ts"
import { SqlButton } from "./SqlButton.tsx"

export function Summary({ incident }: { incident: Incident }) {
  const { taken, frozen } = incident
  const share = taken > 0 ? frozen / taken : 0

  return (
    <section aria-label="Summary" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-32 max-w-200 font-medium text-balance">
          {formatUsd(taken)} left Binance on Ethereum. Tether froze {formatUsd(frozen)} of it.
        </p>
        {incident.window ? (
          <p className="text-14 text-muted">
            {formatTime(incident.window.fromTs)} to {formatTime(incident.window.toTs)}
          </p>
        ) : null}
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
              <dt className="text-14 text-muted">Frozen by Tether</dt>
              <dd className="text-14 font-medium">
                {formatUsd(frozen)} · {formatPercent(share)} · {incident.frozenWallets} wallets
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <span aria-hidden className="bg-strong size-2.5 rounded-full" />
              <dt className="text-14 text-muted">Not frozen on chain</dt>
              <dd className="text-14 font-medium">{formatUsd(Math.max(0, taken - frozen))}</dd>
            </div>
          </dl>
          <SqlButton query="usdt-freeze" />
        </div>
        <p className="text-12 text-muted max-w-200">
          USD totals count priced tokens only. {incident.unpricedTokens} tokens have no price, and ETH moved inside
          contract calls is not in the data.
        </p>
      </div>
    </section>
  )
}
