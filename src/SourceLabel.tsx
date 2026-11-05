import { Tag, Tooltip } from "@edgeandnode/eds-react"

import { DEFAULT_DATASET } from "./dataset.ts"
import { DATASET_NAME } from "./freezes.ts"

export type Source = "amp" | "dataset" | "outside"

const NAMES: Record<Source, string> = {
  amp: "Amp",
  dataset: "Our dataset",
  outside: "Outside source",
}

const DEFAULT_DETAIL: Record<Source, string> = {
  amp: `Queried from ${DEFAULT_DATASET} on Amp`,
  dataset: `Read from ${DATASET_NAME}, our derived dataset on Amp`,
  outside: "Reported outside the chain",
}

export function SourceLabel({ source, detail }: { source: Source; detail?: string | undefined }) {
  return (
    <Tooltip>
      <Tag size="xsmall" variant="muted" className="shrink-0 align-middle">
        {NAMES[source]}
        <span className="sr-only">
          , <Tooltip.Content>{detail ?? DEFAULT_DETAIL[source]}</Tooltip.Content>
        </span>
      </Tag>
    </Tooltip>
  )
}
