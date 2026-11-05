// Event shapes pushed by the server-sent-events route GET /api/stream (server/amp-stream.ts).
// Offline sample: data/stream-sample.json. Every event has `kind`, `block_num` and `ts`.
import type { Transfer } from "./types.ts"

export type StreamName = "transfers" | "freezes"

// A row in the shape of transfers.json. `decimals` is null when the token is not in
// scripts/trace/token-meta.json; `token` is then "unknown" and `amount` holds the raw integer.
// Plain ETH has token "ETH" and token_address 0x0000…0000, as in transfers.json.
export interface StreamTransfer extends Transfer {
  kind: "transfer"
  log_index: number
  amount_raw: string
  decimals: number | null
}

// A row in the shape of freezes.json, with only the fields a freeze event carries on chain.
// `amount` is set for seizures only. `watched` is true when the account is on the watch list.
export interface StreamFreeze {
  kind: "freeze"
  block_num: number
  ts: string
  address: string
  token: string
  token_address: string
  event: string
  action: "freeze" | "unfreeze" | "seize"
  freeze_tx: string
  log_index: number
  amount: string | null
  watched: boolean
}

// Sent once per finished microbatch: the stream has seen every block up to block_num.
// `ts` is the time the server received it, not a block time.
export interface StreamProgress {
  kind: "progress"
  stream: StreamName
  block_num: number
  ts: string
  rows: number
}

// Amp went back to an earlier block. Drop events from `block_num` onward for this stream;
// the stream sends them again from the new canonical chain.
export interface StreamReorg {
  kind: "reorg"
  stream: StreamName
  block_num: number
  ts: string
}

export interface StreamError {
  kind: "error"
  stream: StreamName | null
  message: string
  ts: string
}

export type StreamEvent = StreamTransfer | StreamFreeze | StreamProgress | StreamReorg | StreamError
