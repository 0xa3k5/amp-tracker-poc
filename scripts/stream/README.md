# Streaming queries (AMPD-29)

Two streaming queries feed `GET /api/stream` (`server/amp-stream.ts`):

- `data/queries/stream-transfers.sql`: ERC-20 transfers and plain ETH transfers to or from the 27 watched wallets in `watch-list.json`.
- `data/queries/stream-freezes.sql`: new rows in `a3k5/stablecoin_forensics@0.2.0` `stablecoin_freezes`, with `watched` set when the account is on the same list.

`node scripts/stream/build-queries.mjs` writes both files from `data/addresses.json` and `data/freezes.json`. It leaves out the 12 exchanges, issuers and Binance hot wallets: they carried 8,639 transfers in 300 blocks.

## Measure

```bash
node scripts/stream/measure.ts probe 3 <block near the head>   # one row per block: latency
node scripts/stream/measure.ts transfers 4                     # fresh, from block 26322291
node scripts/stream/measure.ts transfers 1 resume              # continue from the saved cursor
```

Each run appends one line per microbatch to `out/<name>.jsonl` and saves the cursor to `out/<name>.cursor.json` (not committed).

## Results, 5 Nov 2026

- Block to client at the head: median 4.0 s, p90 5.8 s, range 2.2 to 6.1 s over 30 blocks (`out/probe.jsonl`). Latency is receive time minus block timestamp.
- The freeze stream reads the derived dataset and arrives a median 0.4 s after the raw transfer stream for the same block.
- Catch-up: the transfer stream read the 27,000 blocks from 26322291 to the head in 52 s. Amp doubled the microbatch from 1 block up to 11,305 blocks, and the stream returned 2,452 rows. `GET /api/stream` sent 2,449 transfers and 38 freezes for the same range.
- Resume: a cursor resumes at the next block with no gap and no repeat. That held for the CLI and for a restart of the app server. The first microbatch arrived 1.8 s after reconnecting.
- Reorg: none happened. Resuming from a cursor with a wrong hash at block 26349220 made Amp send 26349220 again, and the client flagged a reorg from that block.
