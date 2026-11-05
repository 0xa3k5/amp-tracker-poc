# Amp notes from the Binance hack tracer

What we ran into with Amp while building the tracer (Lab Week, 4 to 6 Nov 2026). Ethereum mainnet, blocks 26300743 to 26322290.

## Data

- Staging has `edgeandnode/ethereum_mainnet@0.0.2`, synced with no gaps in our window. Development has no Ethereum dataset.
- EVM datasets have only `blocks`, `transactions` and `logs`. No traces, so ETH moved inside contract calls is invisible. We miss a 167,464 ETH sweep because of it.
- Adding traces is a provider change, not SQL. `evm-rpc` declares three tables. `phaser` has `enable_traces` but is still in development and needs an Erigon bridge. A static CSV dataset is the only quick workaround.
- No USD prices. 56 tokens in our trace have no price, so value totals undercount.
- No token metadata or verification. Lookalike tokens named "USDT" and "ETH" look the same as the real ones in `logs`. We filtered 114 by hand.
- `edgeandnode/ethereum_stablecoins@0.1.0` has pre-decoded stablecoin transfers: 5.4M rows in our window, counted in 4.1 s.

## Where the data came from

From Amp, all over the 21,548 blocks of our window on staging:

- Attacker transactions: 1,215 rows in 7.4 s.
- Decoded logs: 4,718 rows in 22.7 s.
- ERC-20 transfers for the seed addresses plus one hop: 3,674 rows in 40.0 s.
- USDT freezes (`AddedBlackList`): 9 rows in 12.6 s.
- Fund-flow aggregation: 1,068 rows in 35.9 s.
- Balances at each freeze block with `eth_call`: query written, not run yet. Staging has no RPC provider for it (see below).

From outside Amp:

- Seed addresses and labels: dev.to, amlcrypto, Etherscan labels, and Blockscout transaction pages cited per address.
- The incident story and totals: TRM Labs, Chainalysis, CNBC, Wikipedia and Tether.
- Token symbols and decimals: a public RPC, called by `token-meta.mjs`.
- USD prices: stablecoins at $1. ETH at $2,657, implied from the attacker's own swap of 325M USDT for 122,310 ETH.
- Spam filter rules: written by hand.
- Token and network icons: web3icons.
- Explorer links: Etherscan.

## SQL

- Query-time decoding with `evm_decode_log` and `evm_topic` worked for ERC-20 `Transfer` and USDT `AddedBlackList`. No pre-built dataset needed.
- Parameter names in event signatures must be lowercase, because the decoded struct fields are case-sensitive.
- Binary columns need `evm_encode_hex` and `evm_decode_hex` to compare or display.

## Balances via `eth_call`

- Decision (5 Nov): balances at a block come from Amp's `eth_call`, not Blockscout. `eth_call` is stable.
- `data/queries/usdt-balances-at-freeze.sql` finds each freeze block in the USDT logs, then calls `balanceOf` at that block with `rpc.mainnet.eth_call`. Expected: 971,149,299.48 USDT for `0x5227` at block 26300954, 175M for `0xaa24`, 30M for `0xb171`.
- Staging rejects it: `No EVM RPC provider found for network 'mainnet'`. We also tried `ethereum` and `eth`. No time measured yet.
- `eth_call` needs an `evm-rpc` provider registered on the Amp you query, and an archive node for past blocks. On a hosted Amp you can call only the networks it has providers for.
- The network name is the provider's, with `_` for `-`. `rpc.mainnet_eth` looks up `mainnet-eth`.

## Performance (staging)

- The block range decides the time. ERC-20 transfers for one busy address: 40.8 s over 4 days, 2.3 s over 324 blocks.
- 100-block count: 2.0 s. USDT blacklist events over 4 days: 9.9 s for 13 rows.
- Our four demo queries: 7.4 s transactions, 22.7 s decoded events, 40.0 s transfers plus one hop, 12.6 s freezes.

## Tooling and docs

- The `ampdb-docs` site in `amp-web` now has about 140 pages (checked 5 Nov, `main` at `dfd801c`). Earlier we found two and used the engine docs in `amp/docs/feat` instead.
- Derived datasets have a full guide, with an example that decodes USDC transfers from `logs`. Their SQL can call `eth_call` as each block range is processed.
- Static datasets (CSV files joined with chain data) have a guide but are marked in development.
- `eth_call` has its own page: calls at past blocks, failed calls, retries, calls for many rows, and an error table.
- The TypeScript SDK `@edgeandnode/amp` has a full section. It still installs only from a pkg.pr.new URL, not npm, and needs `effect` and connectrpc as peer dependencies. Node 24 or newer.
- `ampsql` has a page, marked experimental. It runs one batch query per call, with table, JSON or CSV output. We did not install it. The SDK covered what we needed.
- `phaser`, which has `enable_traces`, is still marked in development.

## What would remove the outside sources

Ranked by how much of the tracer they would move into Amp.

1. **Traces for EVM.** We miss the 167,464 ETH sweep and the fillers' ETH payments, so we had to scale flows. `phaser` has `enable_traces` but is in development.
2. **A token registry dataset**, with address, symbol, decimals, first-seen block and a verified flag. It would replace `token-meta.mjs` and the 114 lookalikes we filtered by hand. Most of it can be built today as a derived dataset with `eth_call`. The verified flag needs a curated list as a static dataset.
3. **A price dataset per token per hour**, built from DEX swaps or Chainlink updates that are already in the logs. 56 tokens have no price, and only 1,245 of 3,037 transfers carry a USD value.
4. **Labels as versioned static datasets** with a source column: the FBI list, Etherscan tags, our own research. This waits on static datasets leaving development.
5. **Indexed tables** (PRD-0007, open), to make "everything touching this address" fast. Seed plus one hop took 40 s. A canvas where you click a wallet to expand it needs about 1 s.

## What stays outside on purpose

- The narrative, cross-chain totals and attribution stay with TRM Labs, Chainalysis and the FBI. The tracer shows what the chain says and makes no attribution claims of its own.

## Asks for other teams

- Amp core or data: traces for Ethereum on the hosted instance, or a plan for them.
- Amp data: a token registry dataset with a verified flag. We can help build the derived part with `eth_call`.
- Amp data: a price dataset per token per hour, or guidance on pricing long-tail ERC-20s.
- Amp core: static datasets out of development, so labels can ship as versioned datasets.
- Amp core: indexed tables (PRD-0007) for address lookups in about 1 s.
- Staging operators: an `evm-rpc` provider for `mainnet` backed by an archive node, so `eth_call` works on staging.
