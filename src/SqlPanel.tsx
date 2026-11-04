import { useState } from "react"
import { Card, CodeBlock, DescriptionList } from "@edgeandnode/eds-react"
import { cn } from "@edgeandnode/eds-react/utils"

import { metrics, queries } from "./data.ts"
import { formatBlock } from "./format.ts"
import type { Trace } from "./trace.ts"

interface SqlPanelProps {
  root: string
  trace: Trace
  className?: string
}

function fill(sql: string, root: string, trace: Trace) {
  return sql
    .replaceAll("{{address}}", root)
    .replaceAll("{{from_block}}", String(trace.blockRange?.from ?? 0))
    .replaceAll("{{to_block}}", String(trace.blockRange?.to ?? 0))
}

function title(name: string) {
  const text = name.replaceAll("_", " ")
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function SqlPanel({ root, trace, className }: SqlPanelProps) {
  const [tab, setTab] = useState(queries.find((q) => q.name === "fund_flow")?.name ?? queries[0]?.name ?? "")
  const metric = metrics.find((m) => m.query === tab)

  return (
    <Card variant="tertiary" as="section" className={cn("lg:h-200", className)}>
      <div className="flex h-full flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-18 font-medium">SQL</h2>
          <p className="text-12 text-muted">The exact queries behind this view, run against Amp.</p>
        </div>
        {queries.length > 0 ? (
          <CodeBlock.Tabs
            tabs={queries.map((q) => ({ value: q.name, label: title(q.name) }))}
            value={tab}
            onValueChange={(value) => setTab(String(value))}
            wrap
            className="flex-1 overflow-y-auto"
          >
            {queries.map((q) => (
              <CodeBlock key={q.name} language="sql" label={`${q.name}.sql`}>
                {fill(q.sql, root, trace)}
              </CodeBlock>
            ))}
          </CodeBlock.Tabs>
        ) : (
          <p className="text-14 text-muted">No queries in data/queries yet.</p>
        )}
        <DescriptionList orientation="horizontal" size="small">
          <DescriptionList.Item label="Time">
            {metric && metric.ms > 0 ? `${metric.ms} ms` : "Not measured"}
          </DescriptionList.Item>
          <DescriptionList.Item label="Rows">{metric ? formatBlock(metric.rows) : "None"}</DescriptionList.Item>
          <DescriptionList.Item label="Blocks scanned">
            {metric ? formatBlock(metric.blocks) : "None"}
          </DescriptionList.Item>
        </DescriptionList>
      </div>
    </Card>
  )
}
