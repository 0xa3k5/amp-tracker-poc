import { createContext, useContext } from "react"

export interface CanvasState {
  time: string
  focus: Set<string> | null
  selected: string | null
}

export const CanvasStateContext = createContext<CanvasState>({ time: "", focus: null, selected: null })

export function useCanvasState() {
  return useContext(CanvasStateContext)
}

export function isVisible(firstTs: string, time: string) {
  return !firstTs || firstTs <= time
}
