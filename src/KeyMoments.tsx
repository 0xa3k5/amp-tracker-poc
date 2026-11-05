import { Button, Card, Status } from "@edgeandnode/eds-react"

import { transactions } from "./data.ts"
import { useOpenDetails } from "./details.ts"
import { formatBlock, formatTime } from "./format.ts"
import type { Incident } from "./incident.ts"
import { SqlButton } from "./SqlButton.tsx"

export function KeyMoments({ incident }: { incident: Incident }) {
  const open = useOpenDetails()

  return (
    <Card variant="tertiary" as="section" aria-labelledby="moments-title">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="moments-title" className="text-18 font-medium">
            Key moments
          </h2>
          <SqlButton query="attacker-transactions" />
        </div>
        <ol className="flex flex-col">
          {incident.moments.map((moment) => (
            <li key={moment.title} className="not-last:border-subtle not-last:border-b">
              <button
                type="button"
                data-freeze={moment.freeze || undefined}
                onClick={() => open(moment.open)}
                className="hover:bg-muted rounded-6 grid w-full grid-cols-[7rem_1fr] gap-x-4 gap-y-1 px-2 py-3 text-start"
              >
                <span className="text-12 text-muted pt-0.5">{formatTime(moment.ts)}</span>
                <span className="text-14 flex flex-wrap items-center gap-2 font-medium">
                  {moment.title}
                  {moment.freeze ? <Status variant="info">Freeze</Status> : null}
                </span>
                <span className="text-14 text-muted col-start-2">{moment.detail}</span>
              </button>
            </li>
          ))}
        </ol>
        <Button variant="secondary" size="small" className="self-start" onClick={() => open({ kind: "transactions" })}>
          All {formatBlock(transactions.length)} transactions
        </Button>
      </div>
    </Card>
  )
}
