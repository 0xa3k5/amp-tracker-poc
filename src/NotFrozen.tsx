import { Card, Tag } from "@edgeandnode/eds-react"
import { formatAddress } from "@edgeandnode/eds-utils"

import { addressBook } from "./data.ts"
import { useOpenDetails } from "./details.ts"
import { formatUsd } from "./format.ts"
import type { Incident } from "./incident.ts"
import { labelFor, ROLES } from "./roles.ts"
import { SqlButton } from "./SqlButton.tsx"
import { TokenAmount } from "./TokenAmount.tsx"

export function NotFrozen({ incident }: { incident: Incident }) {
  const open = useOpenDetails()

  return (
    <Card variant="tertiary" as="section" aria-labelledby="not-frozen-title">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="not-frozen-title" className="text-18 font-medium">
              Not frozen yet
            </h2>
            <p className="text-14 text-muted">Largest balances left in attacker wallets at the end of the window.</p>
          </div>
          <SqlButton query="token-transfers" />
        </div>
        <ol className="flex flex-col">
          {incident.unfrozen.map((balance) => {
            const role = addressBook.get(balance.address)?.role
            return (
              <li key={balance.address} className="not-last:border-subtle not-last:border-b">
                <button
                  type="button"
                  onClick={() => open({ kind: "address", address: balance.address })}
                  className="hover:bg-muted rounded-6 flex w-full items-start justify-between gap-4 px-2 py-3 text-start"
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-14 flex items-center gap-2 font-medium">
                      <span className="truncate">{labelFor(balance.address)}</span>
                      {role ? (
                        <Tag size="xsmall" variant={ROLES[role].tag}>
                          {ROLES[role].name}
                        </Tag>
                      ) : null}
                    </span>
                    <span className="text-12 text-muted">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-mono">{formatAddress(balance.address)}</span>
                        {balance.holdings.slice(0, 2).map((h) => (
                          <TokenAmount key={h.token} symbol={h.token} amount={h.amount} />
                        ))}
                      </span>
                    </span>
                  </span>
                  <span className="text-14 shrink-0 font-medium">{formatUsd(balance.usd)}</span>
                </button>
              </li>
            )
          })}
        </ol>
        <p className="text-12 text-muted">
          CNBC reports that Circle froze the USDC in the main receiving wallet. Circle's freeze event is not in the
          queried data yet.
        </p>
      </div>
    </Card>
  )
}
