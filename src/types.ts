export type Role = "binance" | "attacker" | "intermediary" | "exchange" | "bridge" | "issuer"

export interface AddressInfo {
  address: string
  label: string
  role: Role
  source: string
}

export interface DecodedEvent {
  name: string
  contract: string
  args: Record<string, string>
}

export interface Transaction {
  hash: string
  block_num: number
  ts: string
  from: string
  to: string
  value_eth: string
  method: string
  events: Array<DecodedEvent>
}

export interface Transfer {
  tx_hash: string
  block_num: number
  ts: string
  token: string
  token_address: string
  from: string
  to: string
  amount: string
  amount_usd?: string
}

export interface Metric {
  query: string
  ms: number
  rows: number
  blocks: number
}
