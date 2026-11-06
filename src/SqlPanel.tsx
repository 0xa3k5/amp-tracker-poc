import { useState } from "react"
import { Button, CodeBlock, DescriptionList } from "@edgeandnode/eds-react"

import { metrics, queries } from "./data.ts"
import { useOpenDetails } from "./details.ts"
import { formatBlock, formatSeconds } from "./format.ts"
import { dataset, datasetSql, runLive, type LiveResult } from "./live.ts"

type LiveState = { status: "running" } | { status: "done"; result: LiveResult } | { status: "error"; message: string }

function title(name: string) {
  const text = name.replaceAll(/[-_]/g, " ")
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function SqlPanel({ initial }: { initial?: string | undefined }) {
  const open = useOpenDetails()
  const [tab, setTab] = useState(initial || queries[0]?.name || "")
  const [live, setLive] = useState<Record<string, LiveState>>({})
  const metric = metrics.find((m) => m.query === tab)
  const state = live[tab]

  const run = (name: string) => {
    setLive((current) => ({ ...current, [name]: { status: "running" } }))
    runLive(name).then(
      (result) => setLive((current) => ({ ...current, [name]: { status: "done", result } })),
      (error: unknown) =>
        setLive((current) => ({
          ...current,
          [name]: { status: "error", message: error instanceof Error ? error.message : String(error) },
        })),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-12 text-muted font-mono">{dataset}</p>
        <Button variant="tertiary" size="small" className="self-start" onClick={() => open({ kind: "compare" })}>
          Freezes: raw logs vs our dataset
        </Button>
      </div>
      {queries.length > 0 ? (
        <CodeBlock.Tabs
          tabs={queries.map((q) => ({ value: q.name, label: title(q.name) }))}
          value={tab}
          onValueChange={(value) => setTab(String(value))}
          wrap
        >
          {queries.map((q) => (
            <CodeBlock key={q.name} language="sql" label={`${q.name}.sql`}>
              {datasetSql(q.sql)}
            </CodeBlock>
          ))}
        </CodeBlock.Tabs>
      ) : (
        <p className="text-14 text-muted">No queries in data/queries yet.</p>
      )}
      <DescriptionList orientation="horizontal" size="small">
        <DescriptionList.Item label="Saved run" description={metric ? `${formatBlock(metric.rows)} rows` : undefined}>
          {metric && metric.ms > 0 ? formatSeconds(metric.ms) : "Not measured"}
        </DescriptionList.Item>
        <DescriptionList.Item
          label="Live run"
          description={state?.status === "done" ? `${formatBlock(state.result.rows)} rows` : undefined}
        >
          {state?.status === "done" ? formatSeconds(state.result.ms) : state?.status === "running" ? "Running" : "None"}
        </DescriptionList.Item>
        <DescriptionList.Item label="Blocks scanned">
          {metric ? formatBlock(metric.blocks) : "None"}
        </DescriptionList.Item>
      </DescriptionList>
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="small"
          className="self-start"
          disabled={!tab || state?.status === "running"}
          onClick={() => run(tab)}
        >
          {state?.status === "running" ? "Running on Amp…" : "Run live"}
        </Button>
        {state?.status === "error" ? (
          <p role="alert" className="text-12 text-status-error-default">
            {state.message}
          </p>
        ) : null}
      </div>
    </div>
  )
}
