import { withDataset } from "./dataset.ts"

export const dataset = __AMP_DATASET__

export function datasetSql(sql: string) {
  return withDataset(sql, dataset)
}

export interface LiveResult {
  ms: number
  rows: number
}

export type QuerySource = "data" | "datasets"

export async function runLive(name: string, source: QuerySource = "data"): Promise<LiveResult> {
  const response = await fetch("/api/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, source }),
  }).catch(() => null)
  if (!response) throw new Error("The app server is not reachable. Live queries need pnpm dev or pnpm preview.")
  const body = (await response.json().catch(() => null)) as (LiveResult & { error?: string }) | null
  if (!response.ok || !body) throw new Error(body?.error ?? `Live query failed with HTTP ${response.status}`)
  return body
}
