import addressesJson from "../data/addresses.json"
import metricsJson from "../data/metrics.json"
import transactionsJson from "../data/transactions.json"
import transfersJson from "../data/transfers.json"
import datasetMetricsJson from "../datasets/metrics.json"
import tokenMetaJson from "../scripts/trace/token-meta.json"
import type { AddressInfo, Metric, Transaction, Transfer } from "./types.ts"

export const addresses = addressesJson as Array<AddressInfo>
export const transactions = transactionsJson as Array<Transaction>
export const transfers = transfersJson as Array<Transfer>
export const metrics = metricsJson as Array<Metric>

const sqlFiles = import.meta.glob<string>("../data/queries/*.sql", { query: "?raw", import: "default", eager: true })

export const queries = Object.entries(sqlFiles)
  .map(([path, sql]) => ({
    name: path
      .split("/")
      .pop()!
      .replace(/\.sql$/, ""),
    sql,
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

export interface DatasetMetric {
  query: string
  file: string
  ms: number
  rows: number
  blocks: number
}

const datasetMetrics = datasetMetricsJson as Array<DatasetMetric>

export function datasetMetric(name: string) {
  return datasetMetrics.find((m) => m.file === `datasets/queries/${name}.sql`)
}

const datasetSqlFiles = import.meta.glob<string>("../datasets/queries/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
})

export function datasetQuery(name: string) {
  return datasetSqlFiles[`../datasets/queries/${name}.sql`] ?? ""
}

export const addressBook = new Map(addresses.map((a) => [a.address, a]))

export const isMock = addresses.some((a) => a.source === "mock")

export const FREEZE_EVENTS = new Set(["AddedBlackList", "DestroyedBlackFunds"])

const tokenMeta = tokenMetaJson as Record<string, { symbol: string; decimals: number }>

export const tokenBook = new Map(
  transfers
    .filter((t) => tokenMeta[t.token_address])
    .map((t) => [t.token_address, { symbol: t.token, decimals: tokenMeta[t.token_address]!.decimals }]),
)
