import { Button } from "@edgeandnode/eds-react"
import { TerminalWindowIcon } from "@edgeandnode/eds-react/icons"

import { datasetMetric, metrics } from "./data.ts"
import { useOpenDetails } from "./details.ts"
import { formatSeconds } from "./format.ts"

export function SqlButton({ query }: { query: string }) {
  const open = useOpenDetails()
  const metric = metrics.find((m) => m.query === query)
  return (
    <Button
      variant="tertiary"
      size="small"
      addonBefore={TerminalWindowIcon}
      onClick={() => open({ kind: "sql", query })}
    >
      {metric && metric.ms > 0 ? `SQL · ${formatSeconds(metric.ms)}` : "SQL"}
    </Button>
  )
}

export function CompareButton() {
  const open = useOpenDetails()
  const metric = datasetMetric("derived-freezes")
  return (
    <Button variant="tertiary" size="small" addonBefore={TerminalWindowIcon} onClick={() => open({ kind: "compare" })}>
      {metric ? `SQL · ${formatSeconds(metric.ms)}` : "SQL"}
    </Button>
  )
}
