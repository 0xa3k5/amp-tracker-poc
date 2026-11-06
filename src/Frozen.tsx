import { Card, Link, Tag, Tooltip } from "@edgeandnode/eds-react"
import { formatAddress } from "@edgeandnode/eds-utils"

import { useOpenDetails } from "./details.ts"
import { txUrl } from "./explorer.ts"
import { formatTime, formatUsd, shortHash } from "./format.ts"
import { DATASET_NAME, freezeTotals, frozenAddresses, type FrozenAddress, type LinkStrength } from "./freezes.ts"
import { labelFor } from "./roles.ts"
import { SourceLabel } from "./SourceLabel.tsx"
import { CompareButton } from "./SqlButton.tsx"
import { TokenAmount, TokenMark } from "./TokenAmount.tsx"

export const FROZEN_SOURCE = `Freeze events from ${DATASET_NAME}. Amounts are net inflow inside the hack window, not absolute balances, so Binance's own wallets show none.`

const STRENGTH: Record<LinkStrength, { name: string; detail: string }> = {
  strong: { name: "Strong link", detail: "Link strength: strong." },
  medium: {
    name: "Medium link",
    detail:
      "Link strength: medium. One transfer from a Binance hot wallet that also pays customers, but three issuers froze it.",
  },
  weak: {
    name: "Weak link",
    detail:
      "Link strength: weak. This address has more than 50 senders, so the path from Binance may be a coincidence.",
  },
}

export function UnreportedTag({ strength }: { strength: LinkStrength }) {
  return (
    <Tooltip>
      <Tag size="xsmall" variant="galactic">
        Not in public reports
        <span className="sr-only">
          ,{" "}
          <Tooltip.Content>
            <span className="flex flex-col gap-1">
              <span>
                Amp linked this frozen address to the Binance wallets by following transfers. No public report names it.
              </span>
              <span>{STRENGTH[strength].detail}</span>
            </span>
          </Tooltip.Content>
        </span>
      </Tag>
    </Tooltip>
  )
}

export function FreezeTags({ frozen }: { frozen: FrozenAddress }) {
  return (
    <>
      {frozen.binance ? (
        <Tag size="xsmall" variant="solar">
          Binance wallet
        </Tag>
      ) : null}
      {frozen.unreported ? <UnreportedTag strength={frozen.unreported} /> : null}
      {frozen.unreported ? (
        <Tag size="xsmall" variant="muted">
          {STRENGTH[frozen.unreported].name}
        </Tag>
      ) : null}
      {frozen.weak && !frozen.unreported ? (
        <Tooltip>
          <Tag size="xsmall" variant="muted">
            Weak link
            <span className="sr-only">
              ,{" "}
              <Tooltip.Content>
                This address has more than 50 senders, so the path from Binance may be a coincidence.
              </Tooltip.Content>
            </span>
          </Tag>
        </Tooltip>
      ) : null}
    </>
  )
}

export function FrozenTokens({ frozen }: { frozen: FrozenAddress }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {frozen.tokens.map((t) =>
        t.amount !== null ? (
          <TokenAmount key={t.token} symbol={t.token} amount={t.amount} />
        ) : (
          <span key={t.token} className="inline-flex items-center gap-1 whitespace-nowrap">
            <TokenMark symbol={t.token} />
            {t.token}
          </span>
        ),
      )}
    </span>
  )
}

export function FrozenList() {
  const open = useOpenDetails()

  return (
    <ol className="flex flex-col">
      {frozenAddresses.map((frozen) => (
        <li key={frozen.address} className="not-last:border-subtle not-last:border-b">
          <button
            type="button"
            onClick={() => open({ kind: "address", address: frozen.address })}
            className="hover:bg-muted rounded-6 flex w-full items-start justify-between gap-4 px-2 py-3 text-start"
          >
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-14 flex flex-wrap items-center gap-2 font-medium">
                <span className="truncate">{labelFor(frozen.address)}</span>
                <FreezeTags frozen={frozen} />
              </span>
              <span className="text-12 text-muted flex flex-col gap-1">
                <span>
                  <span className="font-mono">{formatAddress(frozen.address)}</span> · first frozen{" "}
                  {formatTime(frozen.firstTs)}
                </span>
                <FrozenTokens frozen={frozen} />
              </span>
            </span>
            <span className="text-14 shrink-0 font-medium">{frozen.usd > 0 ? formatUsd(frozen.usd) : "No amount"}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}

export function FrozenCard() {
  return (
    <Card variant="tertiary" as="section" aria-labelledby="frozen-title">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="frozen-title" className="text-18 flex items-center gap-2 font-medium">
              Frozen on chain
              <SourceLabel source="dataset" detail={FROZEN_SOURCE} />
            </h2>
            <p className="text-14 text-muted">
              {freezeTotals.addresses} addresses · {freezeTotals.events} events · {freezeTotals.issuers} issuers
            </p>
          </div>
          <CompareButton />
        </div>
        <FrozenList />
      </div>
    </Card>
  )
}

export function FreezeLink({ hash }: { hash: string }) {
  return (
    <Link href={txUrl(hash)} target="_blank" variant="secondary" className="font-mono">
      {shortHash(hash)}
    </Link>
  )
}
