// Writes datasets/stablecoin-forensics.json: the derived dataset a3k5/stablecoin_forensics.
// Schemas are filled in afterwards by `node scripts/amp-admin/admin.mjs schema <file> --write`,
// which asks the controller's POST /schema to infer them (it writes nothing on staging).
//
// Usage: node datasets/build-manifest.mjs [start_block]
//   start_block defaults to 26300743, the start of the hack window (AMPD-18).
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const START = Number(process.argv[2] ?? 26300743)

// Issuer tokens and decimals. Event signatures come from each contract's verified ABI on
// Sourcify (sourcify.dev/server/v2/contract/1/<address>), read 5 Nov 2026. For proxies we
// read the implementation Sourcify resolves.
const TOKENS = [
  ["USDT", "0xdac17f958d2ee523a2206206994597c13d831ec7", 6], // TetherToken, not a proxy
  ["USDC", "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", 6], // impl 0x43506849d7c04f9138d1a2050bbf3a0c054402dd
  ["RLUSD", "0x8292bb45bf1ee4d140127049757c2e0ff06317ed", 18], // impl 0x9747a0d261c2d56eb93f542068e5d1e23170fa9e
  ["XAUt", "0x68749665ff8d2d112fa859aa293f07a622782f38", 6], // impl 0x4c0d2c74a8d26f1e4f5653021c521f5471f9e566
  ["USD1", "0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d", 18], // impl 0x694aa534bdef8ed63244eb902e7914e527891f08
  ["FDUSD", "0xc5f0f7b66764f6ec8c8dff7ba683102295e16409", 18], // impl 0xa6b2c3d2910246fb0adb02e5f6b39e29026e6d50
  ["PAXG", "0x45804880de22913dafe09f4980848ece6ecbaf78", 18], // impl 0x7da4c5d9eca180a03765a6d27196f2a0380fa543
  ["PYUSD", "0x6c3ea9036406852006290770bedfcaba0e23a0e8", 6], // impl 0x8c35caa5fd5bdc64b6b11344ad57594a3676256a
]

// [event name, full signature, action, field holding the account, field holding the amount or null, tokens]
// Parameter names are lowercase so d['name'] resolves.
const EVENTS = [
  ["AddedBlackList", "AddedBlackList(address user)", "freeze", "user", null, ["USDT"]],
  ["RemovedBlackList", "RemovedBlackList(address user)", "unfreeze", "user", null, ["USDT"]],
  ["DestroyedBlackFunds", "DestroyedBlackFunds(address user, uint256 balance)", "seize", "user", "balance", ["USDT"]],
  ["Blacklisted", "Blacklisted(address indexed account)", "freeze", "account", null, ["USDC"]],
  ["UnBlacklisted", "UnBlacklisted(address indexed account)", "unfreeze", "account", null, ["USDC"]],
  ["AccountPaused", "AccountPaused(address account)", "freeze", "account", null, ["RLUSD"]],
  ["AccountUnpaused", "AccountUnpaused(address account)", "unfreeze", "account", null, ["RLUSD"]],
  ["BlockPlaced", "BlockPlaced(address indexed user)", "freeze", "user", null, ["XAUt"]],
  ["BlockReleased", "BlockReleased(address indexed user)", "unfreeze", "user", null, ["XAUt"]],
  [
    "DestroyedBlockedFunds",
    "DestroyedBlockedFunds(address indexed user, uint256 balance)",
    "seize",
    "user",
    "balance",
    ["XAUt"],
  ],
  ["Freeze", "Freeze(address indexed caller, address indexed account)", "freeze", "account", null, ["USD1", "FDUSD"]],
  [
    "Unfreeze",
    "Unfreeze(address indexed caller, address indexed account)",
    "unfreeze",
    "account",
    null,
    ["USD1", "FDUSD"],
  ],
  [
    "FrozenAccountDrained",
    "FrozenAccountDrained(address indexed caller, address indexed account, uint256 amount)",
    "seize",
    "account",
    "amount",
    ["USD1"],
  ],
  [
    "FrozenFundsReallocated",
    "FrozenFundsReallocated(address indexed caller, address indexed from, address indexed to, uint256 amount)",
    "seize",
    "from",
    "amount",
    ["USD1"],
  ],
  ["FreezeAddress", "FreezeAddress(address indexed addr)", "freeze", "addr", null, ["PAXG", "PYUSD"]],
  ["UnfreezeAddress", "UnfreezeAddress(address indexed addr)", "unfreeze", "addr", null, ["PAXG", "PYUSD"]],
  ["FrozenAddressWiped", "FrozenAddressWiped(address indexed addr)", "seize", "addr", null, ["PAXG", "PYUSD"]],
]

