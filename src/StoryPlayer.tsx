import { useEffect, useRef, useState } from "react"
import { Button } from "@edgeandnode/eds-react"
import { CaretLeftIcon, CaretRightIcon, PauseIcon, PlayIcon, XIcon } from "@edgeandnode/eds-react/icons"
import { Panel, useReactFlow } from "@xyflow/react"

import { formatTime } from "./format.ts"
import type { StoryStep } from "./story.ts"
import type { TimeScale } from "./timeScale.ts"

const HOLD_MS = 5000
const MOVE_MS = 1200

interface StoryPlayerProps {
  steps: Array<StoryStep>
  index: number
  scale: TimeScale
  step: number
  onIndexChange: (index: number | null) => void
  onStepChange: (step: number) => void
  onSelect: (id: string | null) => void
}

export function StoryPlayer({ steps, index, scale, step, onIndexChange, onStepChange, onSelect }: StoryPlayerProps) {
  const flow = useReactFlow()
  const [paused, setPaused] = useState(false)
  const stepRef = useRef(step)
  stepRef.current = step
  const current = steps[index]!

  useEffect(() => {
    const from = stepRef.current
    const to = scale.toStep(current.ts)
    const started = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / MOVE_MS)
      onStepChange(from + (to - from) * (1 - (1 - progress) ** 3))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    const present = current.nodeIds.filter((id) => flow.getNode(id))
    onSelect(current.primary && flow.getNode(current.primary) ? current.primary : null)
    void flow.fitView(
      present.length > 0
        ? { nodes: present.map((id) => ({ id })), duration: MOVE_MS, padding: 0.35, maxZoom: 1 }
        : { duration: MOVE_MS, padding: 0.08 },
    )
    return () => cancelAnimationFrame(frame)
  }, [current, scale, flow, onStepChange, onSelect])

  useEffect(() => {
    if (paused) return
    const timer = setTimeout(() => onIndexChange(index + 1 < steps.length ? index + 1 : null), HOLD_MS)
    return () => clearTimeout(timer)
  }, [paused, index, steps.length, onIndexChange])

  return (
    <Panel position="top-center">
      <div className="rounded-8 border-default bg-subtle flex w-[min(36rem,calc(100vw-2rem))] flex-col gap-3 border p-4">
        <div className="text-12 text-muted flex items-center justify-between gap-3">
          <span>
            {index + 1} of {steps.length} · {formatTime(current.ts)}
          </span>
          <Button
            variant="tertiary"
            size="small"
            addonBefore={XIcon}
            hideLabel
            onClick={() => {
              onIndexChange(null)
              onSelect(null)
              void flow.fitView({ duration: 600, padding: 0.08 })
            }}
          >
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
            addonBefore={paused ? PlayIcon : PauseIcon}
            onClick={() => setPaused(!paused)}
          >
            {paused ? "Resume" : "Pause"}
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
    </Panel>
  )
}
