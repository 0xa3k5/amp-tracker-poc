import { Link } from "@edgeandnode/eds-react"

import { useOpenDetails } from "./details.ts"
import { txUrl } from "./explorer.ts"
import { formatAmount, formatTime, shortHash } from "./format.ts"
import type { FrozenAddress } from "./freezes.ts"
import { FROZEN_SOURCE } from "./Frozen.tsx"
import { labelFor } from "./roles.ts"
import { SourceLabel } from "./SourceLabel.tsx"
import { TokenMark } from "./TokenAmount.tsx"

export function FrozenDetails({ frozen }: { frozen: FrozenAddress }) {
  const open = useOpenDetails()

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-16 flex items-center gap-2 font-medium">
          Frozen here
          <SourceLabel source="dataset" detail={FROZEN_SOURCE} />
        </h3>
        <ul className="flex flex-col gap-2">
          {frozen.tokens.map((t) => (
            <li key={t.token} className="text-14 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="flex items-center gap-2">
                <TokenMark symbol={t.token} />
                {t.amount !== null ? `${formatAmount(t.amount)} ${t.token}` : t.token}
                <span className="text-muted">by {t.issuer}</span>
              </span>
              <span className="text-12 text-muted flex items-center gap-2">
                {formatTime(t.ts)}
                <Link href={txUrl(t.tx)} target="_blank" variant="secondary" className="font-mono">
                  {shortHash(t.tx)}
                </Link>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {frozen.path.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-16 flex items-center gap-2 font-medium">
            Path from Binance
            <SourceLabel source="amp" detail="Hop-by-hop transfer trace from the three Binance wallets, run on Amp" />
          </h3>
          <ol className="border-subtle flex flex-col gap-3 border-s ps-4">
            {frozen.path.map((step, index) => (
              <li key={step.tx_hash + index} className="text-14 flex flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-x-2">
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={() => open({ kind: "address", address: step.from })}
                  >
                    {labelFor(step.from)}
                  </button>
                  <span className="text-muted">sends</span>
                  <span className="flex items-center gap-1">
                    <TokenMark symbol={step.token} size={14} />
                    {step.token}
                  </span>
                  <span className="text-muted">to</span>
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={() => open({ kind: "address", address: step.to })}
                  >
                    {labelFor(step.to)}
                  </button>
                </span>
                <span className="text-12 text-muted flex items-center gap-2">
                  Hop {index + 1} · block {step.block_num}
                  <Link href={txUrl(step.tx_hash)} target="_blank" variant="secondary" className="font-mono">
                    {shortHash(step.tx_hash)}
                  </Link>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  )
}
