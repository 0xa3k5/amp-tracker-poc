import type { TagProps } from "@edgeandnode/eds-react"
import { formatAddress } from "@edgeandnode/eds-utils"

import { addressBook } from "./data.ts"
import type { Role } from "./types.ts"

export const ROLES: Record<Role, { name: string; tag: TagProps["variant"] }> = {
  binance: { name: "Binance", tag: "solar" },
  attacker: { name: "Attacker", tag: "sonja" },
  intermediary: { name: "Intermediary", tag: "muted" },
  exchange: { name: "Exchange", tag: "elevated" },
  bridge: { name: "Bridge", tag: "brand" },
  issuer: { name: "Issuer", tag: "starfield" },
}

function shorten(address: string, label: string) {
  const first = label
    .split(/\.\s/)[0]!
    .replace(/^Etherscan label:\s*/, "")
    .replace(/\.$/, "")
    .replace(/\s*\([^)]*\)$/, "")
  return first.length < 16 ? `${first} ${formatAddress(address)}` : first
}

const shortLabels = new Map([...addressBook].map(([address, info]) => [address, shorten(address, info.label)]))

export function knownLabel(address: string) {
  return shortLabels.get(address)
}

export function labelFor(address: string) {
  return shortLabels.get(address) ?? formatAddress(address)
}

export function fullLabel(address: string) {
  return addressBook.get(address)?.label
}
