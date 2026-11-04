# Binance hack tracer: build notes

Running notes for the Friday team share. Newest at the bottom of each section.

## Decisions

- 4 Nov. Ethereum mainnet only, blocks 26300743 to 26322290 (29 Oct to 1 Nov, 21,548 blocks).
- 4 Nov. Code lives in the standalone repo `amp-poc`, pushed to private `0xa3k5/amp-tracker-poc`. Started as an `amp-web` worktree, moved out the same day.
- 4 Nov. The app ships fixtures captured from Amp, so the demo works offline. "Run live" sends the same SQL to Amp.
- 4 Nov. Sankey view added to the plan (AMPD-24) as the fund-flow overview, next to the node graph.
- 4 Nov. UI rethink with the Design Engineer: built around an incident responder's questions (how much, where is it now, what to act on next), not raw transactions.

- 4 Nov. ak approved the responder layout: incident preloaded, address input secondary, Sankey as the main visual, node graph can go. AMPD-24 builds it.
- 4 Nov. ak has a personal staging JWT. It goes in the gitignored `amp-poc/.env`, never in the repo or issues.

## What worked

- Amp staging had `edgeandnode/ethereum_mainnet@0.0.2` synced through the window. No local `ampd` needed.
- Query-time ABI decoding (`evm_decode_log`, `evm_topic`) decoded Transfer and USDT `AddedBlackList` with no pre-built dataset.
- Totals matched public reporting: 9 USDT freezes, 971M USDT frozen at 0x5227, 197,460 ETH to Exploiter 8.
- Query times on staging: 7.4 s transactions, 22.7 s decoded events, 40.0 s transfers plus one hop, 12.6 s freezes.

## Friction

- No traces table. `evm-rpc` datasets only have blocks, transactions and logs, so ETH moved inside contract calls is invisible. Binance 14's 167,464 ETH sweep is missing. The fix is a provider change (Phaser with traces, or traces in `evm-rpc`), not SQL.
- Lookalike spam: 114 fake tokens (some named "USDT" and "ETH") and 1,554 on-chain messages had to be filtered by hand.
- Prices: 56 altcoins have no USD price in Amp, so value totals undercount.
- Broad scans are slow: transfers for one busy address over 4 days took 40.8 s. Scoping by address and short block ranges helps.
- `ampdb-docs` has two pages. Answers came from the engine docs in `amp/docs/feat`.
- The SDK (`@edgeandnode/amp`) is installed from a pkg.pr.new URL, not npm.

## Help needed from other teams

- Amp core or data: does the hosted Ethereum dataset have traces? If not, what would it take (Phaser with an Erigon bridge, or a `traces` table in `evm-rpc`)? Ask in #amp-hackathon.
- Amp infra: hosted instance access for ak. Staging access arrived 4 Nov; still waiting on the hackathon instance.
- Amp data: USD prices for long-tail ERC-20s, or a recommended price dataset.

## Open

- Archive RPC with `debug_traceTransaction` if we load traces ourselves as a static dataset.
- Whether to stop the trace at `0xbeef…c555`, which fans out to 778 transfers.
