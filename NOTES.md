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

We built `a3k5/stablecoin_forensics` on staging as consumers, with an admin token (AMPD-27). Steps and commands are in `datasets/README.md`.

### What the dataset is

Two tables that Amp stores as Parquet files on staging. Queries read those files and never touch raw logs.

- `stablecoin_freezes`: one row per freeze, unfreeze or seizure event from eight issuers (USDT, USDC, RLUSD, XAUt, USD1, FDUSD, PAXG, PYUSD). Columns are block, time, transaction, token, event, account, and amount for seizures. 42 rows.
- `erc20_balance_changes`: two rows per `Transfer` of those tokens, negative for the sender and positive for the receiver. Columns are block, time, transaction, token, address and signed amount. 7,656,728 rows.

### Where the data comes from

Only Ethereum event logs, read from Amp's raw dataset `edgeandnode/ethereum_mainnet@0.0.2`, which Amp extracts from an Ethereum node. We added the event signatures, taken from each token's verified ABI on Sourcify, and the token symbols and decimals, written into the manifest. No outside address lists or transaction hashes go in.

### How it is populated

The manifest holds one SQL query per table. A staging worker ran those queries block range by block range: it kept the logs from the eight token contracts with a matching event, decoded them and wrote the rows. Version 0.1.0 covers the hack window, blocks 26300743 to 26322290 (about 72 hours), and stopped there. It does not follow the chain. More blocks need a new version and a new deploy.

### Why we built it

- Speed. Every raw-logs query decodes millions of logs again. The derived tables answer the same questions 4 to 5 times faster (numbers below).
- Amounts. A full-history balance for one address from raw logs hit staging's 10-minute query deadline (AMPD-26). A balance table computed once turns "balance at block X" into a sum.
- Dogfooding. Building our own dataset shows the consumer experience. The friction is listed below.

### What we can read from it

- Which issuer froze, unfroze or seized which address, and when, across all eight tokens in one query.
- Any address's net flow of these tokens between two blocks, including at its freeze block.
- For addresses that held none of the token before the window, that net flow is the frozen balance: 971,149,299.48 USDT and 823,000,000 USDC at `0x5227…2f8c`, and 30,000,000 USDT at `0xb171…c8c3`.
- Top receivers and flows over time, as plain `GROUP BY` queries.

It cannot give absolute balances for addresses that held funds before the window, such as Binance 14. It also misses tokens outside the eight, ETH (no traces) and USD values. USDT `Issue`, `Redeem` and `DestroyedBlackFunds` change balances without a `Transfer` event, so the table misses them.

### How we use it

- Frozen amounts for `data/freezes.json`. AMPD-26 left amounts to this dataset.
- The SQL behind the freeze moment in the demo. The query against the derived tables is short and runs in about 2 s. The app does not read the dataset yet.
- The story for the Amp team: raw logs answer the question, and a derived dataset makes the answer fast and reusable.

No full history for now (ak, 5 Nov). This is a proof of concept, and the hack window covers the demo. A version from token deployment would be up to about 200 GB at today's volume and would need the extra USDT events above.

### Building it

Results:

- From the hack-window start (block 26300743) to block 26322290, the job took 4 min 41 s. It wrote 7,656,728 balance legs (181.5 MB) and 42 freeze events (13 KB).
- The freeze table matches the raw-logs query row for row (42 events). Querying it takes 1.8 s, against 6.8 s for the same SQL on raw logs.
- USDT net flow per frozen address at its freeze block takes 2.9 s from the derived tables and 13.6 s from raw logs, with identical results. Medians of three runs, in `datasets/metrics.json`.
- The window-only start already gives 971,149,299.48 USDT at `0x5227…2f8c` and 30,000,000 at `0xb171…c8c3`, because neither held USDT before the window. `0xaa24…54a0` shows 174,999,872.33, not 175M. Binance 14 shows a negative net flow because it held USDT before the window. Absolute balances need the dataset to start at token deployment, which we are not doing for the proof of concept.

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

## Freeze detection with Amp alone

We started from the three Binance hot wallets and nothing else, and used outside lists only to compare at the end (AMPD-26). Queries are in `data/queries/freeze-*.sql`, results in `data/freezes.json`, scripts in `scripts/freeze/`.

What worked:

