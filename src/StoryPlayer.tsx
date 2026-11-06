import { useEffect, useRef, type Ref } from "react"
import { Button } from "@edgeandnode/eds-react"
import { CaretLeftIcon, CaretRightIcon, XIcon } from "@edgeandnode/eds-react/icons"

import { formatTime } from "./format.ts"
import type { StoryStep } from "./story.ts"
import type { TimeScale } from "./timeScale.ts"

const HOLD_MS = 5000
const MOVE_MS = 1200
const SWEEP_MS = 6000

interface StoryPlayerProps {
  ref: Ref<HTMLDivElement>
  steps: Array<StoryStep>
  index: number
  paused: boolean
  scale: TimeScale
  step: number
  onIndexChange: (index: number | null) => void
  onStepChange: (step: number) => void
  onSelect: (id: string | null) => void
  onFocus: (primary: string, others: Array<string>) => void
  isInView: (id: string) => boolean
  onClose: () => void
}

export function StoryPlayer({
  ref,
  steps,
  index,
  paused,
  scale,
  step,
  onIndexChange,
  onStepChange,
  onSelect,
  onFocus,
  isInView,
  onClose,
}: StoryPlayerProps) {
  const stepRef = useRef(step)
  stepRef.current = step
  const inViewRef = useRef(isInView)
  inViewRef.current = isInView
  const focusRef = useRef(onFocus)
  focusRef.current = onFocus
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const current = steps[index]!

  useEffect(() => {
    const from = stepRef.current
    const to = scale.toStep(current.ts)
    const until = current.until ? scale.toStep(current.until) : null
    const sequence = current.sequence.map((entry) => ({ ...entry, at: scale.toStep(entry.ts) }))
    onSelect(current.primary)
    if (current.primary) focusRef.current(current.primary, current.nodeIds)
    if (pausedRef.current) {
      onStepChange(until ?? to)
      return
    }
    const shown: Array<string> = []
    const started = performance.now()
    let frame = 0
    const tick = (now: number) => {
      if (pausedRef.current) return
      const elapsed = now - started
      if (elapsed < MOVE_MS || until === null) {
        const progress = Math.min(1, elapsed / MOVE_MS)
        onStepChange(from + (to - from) * (1 - (1 - progress) ** 3))
        if (progress < 1) frame = requestAnimationFrame(tick)
        return
      }
      const progress = Math.min(1, (elapsed - MOVE_MS) / SWEEP_MS)
      const at = to + (until - to) * progress
      onStepChange(at)
      for (const entry of sequence) {
        if (entry.at > at || shown.includes(entry.id)) continue
        shown.push(entry.id)
        onSelect(entry.id)
        if (!inViewRef.current(entry.id)) focusRef.current(entry.id, shown.slice(0, -1).toReversed())
      }
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [current, scale, onStepChange, onSelect])

  useEffect(() => {
    if (paused) return
    const hold = HOLD_MS + (current.until ? SWEEP_MS : 0)
    const timer = setTimeout(() => onIndexChange(index + 1 < steps.length ? index + 1 : null), hold)
    return () => clearTimeout(timer)
  }, [paused, index, current, steps.length, onIndexChange])

  return (
    <div
      ref={ref}
      className="rounded-8 border-default bg-subtle pointer-events-auto flex w-full max-w-144 flex-col gap-3 border p-4"
    >
      <div className="text-12 text-muted flex items-center justify-between gap-3">
        <span>
          {index + 1} of {steps.length} · {formatTime(current.ts)}
        </span>
        <Button variant="tertiary" size="small" addonBefore={XIcon} hideLabel onClick={onClose}>
          Close story
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-18 font-medium">{current.title}</p>
        <p className="text-14 text-muted">{current.detail}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="small"
          addonBefore={CaretLeftIcon}
          hideLabel
          disabled={index === 0}
          onClick={() => onIndexChange(index - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="small"
          addonBefore={CaretRightIcon}
          hideLabel
          disabled={index + 1 >= steps.length}
          onClick={() => onIndexChange(index + 1)}
        >
          Next
        </Button>
        <div className="ms-auto flex gap-1">
          {steps.map((item, dot) => (
            <span
              key={item.title}
              data-active={dot === index || undefined}
              className="bg-strong data-active:bg-brand-default size-1.5 rounded-full"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
