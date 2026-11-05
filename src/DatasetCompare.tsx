import { useState } from "react"
import { Button, CodeBlock, DescriptionList, Tag } from "@edgeandnode/eds-react"

import { datasetMetric, datasetQuery } from "./data.ts"
import { useOpenDetails } from "./details.ts"
import { formatBlock, formatSeconds } from "./format.ts"
import { DATASET_NAME } from "./freezes.ts"
import { dataset, datasetSql, runLive, type LiveResult } from "./live.ts"
import { SourceLabel, type Source } from "./SourceLabel.tsx"

type LiveState = { status: "running" } | { status: "done"; result: LiveResult } | { status: "error"; message: string }

const QUERIES: Array<{ name: string; title: string; reads: string; source: Source }> = [
  { name: "derived-freezes", title: "Our dataset", reads: DATASET_NAME, source: "dataset" },
  { name: "raw-freezes", title: "Raw logs", reads: dataset, source: "amp" },
]

function QueryRun({ name, title, reads, source }: (typeof QUERIES)[number]) {
  const [state, setState] = useState<LiveState | null>(null)
  const metric = datasetMetric(name)

  const run = () => {
    setState({ status: "running" })
    runLive(name, "datasets").then(
      (result) => setState({ status: "done", result }),
      (error: unknown) =>
        setState({ status: "error", message: error instanceof Error ? error.message : String(error) }),
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-16 flex items-center gap-2 font-medium">
          {title}
          <SourceLabel source={source} />
        </h3>
        <p className="text-12 text-muted font-mono break-all">{reads}</p>
      </div>
      <CodeBlock language="sql" label={`${name}.sql`} wrap rows={10}>
        {datasetSql(datasetQuery(name))}
      </CodeBlock>
      <DescriptionList orientation="horizontal" size="small">
        <DescriptionList.Item
          label="Measured"
          description={metric ? `median of 3, ${formatBlock(metric.rows)} rows` : undefined}
        >
          {metric ? formatSeconds(metric.ms) : "Not measured"}
        </DescriptionList.Item>
        <DescriptionList.Item
          label="Live run"
          description={state?.status === "done" ? `${formatBlock(state.result.rows)} rows` : undefined}
        >
          {state?.status === "done" ? formatSeconds(state.result.ms) : state?.status === "running" ? "Running" : "None"}
        </DescriptionList.Item>
      </DescriptionList>
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="small"
          className="self-start"
          disabled={state?.status === "running"}
          onClick={run}
        >
          {state?.status === "running" ? "Running on Amp…" : "Run live"}
        </Button>
        {state?.status === "error" ? (
          <p role="alert" className="text-12 text-status-error-default">
            {state.message} The view keeps the saved results.
          </p>
        ) : null}
      </div>
    </section>
  )
}

export function DatasetCompare() {
  const open = useOpenDetails()
  const raw = datasetMetric("raw-freezes")
  const derived = datasetMetric("derived-freezes")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-14 text-muted">
          The freezes in this view come from <span className="font-mono">{DATASET_NAME}</span>, a derived dataset we
          built on Amp staging. It decodes freeze, unfreeze and seizure events from 8 issuers once, so a query reads a
          small table instead of decoding the raw logs again.
        </p>
        {raw && derived ? (
          <p className="text-14 flex flex-wrap items-center gap-2">
            Same {derived.rows} events: {formatSeconds(derived.ms)} from our dataset, {formatSeconds(raw.ms)} from raw
            logs.
            <Tag size="xsmall" variant="galactic">
              {(raw.ms / derived.ms).toFixed(1)}× faster
            </Tag>
          </p>
        ) : null}
      </div>
      {QUERIES.map((query) => (
        <QueryRun key={query.name} {...query} />
      ))}
      <Button variant="tertiary" size="small" className="self-start" onClick={() => open({ kind: "sql", query: "" })}>
        All queries behind this view
      </Button>
    </div>
  )
}
