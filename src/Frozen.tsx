import { Card, Link, Tag, Tooltip } from "@edgeandnode/eds-react"
import { formatAddress } from "@edgeandnode/eds-utils"

import { useOpenDetails } from "./details.ts"
import { txUrl } from "./explorer.ts"
import { formatTime, formatUsd, shortHash } from "./format.ts"
import { DATASET_NAME, freezeTotals, frozenAddresses, type FrozenAddress } from "./freezes.ts"
import { labelFor } from "./roles.ts"
import { SourceLabel } from "./SourceLabel.tsx"
import { CompareButton } from "./SqlButton.tsx"
import { TokenAmount, TokenMark } from "./TokenAmount.tsx"

export function FreezeTags({ frozen }: { frozen: FrozenAddress }) {
  return (
    <>
      {frozen.binance ? (
        <Tag size="xsmall" variant="solar">
          Binance wallet
        </Tag>
      ) : null}
      {frozen.foundByAmp ? (
        <Tooltip>
          <Tag size="xsmall" variant="galactic">
            Found by Amp
            <span className="sr-only">
              ,{" "}
              <Tooltip.Content>No outside source lists this frozen address. Amp linked it to Binance.</Tooltip.Content>
            </span>
          </Tag>
        </Tooltip>
      ) : null}
      {frozen.weak ? (
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

export function FrozenNote() {
  return (
    <p className="text-12 text-muted">
      Amounts are the net inflow inside the hack window, not absolute balances. Wallets that held a token before the
      window show no amount for it, and Binance's own wallets show none.
    </p>
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
              <SourceLabel source="dataset" detail={`Freeze events from ${DATASET_NAME}`} />
            </h2>
            <p className="text-14 text-muted">
              {freezeTotals.addresses} hack-linked addresses, {freezeTotals.events} freeze events from{" "}
              {freezeTotals.issuers} issuers. Ethereum, hack window.
            </p>
          </div>
          <CompareButton />
        </div>
        <FrozenList />
        <FrozenNote />
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
