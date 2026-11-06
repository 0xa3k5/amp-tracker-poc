import { createContext, useContext, useEffect, useReducer } from "react"

import sampleJson from "../data/stream-sample.json"
import type { StreamEvent, StreamFreeze, StreamTransfer } from "./stream.ts"

export const HACK_END_BLOCK = 26322290
export const LIVE_DATASET = "a3k5/stablecoin_forensics@0.2.0"
export const MIN_LIVE_USD = 1000

const SAMPLE_START_MS = 1500
const SAMPLE_STEP_MS = 2500
const MAX_EVENTS = 1000

export type LiveEvent = StreamTransfer | StreamFreeze
export type LiveMode = "connecting" | "live" | "down" | "sample"

export interface LiveState {
  mode: LiveMode
  block: number | null
  events: Array<LiveEvent>
  error: string | null
}

const initial: LiveState = { mode: "connecting", block: null, events: [], error: null }

export function eventKey(event: LiveEvent) {
  return event.kind === "transfer"
    ? `t:${event.tx_hash}:${event.log_index}:${event.from}:${event.to}:${event.amount_raw}`
    : `f:${event.freeze_tx}:${event.log_index}`
}

export function eventTx(event: LiveEvent) {
  return event.kind === "transfer" ? event.tx_hash : event.freeze_tx
}

export function isSignificant(event: StreamTransfer) {
  if (event.decimals === null) return false
  return event.amount_usd === undefined || Number(event.amount_usd) >= MIN_LIVE_USD
}

export function feedEvents(events: Array<LiveEvent>) {
  const shown = events.filter((e) => e.kind === "freeze" || isSignificant(e)).toSorted(newestFirst)
  return { shown, small: events.length - shown.length }
}

export function newestFirst(a: LiveEvent, b: LiveEvent) {
  return b.block_num - a.block_num || b.log_index - a.log_index
}

type Action = { type: "event"; event: StreamEvent } | { type: "down"; error: string } | { type: "sample" }

function reduce(state: LiveState, action: Action): LiveState {
  if (action.type === "sample") return { ...initial, mode: "sample" }
  if (action.type === "down") return state.mode === "sample" ? state : { ...state, mode: "down", error: action.error }
  const { event } = action
  const sample = state.mode === "sample"
  const seen = (block: number) => Math.max(state.block ?? 0, block)
  switch (event.kind) {
    case "transfer":
    case "freeze": {
      if (event.block_num <= HACK_END_BLOCK) return state
      const key = eventKey(event)
      if (state.events.some((e) => eventKey(e) === key)) return state
      return { ...state, block: seen(event.block_num), events: [...state.events, event].slice(-MAX_EVENTS) }
    }
    case "progress":
      return { ...state, block: seen(event.block_num), mode: sample ? "sample" : "live", error: null }
    case "reorg": {
      const kind = event.stream === "transfers" ? "transfer" : "freeze"
      return { ...state, events: state.events.filter((e) => e.kind !== kind || e.block_num < event.block_num) }
    }
    case "error":
      return sample ? state : { ...state, mode: "down", error: event.message }
  }
}

const sampleEvents = (sampleJson as { events: Array<StreamEvent> }).events

function replaySample(dispatch: (action: Action) => void) {
  dispatch({ type: "sample" })
  const timers = sampleEvents.map((event, index) =>
    setTimeout(() => dispatch({ type: "event", event }), SAMPLE_START_MS + index * SAMPLE_STEP_MS),
  )
  return () => timers.forEach(clearTimeout)
}

export function useLiveStream(): LiveState {
  const [state, dispatch] = useReducer(reduce, initial)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("stream") === "sample") return replaySample(dispatch)
    let stopSample: (() => void) | undefined
    const source = new EventSource("/api/stream")
    source.onmessage = (message) => {
      const event = JSON.parse(String(message.data)) as StreamEvent
      if (event.kind === "error" && event.stream === null && /credentials/i.test(event.message)) {
        source.close()
        stopSample = replaySample(dispatch)
        return
      }
      dispatch({ type: "event", event })
    }
    source.onerror = () => dispatch({ type: "down", error: "The app server's stream is not reachable." })
    return () => {
      source.close()
      stopSample?.()
    }
  }, [])

  return state
}

export const LiveContext = createContext<LiveState>(initial)

export function useLive() {
  return useContext(LiveContext)
}
