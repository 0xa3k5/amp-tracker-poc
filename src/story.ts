import { transfers } from "./data.ts"
import { formatUsd } from "./format.ts"
import type { Incident } from "./incident.ts"

export interface StoryStep {
  ts: string
  title: string
  detail: string
  hash: string | null
  nodeIds: Array<string>
  primary: string | null
}

const FROZEN = "frozen"
const HELD = "held"
const transfersByTx = Map.groupBy(transfers, (t) => t.tx_hash)

export function storySteps(incident: Incident): Array<StoryStep> {
  const resolve = (ids: Iterable<string>) => [
    ...new Set([...ids].map(incident.nodeIdFor).filter((id): id is string => id !== null)),
  ]
  const frozenSources = incident.flow.links.filter((link) => link.target === FROZEN).map((link) => link.source)
  const steps = incident.moments.map((moment): StoryStep => {
    const moved = transfersByTx.get(moment.hash) ?? []
    const raw = [...moment.addresses, ...moved.flatMap((t) => [t.from, t.to])]
    if (moment.freeze) {
      raw.push(FROZEN)
      if (moment.focus === FROZEN) raw.push(...frozenSources)
    }
    const nodeIds = resolve(raw)
    const focus = moment.focus ? incident.nodeIdFor(moment.focus) : null
    return {
      ts: moment.ts,
      title: moment.title,
      detail: moment.detail,
      hash: moment.hash,
      nodeIds,
      primary: focus ?? nodeIds[0] ?? null,
    }
  })
  const held = incident.flow.links.filter((link) => link.target === HELD).reduce((sum, link) => sum + link.value, 0)
  steps.push({
    ts: incident.window?.toTs ?? steps.at(-1)?.ts ?? "",
    title: "Where it is now",
    detail: `${formatUsd(incident.frozen)} frozen by issuers on Ethereum in the hack window, ${formatUsd(held)} still in the attacker's wallets.`,
    hash: null,
    nodeIds: resolve([FROZEN, HELD]),
    primary: null,
  })
  return steps
}

export function unlitSteps(incident: Incident, steps = storySteps(incident)) {
  const nodes = new Set(incident.flow.nodes.map((node) => node.id))
  return steps.filter((step) => !step.nodeIds.some((id) => nodes.has(id))).map((step) => step.title)
}
