import { useState } from "react"
import { Button, DescriptionList, Input, Tag } from "@edgeandnode/eds-react"
import { SnowflakeIcon } from "@edgeandnode/eds-react/icons"

import { isMock } from "./data.ts"
import { formatAmount, formatBlock, formatTime } from "./format.ts"
import { isAddress, normalizeAddress, type Trace } from "./trace.ts"

interface HeaderProps {
  root: string
  trace: Trace
  freezeIndex: number
  onTrace: (address: string) => void
  onJumpToFreeze: () => void
}

export function Header({ root, trace, freezeIndex, onTrace, onJumpToFreeze }: HeaderProps) {
  const [value, setValue] = useState(root)
  const [invalid, setInvalid] = useState(false)
  const range = trace.blockRange

  return (
    <header className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-24 font-medium">Binance hot wallet hack, 29 October 2026</h1>
        {isMock ? <Tag variant="solar">Mock data</Tag> : null}
      </div>
      <form
        className="flex max-w-240 flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const address = normalizeAddress(value)
          setInvalid(!isAddress(address))
          if (isAddress(address)) onTrace(address)
        }}
      >
        <Input
          label="Attacker address"
          placeholder="0x…"
          value={value}
          onValueChange={setValue}
          status={invalid ? "error" : undefined}
          message={invalid ? "Paste a full Ethereum address: 0x followed by 40 hex characters." : undefined}
          spellCheck={false}
          autoComplete="off"
        />
        <Button type="submit" variant="primary" className="shrink-0">
          Trace
        </Button>
        {trace.freezes.length > 0 ? (
          <Button
            type="button"
            variant="secondary"
            addonBefore={SnowflakeIcon}
            className="shrink-0"
            onClick={onJumpToFreeze}
          >
            {freezeIndex < 0
              ? `Jump to USDT freeze (${trace.freezes.length})`
              : `Freeze ${freezeIndex + 1} of ${trace.freezes.length}`}
          </Button>
        ) : null}
      </form>
      <DescriptionList orientation="horizontal">
        <DescriptionList.Item
          label="Block range"
          description={range ? `${formatTime(range.fromTs)} to ${formatTime(range.toTs)}` : undefined}
        >
          {range ? `${formatBlock(range.from)} to ${formatBlock(range.to)}` : "None"}
        </DescriptionList.Item>
        <DescriptionList.Item label="ETH moved" description="ETH and WETH out of Binance wallets">
          {formatAmount(trace.ethMoved)}
        </DescriptionList.Item>
        <DescriptionList.Item label="USDT moved" description="Out of Binance wallets">
          {formatAmount(trace.usdtMoved)}
        </DescriptionList.Item>
        <DescriptionList.Item label="Hops" description="To the furthest address reached">
          {trace.hops}
        </DescriptionList.Item>
        <DescriptionList.Item label="Addresses touched">{trace.addresses.length}</DescriptionList.Item>
      </DescriptionList>
    </header>
  )
}
