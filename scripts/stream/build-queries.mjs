// Writes the two streaming queries in data/queries/ (AMPD-29):
//   stream-freezes.sql    new rows in a3k5/stablecoin_forensics@0.2.0 stablecoin_freezes
//   stream-transfers.sql  new ERC-20 transfers and plain ETH transfers to or from the watch list
//
// The watch list is every address in data/addresses.json and data/freezes.json, minus the
// counterparties with role binance, exchange or issuer (Binance hot wallets, the Uniswap v4
// PoolManager, UniversalRouter, Aave, the USDT and USDC contracts, the Tether multisig). Those 12
// carried 8,639 ERC-20 transfers in 300 blocks (26348860 to 26349159, measured 5 Nov 2026), almost
// none of them about the hack. A transfer between an incident wallet and one of them still
// matches, because the incident wallet is on the list.
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

const SKIP = new Set(["binance", "exchange", "issuer"])
const labels = new Map()
for (const a of addresses) if (!SKIP.has(a.role)) labels.set(a.address, `${a.role}: ${a.label.split(".")[0]}`)
for (const f of freezes) if (!labels.has(f.address)) labels.set(f.address, `frozen ${f.token} (${f.event})`)
const watch = [...labels.keys()].sort()

const TRANSFER = "Transfer(address indexed from, address indexed to, uint256 value)"
const pad = (a) => `0x000000000000000000000000${a.slice(2)}`
const list = (f) => watch.map((a) => `    evm_encode_hex('${f(a)}')`).join(",\n")
const comments = watch.map((a) => `--   ${a}  ${labels.get(a).slice(0, 90)}`).join("\n")

// log_index is cast to Int64 in both branches. Batch queries coerce UInt32 and the Int64 literal
// -1 on their own; streaming rejects the UNION ("UNION field 4 have different type in inputs").
const transfers = `-- Live ERC-20 transfers and plain ETH transfers to or from the ${watch.length} watched wallets.
-- Streaming: SETTINGS stream = true. Amp runs it in microbatches as new blocks land and
-- the server resumes it from its last cursor after a restart.
-- Watched: attackers, intermediaries and every frozen account from addresses.json and
-- freezes.json. Exchanges, issuers and Binance hot wallets are left out (8,639 transfers in
-- 300 blocks); transfers between them and a watched wallet still match.
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
    AND (topic1 IN (
${list(pad)}
    ) OR topic2 IN (
${list(pad)}
    ))
) erc20
WHERE d['value'] <> '0'
UNION ALL
SELECT block_num, timestamp, evm_decode_hex(tx_hash), arrow_cast(-1, 'Int64'), 'ETH',
       evm_decode_hex("from"), evm_decode_hex("to"), value
FROM "{{dataset}}".transactions
WHERE _block_num >= {{from_block}}
  AND value <> '0'
  AND ("from" IN (
${list((a) => a)}
  ) OR "to" IN (
${list((a) => a)}
  ))
SETTINGS stream = true
`

const freezeSql = `-- Live freeze, unfreeze and seizure events from eight stablecoin and gold-token issuers,
-- read from our derived dataset a3k5/stablecoin_forensics@0.2.0. That version has no end
-- block, so Amp keeps the table at the chain head.
-- Streaming: SETTINGS stream = true. \`watched\` is true when the account is one of the
-- ${watch.length} incident wallets the transfer stream follows.
SELECT block_num, timestamp, evm_decode_hex(tx_hash) AS tx_hash,
       arrow_cast(log_index, 'Int64') AS log_index,
       evm_decode_hex(token) AS token_address, symbol, event, action,
       evm_decode_hex(account) AS account,
       arrow_cast(amount_raw, 'Utf8') AS amount_raw, decimals,
       account IN (
${list((a) => a)}
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
