# Derived dataset `a3k5/stablecoin_forensics`

Our own derived dataset on Amp staging (AMPD-27). It depends on `edgeandnode/ethereum_mainnet@0.0.2` and has two tables:

- `stablecoin_freezes`: freeze, unfreeze and seizure events from eight issuers (USDT, USDC, RLUSD, XAUt, USD1, FDUSD, PAXG, PYUSD). Columns are `block_num`, `timestamp`, `tx_hash`, `log_index`, `token`, `symbol`, `event`, `action` (`freeze`, `unfreeze` or `seize`), `account`, `amount_raw` (only for seizures) and `decimals`.
- `erc20_balance_changes`: one row per `Transfer` leg for the same eight tokens. The sender gets a negative `delta_raw` and the receiver a positive one. Columns are `block_num`, `timestamp`, `tx_hash`, `log_index`, `token`, `symbol`, `address`, `delta_raw` and `decimals`.

Amounts are raw token units as `Decimal256(76, 0)`. Divide by `10^decimals` for token units. Event signatures come from each contract's verified ABI on Sourcify; `build-manifest.mjs` lists the implementation addresses.

The issue asked for `stablecoin-forensics`. Dataset names must match `^[a-z_][a-z0-9_]*$`, so the registered name uses an underscore. The manifest file keeps the hyphen.

## Version 0.1.0

- Start block 26300743 (hack window start), materialized to end block 26322290. That is 21,548 blocks.
- Manifest hash `6a4e5636cabc7fc36214ab4283c666ec19c22b5adb79516fd669911d09b10231`.
- Job 2257 (materialization child 2258) ran from 11:06:02 to 11:10:44 UTC on 5 Nov 2026, 4 min 41 s.
- `erc20_balance_changes`: 7,656,728 rows, 181.5 MB in 4 files. `stablecoin_freezes`: 42 rows, 13 KB.

## Commands

Run from the repo root. `AMP_CONTROLLER_BASE_URL` and `AMP_ADMIN_JWT` come from `.env`. The scripts read it in code and never print the token. `scripts/amp-admin/admin.mjs` only allows calls on this dataset and blocks every provider endpoint.

```bash
# 1. Write the manifest SQL (start block as the argument)
node datasets/build-manifest.mjs 26300743

# 2. Dry run: the controller infers each table's schema; --write puts them into the manifest. Writes nothing on staging.
node scripts/amp-admin/admin.mjs schema datasets/stablecoin-forensics.json --write

# 3. Register (creates the a3k5 namespace on first use) and tag a version
node scripts/amp-admin/admin.mjs register datasets/stablecoin-forensics.json 0.1.0

# 4. Deploy, bounded by an end block
node scripts/amp-admin/admin.mjs deploy 0.1.0 26322290

# 5. Follow it, and stop it if it runs too long
node scripts/amp-admin/watch.mjs 0.1.0 10
node scripts/amp-admin/admin.mjs events 0.1.0
node scripts/amp-admin/admin.mjs stop 0.1.0
```

The same calls over HTTP, for reference:

```
POST   $AMP_CONTROLLER_BASE_URL/schema                                                   { dependencies, tables: { name: sql } }
POST   $AMP_CONTROLLER_BASE_URL/datasets                                                 { namespace: "a3k5", name: "stablecoin_forensics", version: "0.1.0", manifest: {...} }
POST   $AMP_CONTROLLER_BASE_URL/materialized-datasets/a3k5/stablecoin_forensics/versions/0.1.0   { end_block: "26322290" }
GET    $AMP_CONTROLLER_BASE_URL/materialized-datasets/a3k5/stablecoin_forensics/versions/0.1.0
GET    $AMP_CONTROLLER_BASE_URL/materialized-datasets/a3k5/stablecoin_forensics/versions/0.1.0/events
DELETE $AMP_CONTROLLER_BASE_URL/materialized-datasets/a3k5/stablecoin_forensics/versions/0.1.0   (stop)
```

## Querying

Query with the normal query token (`AMP_CONTROLLER_JWT`), as `"a3k5/stablecoin_forensics@0.1.0".<table>`:

```bash
node datasets/run.mjs datasets/queries/derived-freezes.sql datasets/out/derived-freezes.json
node datasets/bench.mjs   # times raw-logs and derived queries, three runs each, into datasets/metrics.json
```

`datasets/queries/` has the SQL and `datasets/out/` the results.

## Full history

Version 0.1.0 starts at the hack window, so balances are net flow inside the window, not absolute balances. The window holds 7.66M legs in 181.5 MB, about 2.5M legs and 60 MB per day. Starting at token deployment (USDT, block 4634748, November 2017) would cost at most about 200 GB at today's rate, and likely much less. ak decides before we run it.

USDT `Issue` and `Redeem`, and the `DestroyedBlackFunds` seizure, change balances without a `Transfer` event. A full-history balance must add those legs too.
