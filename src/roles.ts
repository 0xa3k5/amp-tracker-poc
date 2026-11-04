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

export function labelFor(address: string) {
  return addressBook.get(address)?.label ?? formatAddress(address)
}
