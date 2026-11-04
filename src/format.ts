const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
const plain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })
const time = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
})

export function formatAmount(value: number) {
  return Math.abs(value) >= 1_000_000 ? compact.format(value) : plain.format(value)
}

export function formatBlock(value: number) {
  return plain.format(value)
}

export function formatTime(iso: string) {
  return `${time.format(new Date(iso))} UTC`
}

export function shortHash(hash: string) {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`
}
