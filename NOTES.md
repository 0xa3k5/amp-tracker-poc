# Amp notes from the Binance hack tracer

## The project

A proof of concept for Amp, built in Lab Week (4 to 6 November 2026).
We traced the 29 October Binance hot wallet hack on Ethereum with Amp staging as the only on-chain source.
The tracer is the example. The output is what we learned about Amp as consumers.

## Where we used Amp, and how

- **SQL over `transactions` and `logs`, decoded at query time.** `evm_decode_log` and `evm_topic` decode every event we need from a signature string. No pre-built dataset.
- **Freeze events from 8 issuers.** USDT, USDC, RLUSD, XAUt, USD1, FDUSD, PAXG and PYUSD, decoded from their event signatures alone, starting from the three Binance hot wallets.
- **The EIP-7702 takeover.** `transactions.authorization_list` shows the type-4 transaction that gave Binance 14 50 delegations to `0x63e8…6fae`, and the later authorization to `0x0` that cleared it.
- **Our own derived dataset, `a3k5/stablecoin_forensics`.** Freeze events plus 7,656,728 balance changes. Register, deploy and status worked on the first try.
- **Streaming.** The app shows new developments live from two `SETTINGS stream = true` queries. Details are under Streaming below.

## Coverage

- Ethereum only: `edgeandnode/ethereum_mainnet@0.0.2`, blocks 26300743 to 26322290. That is 21,548 blocks, about 72 hours.
- $2.91B of Binance's reported $6.34B left on Ethereum. The gap is other chains, which staging does not have, the ETH in the next line, and 56 tokens with no USD price.
- Token transfers are complete. ETH moved inside contract calls is not covered, which leaves out about 167,464 ETH from Binance 14.
- 29 frozen addresses in the window. 16 are linked to the hack, and 4 of those are not in public reports.
- $2.07B frozen in USD stablecoins on Ethereum, in the hack window. Binance reports $2.85B frozen across all chains. The two numbers have different scopes, so one is not missing from the other.

"Not in public reports" means Amp linked the frozen address to the Binance wallets by following transfers, and no public report names it. All of it is public chain data. Of the 4, two links are strong and one is medium, a single transfer from a Binance wallet that also pays customers. One is weak, because the address has more than 50 senders.

## Speed

Measured on staging, over the 21,548-block window unless noted.

| Query | Time |
| --- | --- |
| Freeze events, 8 issuers, 42 rows | 9.1 s |
| EIP-7702 authorizations, 51 rows | 5 to 8 s |
| Freeze query on our dataset vs raw logs | 1.8 s vs 6.8 s |
| Net flow on our dataset vs raw logs | 2.9 s vs 13.6 s |
| Build our dataset | 4 min 41 s |
| 7-hop transfer trace from the Binance wallets, 20 queries, 99 addresses | 152.6 s |
| Full USDT history for one address | timed out at 10 min |

About 4 minutes of the dataset build was walking empty blocks from genesis, because a derived deploy has no start block.

## Accuracy

- Amp matches the published frozen amounts: 971,149,299.48 USDT and 823,000,000 USDC at `0x5227…2f8c`, and 30,000,000 USDT at `0xb171…c8c3`.
- `0xaa24…54a0` comes out at 174,999,872.33 USDT against a published 175M, a gap of 127.67 USDT. Our amounts are net inflow inside the window, not absolute balances.
- Amp matches Binance's report on the 50 authorizations, the last drain at 23:56 UTC and the revocation at 00:10 UTC.
- Amp caught an error in a public write-up. Exploiter 8 received 197,460 ETH in two transactions, not 195,460 ETH in one.

## Alternatives, and where Amp wins

This comparison comes from how those tools work, not from a measured benchmark.

- **Explorer APIs** such as Etherscan look up one address at a time and are rate-limited.
- **Subgraphs and custom indexers** need to know the contracts in advance.
- **Hosted SQL** such as Dune and Allium is the closest. It depends on pre-decoded tables, can lag the chain, and can't be self-hosted.
- **Forensics tools** such as Chainalysis, TRM and Arkham are closed and costly, and their results can't be checked against the data.

Amp wins on four things. It answers questions nobody prepared for, since any event decodes from its signature at query time. It exposes raw fields like 7702 authorizations. It builds your own dataset in minutes. The data is self-hostable and verifiable, since every number here comes with the SQL that produced it.

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

The app shows new developments live. `a3k5/stablecoin_forensics@0.2.0` has no end block, so Amp keeps it at the chain head. Two queries with `SETTINGS stream = true` feed `GET /api/stream`: transfers to or from 27 incident wallets, and new freeze events. Measured on 5 Nov 2026:

- **Latency.** At the head, an event reaches the client a median of 4.0 s after its block timestamp (p90 5.8 s, 30 blocks). The freeze stream reads the derived dataset and arrives 0.4 s after the raw stream for the same block.
- **Derived dataset at the head.** 0.2.0 reached the head under 6 minutes after deploy and has stayed 4 to 27 s behind it since.
- **Catch-up.** The transfer stream read 27,000 blocks in 52 s. Amp doubled the microbatch from 1 block to 11,305.
- **Resume.** A saved cursor resumes at the next block, with no gap and no repeat, including after an app server restart.
- **Reorgs.** None happened. A cursor with a wrong hash made Amp resend that block, and the client caught it.

Problems we hit:

- The TypeScript SDK crashes on Amp's keep-alive, an empty Flight frame sent every 30 s on an idle stream (`Offset is outside the bounds of the DataView`). Every stream died after 30 s until we filtered those frames out.
- A `_block_num >= N` filter skips the block prefix for a single-table stream but not for a `UNION ALL`. Our transfer stream started at block 0 and scanned 24.7M blocks before we stopped it. We now start fresh streams from a resume cursor built from block N-1's hash.
- A `UNION` mixing `UInt32` and `Int64` runs as a batch query and fails in streaming mode with a planner error. Explicit casts fix it.
- The end block is a deploy setting, not part of the manifest, and Amp keys a materialization by manifest hash. Tagging the 0.1.0 manifest as 0.2.0 and deploying it without an end block would have extended 0.1.0. We added a comment to the SQL to get a new hash.
- While a derived job catches up, status reports `delay_seconds` of 11 years, and the register response says `start_block: 0` even when the SQL filters from a later block.
