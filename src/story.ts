import { takeoverIds } from "./canvasLayout.ts"
import { transfers } from "./data.ts"
import { formatUsd } from "./format.ts"
import { frozenByAddress } from "./freezes.ts"
import type { Incident } from "./incident.ts"

export interface StoryStep {
  ts: string
  until: string | null
  title: string
  detail: string
  hash: string | null
  nodeIds: Array<string>
  primary: string | null
  sequence: Array<{ ts: string; id: string }>
}

const FROZEN = "frozen"
const HELD = "held"
const transfersByTx = Map.groupBy(transfers, (t) => t.tx_hash)
const extra = new Set(takeoverIds)

export function storySteps(incident: Incident): Array<StoryStep> {
  const idFor = (id: string) => incident.nodeIdFor(id) ?? (extra.has(id) ? id : null)
  const resolve = (ids: Iterable<string>) => [...new Set([...ids].map(idFor).filter((id) => id !== null))]
  const steps = incident.moments.map((moment): StoryStep => {
    const moved = moment.freeze ? [] : (transfersByTx.get(moment.hash) ?? [])
    const nodeIds = resolve([...moment.addresses, ...moved.flatMap((t) => [t.from, t.to])])
    const focus = moment.focus ? idFor(moment.focus) : null
    const sequence = moment.until
      ? nodeIds
          .map((id) => ({
            id,
            ts: frozenByAddress.get(id)?.tokens.find((t) => t.ts >= moment.ts && t.ts <= moment.until!)?.ts ?? "",
          }))
          .filter((entry) => entry.ts !== "")
          .sort((a, b) => a.ts.localeCompare(b.ts))
      : []
    return {
      ts: moment.ts,
      until: moment.until,
      title: moment.title,
      detail: moment.detail,
      hash: moment.hash,
      nodeIds,
      primary: focus ?? nodeIds[0] ?? null,
      sequence,
    }
  })
  steps.push({
    ts: incident.window?.toTs ?? steps.at(-1)?.ts ?? "",
    until: null,
    title: "Where it is now",
    detail: `${formatUsd(incident.frozen)} frozen, ${formatUsd(Math.max(0, incident.taken - incident.frozen))} not frozen`,
    hash: null,
    nodeIds: resolve([FROZEN, HELD]),
    primary: FROZEN,
    sequence: [],
  })
  return steps
}

export function unlitSteps(incident: Incident, steps = storySteps(incident)) {
  const nodes = new Set([...incident.flow.nodes.map((node) => node.id), ...extra])
  return steps.filter((step) => !step.nodeIds.some((id) => nodes.has(id))).map((step) => step.title)
}
