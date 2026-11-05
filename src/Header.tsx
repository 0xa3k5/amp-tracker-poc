import { useState } from "react"
import { Button, Input, SegmentedControl, Tag, ThemeSwitcher } from "@edgeandnode/eds-react"
import { TerminalWindowIcon } from "@edgeandnode/eds-react/icons"

import { isMock, queries } from "./data.ts"
import { useOpenDetails } from "./details.ts"
import { EthereumMark } from "./TokenAmount.tsx"
import { isAddress, normalizeAddress } from "./trace.ts"

export type View = "canvas" | "report"

export function Header({ view, onViewChange }: { view: View; onViewChange: (view: View) => void }) {
  const open = useOpenDetails()
  const [value, setValue] = useState("")
  const [invalid, setInvalid] = useState(false)

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-16 flex items-center gap-2 font-medium">
          <EthereumMark size={20} />
          Binance hot wallet hack · 29 October 2026
        </h1>
        {isMock ? <Tag variant="solar">Mock data</Tag> : null}
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <SegmentedControl
          size="small"
          aria-label="View"
          value={view}
          onValueChange={(value) => onViewChange(value as View)}
        >
          <SegmentedControl.Option value="canvas">Canvas</SegmentedControl.Option>
          <SegmentedControl.Option value="report">Report</SegmentedControl.Option>
        </SegmentedControl>
        <form
          className="flex items-start gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const address = normalizeAddress(value)
            setInvalid(!isAddress(address))
            if (isAddress(address)) open({ kind: "address", address })
          }}
        >
          <Input
            size="small"
            aria-label="Look up an address"
            placeholder="Look up an address, 0x…"
            value={value}
            onValueChange={setValue}
            status={invalid ? "error" : undefined}
            message={invalid ? "Paste a full address: 0x and 40 hex characters." : undefined}
            spellCheck={false}
            autoComplete="off"
            className="w-80"
          />
          <Button type="submit" variant="secondary" size="small" className="shrink-0">
            Look up
          </Button>
        </form>
        <Button
          variant="tertiary"
          size="small"
          addonBefore={TerminalWindowIcon}
          onClick={() => open({ kind: "sql", query: queries[0]?.name ?? "" })}
        >
          How Amp got this
        </Button>
        <ThemeSwitcher size="small" />
      </div>
    </header>
  )
}
