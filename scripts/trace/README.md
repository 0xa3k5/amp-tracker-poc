## Trace scripts (AMPD-21)

These scripts rebuild the fixtures in `data/` from Amp staging. `scripts/amp-access/env.mjs` loads the credentials.

1. `node scripts/trace/run-queries.mjs` runs the four queries in `data/queries/`, saves raw results to `raw-*.json` (gitignored), and writes `data/metrics.json`.
2. `node scripts/trace/token-meta.mjs` reads `symbol()` and `decimals()` for the tokens in `tokens.json` from a public keyless RPC. You only need to rerun it if the token list changes.
3. `node scripts/trace/build-fixtures.mjs` writes `data/transactions.json`, `data/transfers.json` and `data/addresses.json`. It starts from `addresses.research.json`, the AMPD-18 list.

## Filters

- **Transactions.** The timeline keeps every transaction a seed signed. From outsiders it keeps only Binance's transactions and transfers of at least 1 ETH. That drops 1,554 on-chain text messages and about 1,800 dust transfers from lookalike addresses.
- **Lookalike tokens.** The scripts keep a token only if it moved inside a transaction a seed or Binance signed and its symbol is plain ASCII. This drops 114 lookalike tokens, some with ASCII symbols that exactly copy "USDT" or "ETH".
- **USD values.** These cover stablecoins at $1, and ETH, WETH, stETH and aEthWETH at $2,657.18. That ETH price is implied on chain: 0x9749 sold 325M USDT and sent on 122,310 ETH (`eth-price.json`). Other tokens have no `amount_usd`.
- **Missing ETH movements.** The dataset has no traces table, so ETH moved inside contract calls does not show up. That includes Binance 14's 167,464 ETH sweep and the ETH that the fillers paid 0x9749.
