// Loads AMP_QUERY_URL and AMP_CONTROLLER_JWT from amp-poc/.env (never printed).
// Values already set in the shell win. Point AMP_ENV_FILE at another file to override.
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
const file = process.env.AMP_ENV_FILE ?? fileURLToPath(new URL("../../.env", import.meta.url))
if (existsSync(file)) {
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "")
  }
}
