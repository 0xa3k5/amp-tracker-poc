import { Status, Tag, Tooltip } from "@edgeandnode/eds-react"

import { formatBlock } from "./format.ts"
import { useLive, type LiveMode } from "./liveStream.ts"

const LABEL: Record<LiveMode, string> = {
  connecting: "Connecting",
  live: "Live",
  down: "Stream paused",
  sample: "Replaying sample",
}

const HINT: Record<LiveMode, string> = {
  connecting: "Opening the Amp streams for new transfers and freezes.",
  live: "Amp streams new transfers and freezes as blocks land. The block number is the latest block Amp has finished.",
  down: "The stream is down. It reconnects on its own and resumes where it stopped.",
  sample: "The app replays data/stream-sample.json, real events recorded on 5 Nov. It is not a live feed.",
}

export function LiveIndicator() {
  const { mode, block, error } = useLive()
  const hint = mode === "down" && error ? `${HINT.down} ${error}` : HINT[mode]

  return (
    <span className="text-12 text-muted flex items-center gap-2">
      <Tooltip>
        <span className="flex items-center gap-2">
          <Status variant={mode === "live" ? "success" : mode === "sample" ? "info" : "default"}>{LABEL[mode]}</Status>
          {block !== null ? <span className="tabular-nums">Block {formatBlock(block)}</span> : null}
          <span className="sr-only">
            , <Tooltip.Content>{hint}</Tooltip.Content>
          </span>
        </span>
      </Tooltip>
      {mode === "sample" ? (
        <Tag size="xsmall" variant="solar">
          Sample data
        </Tag>
      ) : null}
    </span>
  )
}
