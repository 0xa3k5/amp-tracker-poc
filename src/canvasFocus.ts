import { CARD_HEIGHT, CARD_WIDTH } from "./canvasLayout.ts"

export const READABLE_ZOOM = 0.9
const MAX_ZOOM = 1
const PADDING = 32

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

export function cardBox(position: { x: number; y: number }): Box {
  return { x: position.x, y: position.y, w: CARD_WIDTH, h: CARD_HEIGHT }
}

function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }
}

export function visibleArea(width: number, height: number, insets: Insets): Box {
  return {
    x: insets.left,
    y: insets.top,
    w: Math.max(1, width - insets.left - insets.right),
    h: Math.max(1, height - insets.top - insets.bottom),
  }
}

function fitZoom(box: Box, area: Box) {
  return Math.min((area.w - 2 * PADDING) / box.w, (area.h - 2 * PADDING) / box.h)
}

const center = (box: Box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 })

export function focusViewport(primary: Box, others: Array<Box>, area: Box) {
  const origin = center(primary)
  const distance = (box: Box) => Math.hypot(center(box).x - origin.x, center(box).y - origin.y)
  let box = primary
  for (const other of others.toSorted((a, b) => distance(a) - distance(b))) {
    const next = union(box, other)
    if (fitZoom(next, area) >= READABLE_ZOOM) box = next
  }
  const zoom = Math.min(MAX_ZOOM, Math.max(READABLE_ZOOM, fitZoom(box, area)))
  const middle = center(box)
  return {
    x: area.x + area.w / 2 - middle.x * zoom,
    y: area.y + area.h / 2 - middle.y * zoom,
    zoom,
  }
}

export function startViewport(boxes: Array<Box>, area: Box) {
  const box = boxes.reduce(union)
  const zoom = READABLE_ZOOM
  return {
    x: area.x + PADDING - box.x * zoom,
    y: area.y + area.h / 2 - (box.y + box.h / 2) * zoom,
    zoom,
  }
}

export function inView(box: Box, viewport: { x: number; y: number; zoom: number }, area: Box) {
  const left = box.x * viewport.zoom + viewport.x
  const top = box.y * viewport.zoom + viewport.y
  return (
    left >= area.x &&
    top >= area.y &&
    left + box.w * viewport.zoom <= area.x + area.w &&
    top + box.h * viewport.zoom <= area.y + area.h
  )
}
