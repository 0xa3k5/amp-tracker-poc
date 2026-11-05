import { Tag } from "@edgeandnode/eds-react"

import { formatBlock } from "./format.ts"
import { LiveEventRow } from "./LiveEventRow.tsx"
import { eventKey, HACK_END_BLOCK, isSignificant, newestFirst, useLive, type LiveEvent } from "./liveStream.ts"
import { SourceLabel } from "./SourceLabel.tsx"

const SHOWN = 6

export function LiveFeed({ onPick }: { onPick: (event: LiveEvent) => void }) {
  const { events, mode } = useLive()
  const shown = events.filter((e) => e.kind === "freeze" || isSignificant(e)).toSorted(newestFirst)
  const small = events.length - shown.length

  return (
    <div className="rounded-8 border-muted bg-subtle flex w-88 flex-col gap-3 border p-4">
      <div className="flex flex-col gap-1">
        <p className="text-14 flex flex-wrap items-center gap-2 font-medium">
          New since the hack window
          {mode === "sample" ? (
            <Tag size="xsmall" variant="solar">
              Sample data
            </Tag>
          ) : null}
        </p>
        <p className="text-12 text-muted flex flex-wrap items-center gap-2">
          After block {formatBlock(HACK_END_BLOCK)}
          <SourceLabel source="amp" detail="Transfers streamed from Amp" />
          <SourceLabel source="dataset" detail="Freezes streamed from our derived dataset" />
        </p>
      </div>
      {shown.length > 0 ? (
        <ol className="-mx-2 flex max-h-80 flex-col overflow-y-auto">
          {shown.slice(0, SHOWN).map((event) => (
            <li key={eventKey(event)} className="shrink-0">
              <button
                type="button"
                onClick={() => onPick(event)}
                className="hover:bg-muted rounded-6 flex w-full px-2 py-2 text-start"
              >
                <LiveEventRow event={event} />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-12 text-muted">
          {mode === "connecting" ? "Waiting for the first blocks." : "No new transfers or freezes yet."}
        </p>
      )}
      {small > 0 ? (
        <p className="text-12 text-muted">
          {small} {small === 1 ? "transfer" : "transfers"} under $1K or in unknown tokens not shown.
        </p>
      ) : null}
    </div>
  )
}
