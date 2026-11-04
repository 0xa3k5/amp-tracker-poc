# Amp notes from the Binance hack tracer

What we ran into with Amp while building the tracer (Lab Week, 4 to 6 Nov 2026). Ethereum mainnet, blocks 26300743 to 26322290.

## Data

- Staging has `edgeandnode/ethereum_mainnet@0.0.2`, synced with no gaps in our window. Development has no Ethereum dataset.
- EVM datasets have only `blocks`, `transactions` and `logs`. No traces, so ETH moved inside contract calls is invisible. We miss a 167,464 ETH sweep because of it.
- Adding traces is a provider change, not SQL. `evm-rpc` declares three tables. `phaser` has `enable_traces` but is still in development and needs an Erigon bridge. A static CSV dataset is the only quick workaround.
- No USD prices. 56 tokens in our trace have no price, so value totals undercount.
- No token metadata or verification. Lookalike tokens named "USDT" and "ETH" look the same as the real ones in `logs`. We filtered 114 by hand.
- `edgeandnode/ethereum_stablecoins@0.1.0` has pre-decoded stablecoin transfers: 5.4M rows in our window, counted in 4.1 s.

## SQL

- Query-time decoding with `evm_decode_log` and `evm_topic` worked for ERC-20 `Transfer` and USDT `AddedBlackList`. No pre-built dataset needed.
- Parameter names in event signatures must be lowercase, because the decoded struct fields are case-sensitive.
- Binary columns need `evm_encode_hex` and `evm_decode_hex` to compare or display.

## Performance (staging)

- The block range decides the time. ERC-20 transfers for one busy address: 40.8 s over 4 days, 2.3 s over 324 blocks.
- 100-block count: 2.0 s. USDT blacklist events over 4 days: 9.9 s for 13 rows.
- Our four demo queries: 7.4 s transactions, 22.7 s decoded events, 40.0 s transfers plus one hop, 12.6 s freezes.

## Tooling and docs

- The TypeScript SDK `@edgeandnode/amp` only installs from a pkg.pr.new URL, not npm. It needs `effect` 4 and connectrpc. We copied the setup from `ampdb-app`.
- `ampsql` and `ampctl` were not installed. The SDK covered what we needed.
- `ampdb-docs` has two pages. Every answer came from the engine docs in `amp/docs/feat`.

## Asks for other teams

- Amp core or data: traces for Ethereum on the hosted instance, or a plan for them.
- Amp data: a price dataset, or guidance on pricing long-tail ERC-20s.
- Amp data: token metadata with a verified flag, to filter lookalike spam.
