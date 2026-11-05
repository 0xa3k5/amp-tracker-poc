import { useEffect, useRef, useState } from "react"
import { Button } from "@edgeandnode/eds-react"
import { PauseIcon, PlayIcon } from "@edgeandnode/eds-react/icons"

import { useOpenDetails } from "./details.ts"
import { formatTime } from "./format.ts"
import type { Moment } from "./incident.ts"
import { KNEE, STEPS, type TimeScale } from "./timeScale.ts"

const DURATION_MS = 24_000

interface ScrubberProps {
  scale: TimeScale
  step: number
  moments: Array<Moment>
  onStepChange: (step: number) => void
}

export function Scrubber({ scale, step, moments, onStepChange }: ScrubberProps) {
  const open = useOpenDetails()
  const [playing, setPlaying] = useState(false)
  const stepRef = useRef(step)
  stepRef.current = step

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const next = Math.min(STEPS, stepRef.current + ((now - last) / DURATION_MS) * STEPS)
      last = now
      onStepChange(next)
      if (next >= STEPS) setPlaying(false)
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, onStepChange])

  return (
    <div className="rounded-8 border-muted bg-subtle flex w-[min(56rem,calc(100vw-2rem))] items-center gap-4 border p-3">
      <Button
        variant="secondary"
        size="small"
        addonBefore={playing ? PauseIcon : PlayIcon}
        onClick={() => {
          if (!playing && step >= STEPS) onStepChange(0)
          setPlaying(!playing)
        }}
        className="shrink-0"
      >
        {playing ? "Pause" : "Replay"}
      </Button>
      <div className="relative flex min-w-0 flex-1 flex-col gap-1 pt-7">
        <span
          className="rounded-4 bg-elevated text-12 pointer-events-none absolute top-0 -translate-x-1/2 px-1.5 py-0.5 font-medium whitespace-nowrap"
          style={{ left: `calc(${(step / STEPS) * 100}% + ${(0.5 - step / STEPS) * 16}px)` }}
        >
          {formatTime(scale.toTime(step))}
        </span>
        <input
          type="range"
          min={0}
          max={STEPS}
          value={step}
          aria-label="Time"
          aria-valuetext={formatTime(scale.toTime(step))}
          onChange={(event) => {
            setPlaying(false)
            onStepChange(Number(event.currentTarget.value))
          }}
          className="w-full accent-(--background-color-brand-default)"
        />
        <div className="relative h-3">
          {moments.map((moment) => (
            <button
              key={moment.hash + moment.title}
              type="button"
              title={`${formatTime(moment.ts)}: ${moment.title}`}
              aria-label={moment.title}
              data-freeze={moment.freeze || undefined}
              onClick={() => {
                setPlaying(false)
                onStepChange(scale.toStep(moment.ts))
                open(moment.open)
              }}
              className="bg-strong data-freeze:bg-status-info-default absolute top-0.5 size-2.5 -translate-x-1/2 rounded-full hover:scale-150"
              style={{
                left: `calc(${(scale.toStep(moment.ts) / STEPS) * 100}% + ${(0.5 - scale.toStep(moment.ts) / STEPS) * 16}px)`,
              }}
            />
          ))}
        </div>
        <div className="text-10 text-muted relative h-3">
          <span className="absolute start-0">Drain starts</span>
          <span className="absolute -translate-x-1/2" style={{ left: `${(KNEE / STEPS) * 100}%` }}>
            {formatTime(scale.knee)}
          </span>
          <span className="absolute end-0">End of window</span>
        </div>
      </div>
    </div>
  )
}