- **Every freeze event, in one query.** 42 freeze and blacklist events from 8 issuers (USDT, USDC, RLUSD, XAUt, USD1, FDUSD, PAXG, PYUSD) in 9.1 s. That is 29 frozen addresses. Each issuer names its event differently (`AddedBlackList`, `Blacklisted`, `AccountPaused`, `BlockPlaced`, `Freeze`, `FreezeAddress`), and some put the address in the data instead of a topic. We read the signatures from the verified ABIs on Sourcify. For proxies that means the implementation contract.
- **Linking freezes to the hack.** A hop-by-hop trace over issuer-token transfers of at least $10,000 reached 99 addresses in 7 hops, using 20 queries in 144 s. A second trace over every token stopped at hop 3 with 5,330 addresses after 929 s. Together they link 16 of the 29 frozen addresses to the Binance wallets, each with its path.
- **Every frozen address the outside sources name was found and linked.** Amp also found 4 they don't name: `0xe702…958d` (RLUSD paused, FDUSD frozen, 40.5M RLUSD), `0xa97b…8d10` (PYUSD, PAXG and USDC), `0xcf4c…23e0` (FDUSD) and `0x8c1c…e58c` (USDC). The last one is a weak link: it has 81 senders and is reached through a RAD transfer.
- **Five issuers froze the main wallet in seven tokens.** `0x5227…2f8c` was frozen in USDT, USDC, XAUt, USD1, PYUSD, PAXG and FDUSD. The sources mention only USDT and USDC. Binance 14 itself was frozen in five tokens.
- **Frozen amounts match the sources.** We summed `Transfer` in minus out inside the window, up to the freeze log. That gives 971,149,299.48 USDT at `0x5227`, 823,000,000 USDC at `0x5227` (Circle's freeze, which our fixtures were missing), 30,000,000 USDT at `0xb171` and 174,999,872.33 USDT at `0xaa24`. The last is 127.67 under the 175M the sources give. 30 rows in 5.1 s.
- **The EIP-7702 takeover is directly visible.** `transactions.authorization_list` shows it. At 20:20:59 UTC, `0x7c86…5ca0` sent Binance 14 a type-4 transaction with 50 authorizations. All 50 delegate to `0x63e8…6fae`, with consecutive nonces 18914775 to 18914824. Binance 14's own transaction in that block used nonce 18914808, inside the range. At 00:10:35 UTC, Binance 14 sent itself an authorization to `0x0`, which cleared the delegation. 51 rows in 7.9 s (`data/queries/binance14-eip7702.sql`).

What didn't work:

- **Full-history balances.** The USDT balance for one address from the token's deployment (21.7M blocks) hit staging's 10-minute query deadline (`query execution deadline exceeded`). A 1M-block slice took 117 s, so a full scan takes about 40 minutes per address and token. The window-only sum is right only for wallets that held nothing before the window. The derived dataset (above) is the way to get absolute balances.
- **The 12 unlinked frozen addresses.** None appears in the outside sources. We can't rule out a link through ETH, swaps or contract calls, because the trace follows ERC-20 transfers only and Amp has no traces.
- **Counting counterparties to spot hubs.** Our first rule treated any address with more than 50 counterparties as a router or pool. It cut the trace at `0x5227`, because spam and address-poisoning transfers gave it 167. Counting only senders of tokens that at least 50 addresses sent in the window fixed it. 1,075 tokens pass that test. Listing them takes one 11 s query.
- **SQL limits.** `CROSS JOIN LATERAL unnest(...)` fails with `Physical plan does not support logical expression OuterReferenceColumn`, so we unnest in a subquery. One query with 16 `CASE` branches over `evm_topic` failed twice with a connection reset. Splitting it into a `UNION ALL` ran in 9.1 s.

## What a forensics tool would need

Each item is checked against the `evm-rpc` table schema in `amp/docs/schemas/tables/evm-rpc.md` and the feature docs in `amp/docs/feat`.

| Need | Today | Why |
|---|---|---|
| Traces, full call trees | Feature request | `evm-rpc` writes only `blocks`, `transactions` and `logs`. `phaser` has `enable_traces` but its status is development. |
| Decoded function calls | Derived dataset | `evm_decode_params` (stable) decodes `transactions.input` from a function signature. It returns NULL when the selector doesn't match, so one table per ABI works. |
| EIP-7702 delegations | Works today, small feature request | `transactions` has `type` and `authorization_list` (chain id, delegate, nonce, signature), and we found the Binance 14 takeover with it. The signer is not stored. Recovering it needs `ecrecover`, which has no built-in function. A JS UDF could do it, but JS UDFs are experimental. |
| Contract deployments and bytecode | Partly derived, partly feature request | Direct deploys have `to IS NULL`, but the new contract's address is not stored. Computing it needs keccak over arbitrary bytes, and the only built-in keccak is `evm_topic` for signatures. Factory deploys need traces. Bytecode needs `eth_getCode`, and `eth_call` is the only RPC function. |
| Funding history before the window | Possible, too slow raw | The data goes back to genesis on staging, but one address over USDT history takes about 40 minutes. A derived per-address table, maybe with bloom filters on the address columns (experimental), would make it a lookup. |
| Gas and nonce patterns | Derived dataset | `transactions` has `nonce`, `gas_price`, `gas_limit`, `gas_used`, `max_fee_per_gas`, `max_priority_fee_per_gas` and `type`. |
| Cross-chain bridge events | Derived dataset, plus datasets for other chains | Decoding bridge events on Ethereum is a derived dataset. Following funds to BSC needs a BSC raw dataset on the hosted instance. `evm-rpc` can serve any EVM chain, so this is a deployment request, not an engine change. |
| ETH balances | Feature request | ETH moved inside contract calls needs traces. `blocks` has `withdrawals_root` but no withdrawal list. Fees are derivable from `gas_used`, `gas_price` and `base_fee_per_gas`. A Multicall3 `getEthBalance` through `eth_call` would work, but only on an Amp with an `eth_call` provider, which staging lacks. |
| ERC-20 balances | Derived dataset | Window-only sums from `Transfer` matched the published freeze amounts, the largest gap being 127.67 USDT. Full history needs the derived table, plus the USDT `Issue`, `Redeem` and `DestroyedBlackFunds` events, which move balances without a `Transfer`. |

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
- Amp core: built-in `ecrecover` and keccak functions, so 7702 signers and deployed contract addresses come out of SQL.
- Amp core: an `eth_getCode` function next to `eth_call`, for contract bytecode at a block.
