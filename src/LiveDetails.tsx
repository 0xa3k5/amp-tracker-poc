import { Link, Tag } from "@edgeandnode/eds-react"

import { useOpenDetails } from "./details.ts"
import { txUrl } from "./explorer.ts"
import { formatBlock, shortHash } from "./format.ts"
import { LiveEventRow } from "./LiveEventRow.tsx"
import { eventKey, eventTx, HACK_END_BLOCK, LIVE_DATASET, newestFirst, useLive } from "./liveStream.ts"
import { SourceLabel } from "./SourceLabel.tsx"

export function LiveTransaction({ hash }: { hash: string }) {
  const { events, mode } = useLive()
  const rows = events.filter((event) => eventTx(event) === hash).toSorted(newestFirst)
  const hasFreeze = rows.some((event) => event.kind === "freeze")
  const hasTransfer = rows.some((event) => event.kind === "transfer")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tag size="small" variant="brand">
          New since block {formatBlock(HACK_END_BLOCK)}
        </Tag>
        {mode === "sample" ? (
          <Tag size="small" variant="solar">
            Sample data
          </Tag>
        ) : null}
        {hasTransfer ? <SourceLabel source="amp" detail="Streamed from Amp with SETTINGS stream = true" /> : null}
        {hasFreeze ? (
          <SourceLabel source="dataset" detail={`Streamed from ${LIVE_DATASET}, our derived dataset`} />
        ) : null}
      </div>
      <p className="text-12 text-muted flex items-center gap-2 font-mono break-all">
        {hash}
        <Link href={txUrl(hash)} target="_blank" variant="secondary" className="font-sans">
          Etherscan
        </Link>
      </p>
      {rows.length > 0 ? (
        <ol className="flex flex-col">
          {rows.map((event) => (
            <li key={eventKey(event)} className="not-last:border-subtle py-3 not-last:border-b">
              <LiveEventRow event={event} route />
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-14 text-muted">No longer in the stream</p>
      )}
    </div>
  )
}

export function LiveActivity({ address }: { address: string }) {
  const open = useOpenDetails()
  const { events } = useLive()
  const rows = events
    .filter((e) => (e.kind === "transfer" ? e.from === address || e.to === address : e.address === address))
    .toSorted(newestFirst)
  if (rows.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-16 flex items-center gap-2 font-medium">
        New since the hack window ({rows.length})
        <Tag size="xsmall" variant="brand">
          Live
        </Tag>
      </h3>
      <ol className="-mx-2 flex flex-col">
        {rows.slice(0, 20).map((event) => (
          <li key={eventKey(event)}>
            <button
              type="button"
              onClick={() => open({ kind: "live", hash: eventTx(event) })}
              className="hover:bg-muted rounded-6 flex w-full items-start justify-between gap-3 px-2 py-2 text-start"
            >
              <LiveEventRow event={event} />
              <span className="text-12 text-muted shrink-0 font-mono">{shortHash(eventTx(event))}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
