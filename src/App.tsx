import { useCallback, useState } from "react"
import { Pane, usePane } from "@edgeandnode/eds-react"

import { OpenDetails, type Details } from "./details.ts"
import { DetailsPane } from "./DetailsPane.tsx"
import { Footer } from "./Footer.tsx"
import { FundFlow } from "./FundFlow.tsx"
import { Header } from "./Header.tsx"
import { incident } from "./incident.ts"
import { KeyMoments } from "./KeyMoments.tsx"
import { NotFrozen } from "./NotFrozen.tsx"
import { Summary } from "./Summary.tsx"

export function App() {
  const [details, setDetails] = useState<Details | null>(null)
  const pane = usePane("details", { defaultCollapsed: true })
  const { layout, setCollapsed, setOverlayOpen } = pane

  const openDetails = useCallback(
    (next: Details) => {
      setDetails(next)
      if (layout === "overlay") setOverlayOpen(true)
      else setCollapsed(false)
    },
    [layout, setCollapsed, setOverlayOpen],
  )

  const close = () => {
    if (layout === "overlay") setOverlayOpen(false)
    else setCollapsed(true)
  }

  return (
    <OpenDetails value={openDetails}>
      <Pane.Container className="flex h-dvh">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-360 flex-col gap-10 p-4 sm:p-6 lg:p-8">
            <Header />
            <Summary incident={incident} />
            <FundFlow incident={incident} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <KeyMoments incident={incident} />
              </div>
              <div className="lg:col-span-5">
                <NotFrozen incident={incident} />
              </div>
            </div>
            <Footer />
          </div>
        </div>
        <Pane
          name="details"
          side="end"
          className="border-muted bg-subtle max-xl:prop-layout-overlay w-140 max-w-[calc(100vw-(--spacing(8)))] overflow-y-auto border-s"
        >
          <DetailsPane details={details} onClose={close} />
        </Pane>
      </Pane.Container>
    </OpenDetails>
  )
}
