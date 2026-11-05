# Amp notes from the Binance hack tracer

## What we built

An incident tracer for the 29 October 2026 Binance hot wallet hack on Ethereum mainnet, built for Lab Week (4 to 6 November).
Paste an attacker address to see its transactions, decoded events, a fund-flow graph and the SQL behind each view.
Amp staging (`edgeandnode/ethereum_mainnet@0.0.2`) is the only on-chain source, over blocks 26300743 to 26322290 (21,548 blocks, about 72 hours).
We also built our own derived dataset, `a3k5/stablecoin_forensics`, on staging.

## What Amp did well

- **Freeze detection from the Binance wallets alone.** Starting from the three hot wallets, one query found 42 freeze and blacklist events from 8 issuers (USDT, USDC, RLUSD, XAUt, USD1, FDUSD, PAXG, PYUSD) in 9.1 s. A hop-by-hop transfer trace linked every frozen address the public sources name, plus 4 they don't. Frozen amounts match the sources: 971,149,299.48 USDT and 823,000,000 USDC at `0x5227…2f8c`, 30,000,000 USDT at `0xb171…c8c3`.
- **The EIP-7702 takeover is in plain SQL.** `transactions.authorization_list` shows a type-4 transaction that gave Binance 14 50 delegations to `0x63e8…6fae`, and the later self-authorization to `0x0` that cleared it. 51 rows in 5 to 8 s.
- **Query-time ABI decoding.** `evm_decode_log` and `evm_topic` decoded every event we needed from a signature string, with no pre-built dataset.
- **Derived datasets are fast to build and to query.** `a3k5/stablecoin_forensics` (freeze events plus 7,656,728 balance changes) built in about 5 minutes. The freeze query takes 1.8 s on it against 6.8 s on raw logs, and the net-flow query 2.9 s against 13.6 s, with identical results. Register, deploy and status worked on the first try.

## Asks for the core team, ranked

1. **Traces for EVM.** ETH moved inside contract calls is invisible. We miss a 167,464 ETH sweep. `phaser` has `enable_traces` but is still in development.
2. **An `eth_call` provider on hosted instances.** Balances at a block need `eth_call`, and staging fails with `No EVM RPC provider found for network 'mainnet'`. It needs an archive node.
3. **Full-history lookups.** One address's USDT balance from token deployment hit staging's 10-minute query deadline. A 1M-block slice took 117 s, so about 40 minutes per address and token.
4. **Indexed tables for address lookups** (PRD-0007). Seed addresses plus one hop of transfers took 40 s. Clicking a wallet to expand it needs about 1 s.
5. **Prices.** No USD price data. 56 tokens in our trace have no price, so totals undercount.
6. **Token metadata with a verified flag.** Lookalike "USDT" and "ETH" tokens look the same as the real ones in `logs`. We filtered 114 by hand and read symbols and decimals from a public RPC.
7. **BSC and other chains on hosted instances.** Funds bridged off Ethereum leave our view. `evm-rpc` can already serve any EVM chain, so this is a deployment request.
8. **`ecrecover` and keccak over arbitrary bytes.** The 7702 signer and the address of a newly deployed contract can't be computed in SQL. The only keccak is `evm_topic`.
9. **`eth_getCode`** next to `eth_call`, for contract bytecode at a block.

## Security finding

`GET /providers` on the Admin API returns every provider's RPC URL with its API key in plaintext to anyone holding an admin token. Provider credentials should be redacted in that response. We did not record or share any key.

## Consumer papercuts

- The TypeScript SDK `@edgeandnode/amp` installs only from a pkg.pr.new URL, not npm.
- Event parameter names in signatures must be lowercase, because decoded struct fields are case-sensitive.
- `CROSS JOIN LATERAL unnest(...)` fails with `OuterReferenceColumn`. We unnest in a subquery.
- Binary columns need `evm_encode_hex` and `evm_decode_hex` to compare or display.
- `uint256` decodes to `Utf8`. Summing needs `arrow_cast(..., 'Decimal256(76, 0)')`.
- Docs gaps we hit building the derived dataset:
  - The dataset name rule (`^[a-z_][a-z0-9_]*$`, no hyphens) is only in the JSON schema.
  - Calling `evm_decode_log` twice in one `SELECT` fails the streaming planner with an error about `_block_num`. The fix, decoding once in a subquery, is not documented.
  - The guide writes schema types as strings, but `POST /schema` returns JSON objects. It doesn't say which the manifest wants.
  - A derived deploy has no start block, so a bounded job walks from genesis. About 4 of our 4.7 minutes were the empty prefix.
  - The OpenAPI spec points the deploy endpoint at the wrong request body.
  - Job status shows a timestamp but no block number.

## Where the data came from

From Amp: every transaction, log, transfer, freeze and 7702 authorization, plus our derived dataset built from Amp's logs.
From outside: seed addresses and labels (cited per address in `data/addresses.json`), the incident story and attribution from TRM Labs, Chainalysis, the FBI and press reports, token symbols and decimals, prices, and icons.

## Streaming

Findings to follow from the streaming issue.
