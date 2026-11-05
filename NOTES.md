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

## Building a derived dataset

We built `a3k5/stablecoin_forensics` on staging as consumers, with an admin token (AMPD-27). It has two tables over `edgeandnode/ethereum_mainnet@0.0.2`: `stablecoin_freezes` (freeze, unfreeze and seizure events from eight issuers) and `erc20_balance_changes` (one row per `Transfer` leg for those tokens). Steps and commands are in `datasets/README.md`.

Results:

- From the hack-window start (block 26300743) to block 26322290, the job took 4 min 41 s. It wrote 7,656,728 balance legs (181.5 MB) and 42 freeze events (13 KB).
- The freeze table matches the raw-logs query row for row (42 events). Querying it takes 1.8 s, against 6.8 s for the same SQL on raw logs.
- USDT net flow per frozen address at its freeze block takes 2.9 s from the derived tables and 13.6 s from raw logs, with identical results. Medians of three runs, in `datasets/metrics.json`.
- The window-only start already gives 971,149,299.48 USDT at `0x5227…2f8c` and 30,000,000 at `0xb171…c8c3`, because neither held USDT before the window. `0xaa24…54a0` shows 174,999,872.33, not 175M. Binance 14 shows a negative net flow because it held USDT before the window. Absolute balances need the dataset to start at token deployment.

What the docs got right:

- The derived dataset page explains the `"manifest"` kind string, dependency aliases and `self.` references between tables.
- `POST /schema` infers every table's output schema without writing anything. It is a safe dry run before registering.
- Register, deploy, status, events and stop worked on the first try. Registering under `a3k5` created the namespace with no extra step.
- The docs say that bounded jobs skip start-block inference. That is what happened.

What was missing or confusing:

- **Dataset names cannot contain hyphens.** `stablecoin-forensics` failed with `INVALID_PAYLOAD_FORMAT: ... name: invalid character '-' in name 'stablecoin-forensics' at line 1 column 49`, repeated three times in one message. The naming rule (`^[a-z_][a-z0-9_]*$`) is only in the JSON schema and the source, not in the dataset guide. We used `stablecoin_forensics`.
- **Repeated expressions break the streaming planner.** Calling `evm_decode_log` twice in one `SELECT`, or two `CASE` expressions that test the same `token = ...`, fails with `INVALID_PLAN: the table cannot be materialized as a stream: failed to optimize query plan: Optimizer rule 'push_down_leaf_projections' failed caused by Schema error: Schema contains qualified field name eth.logs._block_num and unqualified field name _block_num which would be ambiguous`. The message points at `_block_num`, which we had not changed. Filtering on `block_num`, `block_num()` or `_block_num` made no difference. It took about ten schema probes to find the cause. The same SQL runs fine as a batch query. The fix is to decode once in a subquery and compute each expression once. The Amp test manifests use that subquery pattern, but no doc says it is required.
- **The manifest schema format is unclear.** The guide's example writes types as strings such as `Timestamp(Nanosecond, Some("UTC"))`. `POST /schema` returns JSON objects such as `{"Timestamp": ["Nanosecond", "+00:00"]}` and adds `_block_num` and `_ts` columns. The guide does not say to paste that output into the manifest. We copied the pattern from `tests/config/manifests/`.
- **A derived deploy has no start block.** The start comes only from a `_block_num >= N` filter in the SQL, and only for unbounded jobs. With `end_block` set, our job walked from genesis: its watermark began at July 2015. The empty prefix took about 4 of the 4.7 minutes. The window itself took under a minute. The register response also says `start_block: 0` for a dataset that starts at 26300743.
- **The OpenAPI spec points the deploy endpoint at the wrong body.** `POST /materialized-datasets/...` references `CreateRequest`, which resolves to the pipeline request (`source` and `destination` required). The real body (`end_block` as a decimal string, `concurrency`, `worker_id`, `retry_strategy`) is only in `controller-admin-datasets/src/materialized_datasets/handlers/create.rs`.
- **`uint256` decodes to `Utf8`.** The log-decoding page only says it returns a struct. To sum amounts we cast with `arrow_cast(..., 'Decimal256(76, 0)')`.
- **Progress has no block number.** Status shows each table's `watermark_timestamp` as Unix seconds and the network name, but not the current block. We converted timestamps to tell where the job was.
- **Failed jobs retry until stopped.** The default strategy is `unless_stopped`, with exponential backoff up to an hour. A broken job on a shared instance keeps retrying until someone stops it.
- The guides use `ampctl`. We had no `ampctl` binary, so we called the Admin API over HTTP from Node, using the OpenAPI spec and the source.

What surprised us:

- The build was fast. Five minutes for 7.66M rows, then our queries on the result ran 4 to 5 times faster than on raw logs.
- USDT `Issue`, `Redeem` and `DestroyedBlackFunds` change balances without a `Transfer` event. A balance table built from `Transfer` alone is wrong for Tether's treasury and for seized addresses. The full-history version needs those legs.

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
