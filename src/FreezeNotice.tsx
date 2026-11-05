import { useEffect, useRef, useState } from "react"
import { Button, Status, Tag } from "@edgeandnode/eds-react"
import { XIcon } from "@edgeandnode/eds-react/icons"

import { formatBlock, formatTime } from "./format.ts"
import { freezeTitle } from "./LiveEventRow.tsx"
import { eventKey, LIVE_DATASET, newestFirst, useLive } from "./liveStream.ts"
import { labelFor } from "./roles.ts"
import { SourceLabel } from "./SourceLabel.tsx"
import type { StreamFreeze } from "./stream.ts"

const SHOW_MS = 12_000

export function FreezeNotice({ onPick }: { onPick: (event: StreamFreeze) => void }) {
  const { events } = useLive()
  const latest = events.filter((e): e is StreamFreeze => e.kind === "freeze").toSorted(newestFirst)[0]
  const [shown, setShown] = useState<StreamFreeze | null>(null)
  const lastKey = useRef<string | null>(null)

  useEffect(() => {
    if (!latest) return
    const key = eventKey(latest)
    if (key === lastKey.current) return
    lastKey.current = key
    setShown(latest)
    const timer = setTimeout(() => setShown(null), SHOW_MS)
    return () => clearTimeout(timer)
  }, [latest])

  if (!shown) return null

  return (
    <div
      role="status"
      className="rounded-8 border-status-info-default bg-elevated flex w-88 items-start gap-3 border p-3"
    >
      <button type="button" onClick={() => onPick(shown)} className="flex min-w-0 flex-1 flex-col gap-1 text-start">
        <span className="flex flex-wrap items-center gap-2">
          <Status variant={shown.action === "unfreeze" ? "default" : "info"}>{freezeTitle(shown)}</Status>
          <SourceLabel source="dataset" detail={`Streamed from ${LIVE_DATASET}, our derived dataset`} />
        </span>
        <span className="text-14">at {labelFor(shown.address)}</span>
        <span className="text-12 text-muted">
          {shown.watched
            ? "A watched wallet. Counted in the frozen total."
            : "Not a watched wallet, so not counted in the frozen total."}
        </span>
        <span className="text-12 text-muted">
          Block {formatBlock(shown.block_num)} · {formatTime(shown.ts)}
        </span>
      </button>
      <span className="flex shrink-0 flex-col items-end gap-2">
        <Button variant="tertiary" size="small" addonBefore={XIcon} hideLabel onClick={() => setShown(null)}>
          Dismiss
        </Button>
        <Tag size="xsmall" variant="brand">
          New
        </Tag>
      </span>
    </div>
  )
}
