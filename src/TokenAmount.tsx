import { cn } from "@edgeandnode/eds-react/utils"
import { NetworkIcon, TokenIcon } from "@web3icons/react/dynamic"

import { formatAmount } from "./format.ts"

const ALIASES: Record<string, string> = { WETH: "ETH", aEthUSDT: "USDT", variableDebtEthWETH: "ETH" }

export function TokenMark({ symbol, size = 16, className }: { symbol: string; size?: number; className?: string }) {
  return (
    <TokenIcon
      symbol={ALIASES[symbol] ?? symbol}
      variant="branded"
      size={size}
      className={cn("shrink-0", className)}
      fallback={
        <span
          aria-hidden
          className={cn(
            "bg-elevated text-muted text-10 inline-flex shrink-0 items-center justify-center rounded-full",
            className,
          )}
          style={{ width: size, height: size }}
        >
          {symbol.slice(0, 1)}
        </span>
      }
    />
  )
}

export function EthereumMark({ size = 16, className }: { size?: number; className?: string }) {
  return <NetworkIcon name="ethereum" variant="branded" size={size} className={cn("shrink-0", className)} />
}

export function TokenAmount({ symbol, amount, className }: { symbol: string; amount: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", className)}>
      <TokenMark symbol={symbol} />
      {`${formatAmount(amount)} ${symbol}`}
    </span>
  )
}
