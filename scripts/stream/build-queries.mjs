// Writes the two streaming queries in data/queries/ (AMPD-29, AMPD-33):
//   stream-freezes.sql    new rows in a3k5/stablecoin_forensics@0.2.0 stablecoin_freezes
//   stream-transfers.sql  new ERC-20 transfers and plain ETH transfers sent BY the watch list
//
// The watch list is the attacker and intermediary wallets in data/addresses.json, minus EXCLUDE.
// Only what they send is streamed: incoming transfers were mostly people sending dust and
// on-chain messages to the attackers (578 of 2,927 rows from 26322291 to 26353987). A recipient
// shows on the canvas linked to its sender; its own outflows are not followed.
// Only tokens in scripts/trace/token-meta.json with a plain symbol count: a spam token can emit
// a Transfer event with any sender.
//
// Exchanges, issuers and Binance hot wallets are not on the list. Before AMPD-33 the frozen
// accounts in data/freezes.json were added too, which put Binance 14 and Binance 34 back on it.
// The freeze stream still marks every frozen account as watched.
//
// Both files keep two placeholders that server/amp-stream.ts fills in: {{dataset}} is the raw
// Ethereum dataset and {{from_block}} is the first block a fresh stream reads. A resumed stream
// starts at its cursor instead.
//
// Usage: node scripts/stream/build-queries.mjs
import { readFileSync, writeFileSync } from "node:fs"

const here = (p) => new URL(p, import.meta.url)
const addresses = JSON.parse(readFileSync(here("../../data/addresses.json"), "utf8"))
const freezes = JSON.parse(readFileSync(here("../../data/freezes.json"), "utf8"))
const tokenMeta = JSON.parse(readFileSync(here("../trace/token-meta.json"), "utf8"))

// Wallets on the trail whose outflows are not about the hack
const EXCLUDE = new Map([
  [
    "0xbeef02961503351625926ea9a11ae13b29f5c555",
    "a trading contract called by a dozen 0xbee… wallets; 2,289 of 2,927 live rows were its trades",
  ],
])

const FOLLOW = new Set(["attacker", "intermediary"])
const labels = new Map()
for (const a of addresses) {
  if (FOLLOW.has(a.role) && !EXCLUDE.has(a.address)) labels.set(a.address, `${a.role}: ${a.label.split(".")[0]}`)
}
const watch = [...labels.keys()].sort()
// Freezes count as watched for every frozen account too, Binance's included
const frozenWatch = [...new Set([...watch, ...freezes.map((f) => f.address)])].sort()
const tokens = Object.entries(tokenMeta)
  .filter(([, m]) => /^[A-Za-z0-9.]+$/.test(m.symbol))
  .map(([address]) => address)
  .sort()

const TRANSFER = "Transfer(address indexed from, address indexed to, uint256 value)"
const pad = (a) => `0x000000000000000000000000${a.slice(2)}`
const list = (f, items = watch) => items.map((a) => `    evm_encode_hex('${f(a)}')`).join(",\n")
const comments = watch.map((a) => `--   ${a}  ${labels.get(a).slice(0, 90)}`).join("\n")

// log_index is cast to Int64 in both branches. Batch queries coerce UInt32 and the Int64 literal
// -1 on their own; streaming rejects the UNION ("UNION field 4 have different type in inputs").
const transfers = `-- Live outflows of the ${watch.length} watched wallets: ERC-20 transfers and plain ETH they send.
-- Streaming: SETTINGS stream = true. Amp runs it in microbatches as new blocks land and
-- the server resumes it from its last cursor after a restart.
-- Watched: the attacker and intermediary wallets in addresses.json. Not watched: ${[...EXCLUDE]
  .map(([a, why]) => `${a.slice(0, 6)}, ${why}`)
  .join("; ")}.
-- Only known tokens (scripts/trace/token-meta.json): a spam token can fake any sender.
${comments}
-- ETH moved inside contract calls is not here: the dataset has no traces table.
SELECT block_num, timestamp, evm_decode_hex(tx_hash) AS tx_hash,
       arrow_cast(log_index, 'Int64') AS log_index,
       evm_decode_hex(token) AS token_address,
       evm_decode_hex(d['from']) AS from_address,
       evm_decode_hex(d['to']) AS to_address,
       arrow_cast(d['value'], 'Utf8') AS amount_raw
FROM (
  SELECT block_num, timestamp, tx_hash, log_index, address AS token,
         evm_decode_log(topic1, topic2, topic3, data, '${TRANSFER}') AS d
  FROM "{{dataset}}".logs
  WHERE _block_num >= {{from_block}}
    AND topic0 = evm_topic('${TRANSFER}')
    AND topic3 IS NULL  -- ERC-20 only, ERC-721 indexes tokenId in topic3
    AND topic1 IN (
${list(pad)}
    )
    AND address IN (
${list((a) => a, tokens)}
    )
) erc20
WHERE d['value'] <> '0'
UNION ALL
SELECT block_num, timestamp, evm_decode_hex(tx_hash), arrow_cast(-1, 'Int64'), 'ETH',
       evm_decode_hex("from"), evm_decode_hex("to"), value
FROM "{{dataset}}".transactions
WHERE _block_num >= {{from_block}}
  AND value <> '0'
  AND "from" IN (
${list((a) => a)}
  )
SETTINGS stream = true
`

const freezeSql = `-- Live freeze, unfreeze and seizure events from eight stablecoin and gold-token issuers,
-- read from our derived dataset a3k5/stablecoin_forensics@0.2.0. That version has no end
-- block, so Amp keeps the table at the chain head.
-- Streaming: SETTINGS stream = true. \`watched\` is true when the account is one of the
-- ${watch.length} wallets the transfer stream follows or an account frozen in freezes.json.
SELECT block_num, timestamp, evm_decode_hex(tx_hash) AS tx_hash,
       arrow_cast(log_index, 'Int64') AS log_index,
       evm_decode_hex(token) AS token_address, symbol, event, action,
       evm_decode_hex(account) AS account,
       arrow_cast(amount_raw, 'Utf8') AS amount_raw, decimals,
       account IN (
${list((a) => a, frozenWatch)}
       ) AS watched
FROM "a3k5/stablecoin_forensics@0.2.0".stablecoin_freezes
WHERE _block_num >= {{from_block}}
SETTINGS stream = true
`

writeFileSync(here("../../data/queries/stream-transfers.sql"), transfers)
writeFileSync(here("../../data/queries/stream-freezes.sql"), freezeSql)
writeFileSync(
  here("./watch-list.json"),
  JSON.stringify(
    watch.map((address) => ({ address, why: labels.get(address) })),
    null,
    2,
  ) + "\n",
)
console.error(`watching ${watch.length} addresses; wrote data/queries/stream-transfers.sql and stream-freezes.sql`)