const TRANSFER = "Transfer(address indexed from, address indexed to, uint256 value)"
const addr = (a) => `evm_encode_hex('${a}')`
const tokenIn = (syms) =>
  `address IN (${TOKENS.filter(([s]) => syms.includes(s))
    .map(([, a]) => addr(a))
    .join(", ")})`
// symbol is computed in the inner query and decimals from symbol in the outer one. Two CASEs over
// the same `token = ...` tests in one projection hit the same planner error as two decodes.
const symbolCase = `CASE ${TOKENS.map(([s, a]) => `WHEN address = ${addr(a)} THEN '${s}'`).join(" ")} END`
const decimalsCase = `CASE symbol ${TOKENS.map(([s, , d]) => `WHEN '${s}' THEN ${d}`).join(" ")} END`
const NULL_AMOUNT = "arrow_cast(NULL, 'Decimal256(76, 0)')"
const toAmount = (expr) => `arrow_cast(${expr}, 'Decimal256(76, 0)')`

// evm_decode_log is called once per row inside a subquery. Two calls in one projection fail
// on staging with "push_down_leaf_projections ... ambiguous _block_num" (see NOTES.md).
// The same error hits any expression repeated across output columns.
const freezeBranch = ([name, sig, action, accountField, amountField, syms]) => `
SELECT block_num, timestamp, tx_hash, log_index, token,
       symbol, '${name}' AS event, '${action}' AS action,
       d['${accountField}'] AS account,
       ${amountField ? toAmount(`d['${amountField}']`) : NULL_AMOUNT} AS amount_raw,
       ${decimalsCase} AS decimals
FROM (
  SELECT block_num, timestamp, tx_hash, log_index, address AS token, ${symbolCase} AS symbol,
         evm_decode_log(topic1, topic2, topic3, data, '${sig}') AS d
  FROM eth.logs
  WHERE _block_num >= ${START}
    AND topic0 = evm_topic('${sig}')
    AND ${tokenIn(syms)}
) e`

const legBranch = (side, sign) => `
SELECT block_num, timestamp, tx_hash, log_index, token,
       symbol, d['${side}'] AS address,
       ${sign === "-" ? "-" : ""}${toAmount("d['value']")} AS delta_raw,
       ${decimalsCase} AS decimals
FROM (
  SELECT block_num, timestamp, tx_hash, log_index, address AS token, ${symbolCase} AS symbol,
         evm_decode_log(topic1, topic2, topic3, data, '${TRANSFER}') AS d
  FROM eth.logs
  WHERE _block_num >= ${START}
    AND topic0 = evm_topic('${TRANSFER}')
    AND ${tokenIn(TOKENS.map(([s]) => s))}
) t`

const clean = (sql) => sql.replace(/\n\s*/g, " ").trim()

const manifest = {
  kind: "manifest",
  dependencies: { eth: "edgeandnode/ethereum_mainnet@0.0.2" },
  tables: {
    stablecoin_freezes: { input: { sql: clean(EVENTS.map(freezeBranch).join(" UNION ALL ")) } },
    erc20_balance_changes: {
      input: { sql: clean([legBranch("from", "-"), legBranch("to", "+")].join(" UNION ALL ")) },
    },
  },
  functions: {},
}

const out = fileURLToPath(new URL("./stablecoin-forensics.json", import.meta.url))
writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n")
console.error(`wrote ${out} (start block ${START}); now run: node scripts/amp-admin/admin.mjs schema ${out} --write`)
