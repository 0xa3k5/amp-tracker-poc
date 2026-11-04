export const STEPS = 1000
export const KNEE = 700

export interface TimeScale {
  toTime: (step: number) => string
  toStep: (iso: string) => number
  knee: string
}

export function timeScale(startIso: string, endIso: string): TimeScale {
  const start = Date.parse(startIso)
  const end = Math.max(start + 1, Date.parse(endIso))
  const knee = Math.min(end, start + 2 * 60 * 60 * 1000)
  return {
    knee: new Date(knee).toISOString(),
    toTime: (step) => {
      const ms =
        step <= KNEE ? start + (step / KNEE) * (knee - start) : knee + ((step - KNEE) / (STEPS - KNEE)) * (end - knee)
      return new Date(Math.round(ms)).toISOString().replace(".000Z", "Z")
    },
    toStep: (iso) => {
      const ms = Date.parse(iso)
      if (ms <= knee) return Math.max(0, ((ms - start) / (knee - start)) * KNEE)
      return Math.min(STEPS, KNEE + ((ms - knee) / (end - knee)) * (STEPS - KNEE))
    },
  }
}
