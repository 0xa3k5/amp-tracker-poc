// Fails when a story step lights no card on the canvas. Runs before `vite build`.
import { createServer } from "vite"

const server = await createServer({
  configFile: false,
  logLevel: "error",
  server: { middlewareMode: true },
  appType: "custom",
})
try {
  const { incident } = await server.ssrLoadModule("/src/incident.ts")
  const { storySteps, unlitSteps } = await server.ssrLoadModule("/src/story.ts")
  const steps = storySteps(incident)
  const unlit = unlitSteps(incident, steps)
  if (unlit.length > 0) {
    console.error(`Story check failed. These steps light no card on the canvas: ${unlit.join("; ")}`)
    process.exitCode = 1
  } else {
    console.log(`Story check: all ${steps.length} steps light at least one card.`)
  }
} finally {
  await server.close()
}
