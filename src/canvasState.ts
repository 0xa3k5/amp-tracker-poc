import { createContext, useContext } from "react"

export interface CanvasState {
  time: string
  focus: Set<string> | null
  selected: string | null
  lit: Set<string> | null
}

export const CanvasStateContext = createContext<CanvasState>({ time: "", focus: null, selected: null, lit: null })

export function useCanvasState() {
  return useContext(CanvasStateContext)
}

export function isVisible(firstTs: string, time: string) {
  return !firstTs || firstTs <= time
}

const RECENT_MS = 15 * 60 * 1000

export function isRecent(firstTs: string, time: string) {
  if (!firstTs) return false
  const age = Date.parse(time) - Date.parse(firstTs)
  return age >= 0 && age < RECENT_MS
}
