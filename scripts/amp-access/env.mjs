// Loads AMP_QUERY_URL, AMP_CONTROLLER_BASE_URL and AMP_CONTROLLER_JWT from ak's ampdb-app .env (never printed).
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
const file = process.env.AMP_ENV_FILE ?? `${homedir()}/Documents/Repos/edgeandnode/amp-web/typescript/apps/ampdb-app/.env`
for (const line of readFileSync(file, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "")
}
