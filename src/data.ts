import addressesJson from "../data/addresses.json"
import metricsJson from "../data/metrics.json"
import transactionsJson from "../data/transactions.json"
import transfersJson from "../data/transfers.json"
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

export const addressBook = new Map(addresses.map((a) => [a.address, a]))

export const isMock = addresses.some((a) => a.source === "mock")

export const FREEZE_EVENTS = new Set(["AddedBlackList", "DestroyedBlackFunds"])
