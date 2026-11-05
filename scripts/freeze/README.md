## Freeze detection (AMPD-26)

These scripts find frozen stablecoin balances tied to the hack using Amp only. The one input is the three Binance hot wallets. `scripts/amp-access/env.mjs` loads the credentials. Intermediate results go to `out/`, which is gitignored.

1. `node scripts/freeze/run.mjs data/queries/freeze-events.sql scripts/freeze/out/freeze-events.json` lists every freeze and blacklist event from eight issuers. 42 rows in 9.1 s.
2. `FOCUS=issuer node scripts/freeze/trace.mjs` follows issuer-token transfers of at least about $10,000 outward from the Binance wallets, hop by hop. It wrote `out/trace.json` with 99 addresses after 7 hops in 144 s.
3. `node scripts/freeze/trace.mjs` follows every real token instead. It grows past 5,000 addresses by hop 3 (929 s), so we stopped it there. It writes `out/trace-all.json`, and `build.mjs` expects it.
4. `FREEZE_EVENTS_MS=<ms from step 1> node scripts/freeze/build.mjs` links freezes to the traces, sums each frozen address's net flow inside the window (`data/queries/freeze-window-balances.sql`), and writes `data/freezes.json`, `out/compare.json` and the `freeze-*` rows of `data/metrics.json`.

## Trace rules

- Only non-zero `Transfer` logs. This drops address-poisoning spam.
- Only transfers at or after the block where the sender was first reached.
- Only tokens that at least 50 distinct addresses sent in the window. This drops lookalike tokens. 1,075 tokens pass.
- An address with more than 50 distinct senders of those tokens is a hub (router, pool, exchange deposit, settlement contract). It is recorded but not expanded. The Binance wallets are exempt.

## Event signatures

They come from the verified ABIs on Sourcify, read on 5 Nov 2026. For proxies we read the implementation. The list is at the top of `data/queries/freeze-events.sql`.

## Amounts

`window_net` in `data/freezes.json` is the net `Transfer` flow from block 26300743 to the freeze. It equals the frozen balance only if the address held none of that token before the window. A full-history scan timed out on staging. The derived dataset `a3k5/stablecoin_forensics` (AMPD-27) is where absolute balances come from.
