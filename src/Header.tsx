import { useState } from "react"
import { Button, Input, SegmentedControl, Tag, ThemeSwitcher } from "@edgeandnode/eds-react"
import { TerminalWindowIcon } from "@edgeandnode/eds-react/icons"

import { isMock, queries } from "./data.ts"
import { useOpenDetails } from "./details.ts"
import { LiveIndicator } from "./LiveIndicator.tsx"
import { EthereumMark } from "./TokenAmount.tsx"
import { isAddress, normalizeAddress } from "./trace.ts"

export type View = "canvas" | "report"

interface HeaderProps {
  view: View
  onViewChange: (view: View) => void
  onLookup: (address: string) => void
}

export function Header({ view, onViewChange, onLookup }: HeaderProps) {
  const open = useOpenDetails()
  const [value, setValue] = useState("")
  const [invalid, setInvalid] = useState(false)
  const showSql = () => open({ kind: "sql", query: queries[0]?.name ?? "" })

  return (
    <header className="@container flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-16 flex items-center gap-2 font-medium">
          <EthereumMark size={20} />
          Binance hot wallet hack<span className="@max-5xl:hidden"> · 29 October 2026</span>
        </h1>
        {isMock ? <Tag variant="solar">Mock data</Tag> : null}
        <LiveIndicator />
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
            if (!isAddress(address)) return
            open({ kind: "address", address })
            onLookup(address)
          }}
        >
          <Input
            size="small"
            aria-label="Look up an address"
            placeholder="Look up an address, 0x…"
            value={value}
            onValueChange={setValue}
            status={invalid ? "error" : undefined}
            message={invalid ? "Not a valid address" : undefined}
            spellCheck={false}
            autoComplete="off"
            className="w-80 @max-5xl:w-48"
          />
          <Button type="submit" variant="secondary" size="small" className="shrink-0">
            Look up
          </Button>
        </form>
        <Button
          variant="tertiary"
          size="small"
          addonBefore={TerminalWindowIcon}
          className="@max-5xl:hidden"
          onClick={showSql}
        >
          How Amp got this
        </Button>
        <Button
          variant="tertiary"
          size="small"
          addonBefore={TerminalWindowIcon}
          hideLabel
          className="hidden @max-5xl:inline-flex"
          onClick={showSql}
        >
          How Amp got this
        </Button>
        <ThemeSwitcher size="small" />
      </div>
    </header>
  )
}
