import { Link } from "@edgeandnode/eds-react"

const SOURCES = [
  {
    name: "TRM Labs",
    href: "https://www.trmlabs.com/resources/blog/north-korea-steals-usd-6-36-billion-from-binance-in-the-largest-hack-in-history",
  },
  {
    name: "CNBC",
    href: "https://www.cnbc.com/2026/10/30/billions-in-crypto-frozen-in-binance-hack-heres-what-happens-next-.html",
  },
  { name: "Wikipedia", href: "https://en.wikipedia.org/wiki/2026_Binance_hack" },
]

export function Footer() {
  return (
    <footer className="border-subtle text-12 text-muted mt-auto flex flex-col gap-2 border-t pt-6">
      <p>
        Address labels and attribution come from TRM Labs, Chainalysis and the FBI. This tool shows what the chain
        records and makes no attribution claims of its own. All on-chain data is queried from Amp.
      </p>
      <p className="flex flex-wrap gap-4">
        <span>Sources:</span>
        {SOURCES.map((source) => (
          <Link key={source.name} variant="secondary" href={source.href} target="_blank">
            {source.name}
          </Link>
        ))}
      </p>
    </footer>
  )
}
