import { useMemo, useState } from "react"
import { Button } from "@edgeandnode/eds-react"

import { addresses, transfers } from "./data.ts"
import { FlowGraph } from "./FlowGraph.tsx"
import { Footer } from "./Footer.tsx"
import { Header } from "./Header.tsx"
import { labelFor } from "./roles.ts"
import { SqlPanel } from "./SqlPanel.tsx"
import { Timeline, type TimelineFilter, type TimelineFocus } from "./Timeline.tsx"
import { buildTrace } from "./trace.ts"

const senders = new Set(transfers.map((t) => t.from))
const SUGGESTED = addresses.filter((a) => a.role === "attacker" && senders.has(a.address))
const DEFAULT_ROOT = SUGGESTED.find((a) => a.label.startsWith("Main receiving"))?.address ?? SUGGESTED[0]?.address ?? ""

export function App() {
  const [root, setRoot] = useState(DEFAULT_ROOT)
  const [selected, setSelected] = useState<string | null>(null)
  const [focus, setFocus] = useState<TimelineFocus | null>(null)
  const trace = useMemo(() => buildTrace(root), [root])

  const filter = useMemo<TimelineFilter | null>(() => {
    const node = selected ? trace.nodes.find((n) => n.id === selected) : undefined
    if (!node) return null
    const label = node.group ? `${node.members.length} unlabelled addresses` : labelFor(node.members[0]!)
    return { label, members: new Set(node.members) }
  }, [trace, selected])

  const startTrace = (address: string) => {
    setRoot(address)
    setSelected(null)
    setFocus(null)
  }

  const freezeIndex = focus ? trace.freezes.findIndex((tx) => tx.hash === focus.hash) : -1

  return (
    <div className="flex min-h-screen flex-col gap-8 p-4 sm:p-6 lg:p-8">
      <Header
        key={root}
        root={root}
        trace={trace}
        freezeIndex={freezeIndex}
        onTrace={startTrace}
        onJumpToFreeze={() => {
          const next = trace.freezes[(freezeIndex + 1) % trace.freezes.length]
          if (!next) return
          setSelected(null)
          setFocus((current) => ({ hash: next.hash, nonce: (current?.nonce ?? 0) + 1 }))
        }}
      />
      {trace.transfers.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-14 text-muted">
            No token or ETH transfers from this address in the block range. Try one of these:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTED.map((a) => (
              <Button key={a.address} size="small" variant="secondary" onClick={() => startTrace(a.address)}>
                {labelFor(a.address)}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <main className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
          <Timeline
            trace={trace}
            filter={filter}
            focus={focus}
            onClear={() => setSelected(null)}
            className="xl:col-span-4"
          />
          <FlowGraph
            trace={trace}
            selected={selected}
            onSelect={setSelected}
            className="max-lg:h-140 lg:h-200 xl:col-span-5"
          />
          <SqlPanel className="lg:col-span-2 xl:col-span-3" />
        </main>
      )}
      <Footer />
    </div>
  )
}
