# amp-poc: Binance hack incident tracer

Amp Lab Week demo (4 to 6 November 2026). Internal only: active FBI case, anything public needs comms sign-off.

## Run

```sh
pnpm install
pnpm dev        # http://127.0.0.1:3010
```

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm build`.

### Fixture mode (default)

The app always renders the saved results in `data/`, so it works offline and needs no `.env`. The SQL panel shows the saved run time and row count for each query from `data/metrics.json`.

### Live mode

Create `.env` from `.env.example`, fill it in, and restart `pnpm dev`. In the SQL panel, pick a query and press "Run live". The server route `POST /api/query` sends that query to Amp and the panel shows the measured time and row count next to the saved run. The timeline and graph keep showing the fixtures. If the call fails (no `.env`, bad token, missing dataset), the error appears under the button.

To refresh the fixtures themselves from the same endpoint, run `node scripts/trace/run-queries.mjs && node scripts/trace/build-fixtures.mjs`.

### Variables

`.env` is gitignored. `scripts/amp-access/env.mjs` loads it for the app server and the trace scripts. Values already set in the shell win, and `AMP_ENV_FILE` points the loader at another file.

| Variable             | Needed for | Value                                                                          |
| -------------------- | ---------- | ------------------------------------------------------------------------------ |
| `AMP_QUERY_URL`      | Live mode  | Amp Flight endpoint, for example `https://gateway.amp.staging.edgeandnode.com` |
| `AMP_CONTROLLER_JWT` | Live mode  | Bearer token for that endpoint                                                 |
| `AMP_DATASET`        | Optional   | Ethereum dataset reference. Defaults to `edgeandnode/ethereum_mainnet@0.0.2`   |

The SQL files in `data/queries/` write the dataset as `{{dataset}}`. `src/dataset.ts` replaces it with `AMP_DATASET` for the SQL panel, the live route and the trace scripts. Switching to the hosted instance is a `.env` change: set the three variables and restart. The hosted dataset must cover blocks 26300743 to 26322290 and have `transactions` and `logs`.

## Layout

- `src/`: the React app (EDS, React Flow laid out with dagre).
- `server/amp-query.ts`: Vite middleware for live Amp queries, used by `pnpm dev` and `pnpm preview`.
- `data/`: fixtures in the project's data contract, plus `queries/*.sql` shown in the SQL panel.
- `scripts/amp-access/`: the Amp staging recipe from AMPD-19. `query.mjs` runs a `.sql` file and prints `{ms, rows}`.
- `scripts/trace/`: the queries runner and fixture builder from AMPD-21.
