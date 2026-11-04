# amp-poc: Binance hack incident tracer

Amp Lab Week demo (4 to 6 November 2026). Internal only: active FBI case, anything public needs comms sign-off.

## Run

```sh
pnpm install
pnpm dev        # http://127.0.0.1:3010, reads fixtures from data/
```

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm build`.

## Layout

- `src/`: the React app (EDS, React Flow).
- `server/amp-query.ts`: Vite middleware for live Amp queries. Needs `AMP_QUERY_URL` and a token in the environment, never in files.
- `data/`: fixtures in the project's data contract, plus `queries/*.sql` shown in the SQL panel.
- `scripts/amp-access/`: the Amp staging recipe from AMPD-19. `query.mjs` runs a `.sql` file and prints `{ms, rows}`. It needs `@edgeandnode/amp` and `effect`, which are not installed yet.
