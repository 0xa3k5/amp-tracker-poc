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
const transfersByTx = Map.groupBy(transfers, (t) => t.tx_hash)

export function storySteps(incident: Incident): Array<StoryStep> {
  const frozenSources = incident.flow.links.filter((link) => link.target === FROZEN).map((link) => link.source)
  const steps = incident.moments.map((moment): StoryStep => {
    const moved = transfersByTx.get(moment.hash) ?? []
    const ids = new Set([...moved.flatMap((t) => [t.from, t.to]), ...moment.addresses])
    if (moment.freeze) {
      ids.add(FROZEN)
      if (moment.focus === FROZEN) for (const source of frozenSources) ids.add(source)
    }
    return {
      ts: moment.ts,
      title: moment.title,
      detail: moment.detail,
      hash: moment.hash,
      nodeIds: [...ids],
      primary: moment.focus ?? moved[0]?.to ?? null,
    }
  })
  const held = incident.flow.links.filter((link) => link.target === "held").reduce((sum, link) => sum + link.value, 0)
  steps.push({
    ts: incident.window?.toTs ?? steps.at(-1)?.ts ?? "",
    title: "Where it is now",
    detail: `${formatUsd(incident.frozen)} frozen by issuers on Ethereum in the hack window, ${formatUsd(held)} still in the attacker's wallets.`,
    hash: null,
    nodeIds: [],
    primary: null,
  })
  return steps
}
