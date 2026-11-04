import { useMemo, useState } from "react"

import { addresses } from "./data.ts"
import { FlowGraph } from "./FlowGraph.tsx"
import { Footer } from "./Footer.tsx"
import { Header } from "./Header.tsx"
import { SqlPanel } from "./SqlPanel.tsx"
import { Timeline } from "./Timeline.tsx"
import { buildTrace } from "./trace.ts"

const DEFAULT_ROOT = addresses.find((a) => a.role === "attacker")?.address ?? ""

export function App() {
  const [root, setRoot] = useState(DEFAULT_ROOT)
  const [selected, setSelected] = useState<string | null>(null)
  const trace = useMemo(() => buildTrace(root), [root])

  return (
    <div className="flex min-h-screen flex-col gap-8 p-4 sm:p-6 lg:p-8">
      <Header
        root={root}
        trace={trace}
        onTrace={(address) => {
          setRoot(address)
          setSelected(null)
        }}
      />
      {trace.transfers.length === 0 ? (
        <p className="text-14 text-muted py-16 text-center">
          No transfers from this address in the block range. Paste an address from the trace.
        </p>
      ) : (
        <main className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
          <Timeline trace={trace} selected={selected} onClear={() => setSelected(null)} className="xl:col-span-4" />
          <FlowGraph
            trace={trace}
            selected={selected}
            onSelect={setSelected}
            className="max-lg:h-140 lg:h-200 xl:col-span-5"
          />
          <SqlPanel root={root} trace={trace} className="lg:col-span-2 xl:col-span-3" />
        </main>
      )}
      <Footer />
    </div>
  )
}
