import { createContext, useContext } from "react"

export type Details =
  | { kind: "address"; address: string }
  | { kind: "tx"; hash: string }
  | { kind: "live"; hash: string }
  | { kind: "sql"; query: string }
  | { kind: "transactions" }
  | { kind: "frozen" }
  | { kind: "delegation" }
  | { kind: "compare" }

export const OpenDetails = createContext<(details: Details) => void>(() => {})

export function useOpenDetails() {
  return useContext(OpenDetails)
}
