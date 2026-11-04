import eds from "@edgeandnode/eds-react/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

import { ampQuery } from "./server/amp-query.ts"

export default defineConfig({
  build: {
    target: ["chrome123", "edge123", "firefox120", "safari17.5", "ios17.5"],
  },
  plugins: [react(), tailwindcss(), eds(), ampQuery()],
})
