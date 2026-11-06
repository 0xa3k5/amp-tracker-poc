import eip7702Json from "../data/eip7702.json"
import freezesJson from "../data/freezes.json"
import { addressBook } from "./data.ts"

export interface PathStep {
  from: string
  to: string
  tx_hash: string
  block_num: number
  token_address: string
  token: string
}

export interface Freeze {
  address: string
  token: string
  token_address: string
  event: string
  freeze_tx: string
  block_num: number
  ts: string
  amount: string | null
  window_net: string | null
  window_transfers: number
  hop: number
  hub: boolean
  trace: string
  path: Array<PathStep>
}

export interface Authorization {
  tx_hash: string
  block_num: number
  ts: string
  from: string
  to: string
  delegate: string
  auth_nonce: string
  auth_chain_id: string
}

export interface FrozenToken {
  token: string
  issuer: string
  amount: number | null
  usd: number | null
  ts: string
  tx: string
  event: string
}

export type LinkStrength = "strong" | "medium" | "weak"

export interface FrozenAddress {
  address: string
  tokens: Array<FrozenToken>
  usd: number
  firstTs: string
  hop: number
  path: Array<PathStep>
  binance: boolean
  unreported: LinkStrength | null
  weak: boolean
}

export const freezes = (freezesJson as Array<Freeze>).toSorted((a, b) => a.block_num - b.block_num)
export const authorizations = eip7702Json as Array<Authorization>

export const DATASET_NAME = "a3k5/stablecoin_forensics@0.1.0"
export const BINANCE_REPORTED_FROZEN = 2_850_000_000

export const ISSUERS: Record<string, string> = {
  USDT: "Tether",
  XAUt: "Tether",
  USDC: "Circle",
  RLUSD: "Ripple",
  USD1: "World Liberty Financial",
  FDUSD: "First Digital",
  PAXG: "Paxos",
  PYUSD: "Paxos",
}

const USD_PEGGED = new Set(["USDT", "USDC", "RLUSD", "USD1", "FDUSD", "PYUSD"])

const NOT_IN_PUBLIC_REPORTS = new Map<string, LinkStrength>([
  ["0xe7024ab80143b1ef843efe6a58368696cb87958d", "strong"],
  ["0xcf4ca2bdf21bc3a467a00b6afe72b833982723e0", "strong"],
  ["0xa97bf7836f8a08f9ed91d41453d371493fae8d10", "medium"],
  ["0x8c1c499b1796d7f3c2521ac37186b52de024e58c", "weak"],
])

function frozenToken(row: Freeze): FrozenToken {
  const raw = row.amount ?? row.window_net
  const amount = raw === null ? null : Number(raw)
  const counted = amount !== null && amount > 0 && row.hop > 0 && !row.hub ? amount : null
  return {
    token: row.token,
    issuer: ISSUERS[row.token] ?? row.token,
    amount: counted,
    usd: counted !== null && USD_PEGGED.has(row.token) ? counted : null,
    ts: row.ts,
    tx: row.freeze_tx,
    event: row.event,
  }
}

export const frozenAddresses: Array<FrozenAddress> = [...Map.groupBy(freezes, (row) => row.address)]
  .map(([address, rows]) => {
    const tokens = rows.map(frozenToken)
    const first = rows[0]!
    return {
      address,
      tokens,
      usd: tokens.reduce((sum, t) => sum + (t.usd ?? 0), 0),
      firstTs: first.ts,
      hop: first.hop,
      path: rows.reduce(
        (best, row) => (row.path.length > 0 && row.path.length < best.length ? row.path : best),
        first.path,
      ),
      binance: addressBook.get(address)?.role === "binance",
      unreported: NOT_IN_PUBLIC_REPORTS.get(address) ?? null,
      weak: rows.some((row) => row.hub),
    }
  })
  .sort((a, b) => b.usd - a.usd || a.firstTs.localeCompare(b.firstTs))

export const frozenByAddress = new Map(frozenAddresses.map((f) => [f.address, f]))

export const freezeTotals = (() => {
  const attackerSide = frozenAddresses.filter((f) => !f.binance)
  const unpriced = new Map<string, number>()
  for (const f of attackerSide)
    for (const t of f.tokens)
      if (t.amount !== null && t.usd === null) unpriced.set(t.token, (unpriced.get(t.token) ?? 0) + t.amount)
  return {
    usd: attackerSide.reduce((sum, f) => sum + f.usd, 0),
    addresses: frozenAddresses.length,
    attackerAddresses: attackerSide.length,
    binanceAddresses: frozenAddresses.length - attackerSide.length,
    events: freezes.length,
    issuers: new Set(freezes.map((row) => ISSUERS[row.token] ?? row.token)).size,
    tokens: new Set(freezes.map((row) => row.token)).size,
    unpriced: [...unpriced],
  }
})()

export function frozenTokensAt(address: string) {
  return new Set(frozenByAddress.get(address)?.tokens.map((t) => t.token) ?? [])
}

export function frozenUsdByToken(address: string) {
  return new Map(
    (frozenByAddress.get(address)?.tokens ?? []).filter((t) => t.usd !== null).map((t) => [t.token, t.usd!]),
  )
}

const delegations = Map.groupBy(authorizations, (a) => a.tx_hash)
const ZERO = "0x0000000000000000000000000000000000000000"

export const takeover = (() => {
  const grants = [...delegations.values()].find((rows) => rows.some((a) => a.delegate !== ZERO))
  const revoke = [...delegations.values()].find((rows) => rows.every((a) => a.delegate === ZERO))
  if (!grants || !revoke) return null
  const nonces = grants.map((a) => BigInt(a.auth_nonce)).sort((a, b) => (a < b ? -1 : 1))
  return {
    grant: grants[0]!,
    count: grants.length,
    firstNonce: nonces[0]!.toString(),
    lastNonce: nonces.at(-1)!.toString(),
    revoke: revoke[0]!,
  }
})()
