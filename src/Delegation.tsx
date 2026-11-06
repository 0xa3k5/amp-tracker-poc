import { CopyButton, DescriptionList, Link } from "@edgeandnode/eds-react"

import { useOpenDetails } from "./details.ts"
import { txUrl } from "./explorer.ts"
import { formatTime, shortHash } from "./format.ts"
import { takeover } from "./freezes.ts"
import { labelFor } from "./roles.ts"
import { SourceLabel } from "./SourceLabel.tsx"
import { SqlButton } from "./SqlButton.tsx"

function Tx({ hash }: { hash: string }) {
  return (
    <span className="flex items-center gap-1">
      <Link href={txUrl(hash)} target="_blank" variant="secondary" className="font-mono">
        {shortHash(hash)}
      </Link>
      <CopyButton value={hash} />
    </span>
  )
}

export function Delegation() {
  const open = useOpenDetails()
  if (!takeover) return <p className="text-14 text-muted">No EIP-7702 results yet</p>
  const { grant, revoke } = takeover
  const address = (value: string) => (
    <button type="button" className="hover:underline" onClick={() => open({ kind: "address", address: value })}>
      {labelFor(value)}
    </button>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SourceLabel source="amp" detail="transactions.authorization_list, edgeandnode/ethereum_mainnet@0.0.2" />
        <SqlButton query="binance14-eip7702" />
      </div>
      <section className="flex flex-col gap-3">
        <h3 className="text-16 font-medium">Takeover · {formatTime(grant.ts)}</h3>
        <DescriptionList size="small">
          <DescriptionList.Item label="Sent by">{address(grant.from)}</DescriptionList.Item>
          <DescriptionList.Item label="Authority">{address(grant.to)}</DescriptionList.Item>
          <DescriptionList.Item label="Delegates to">{address(grant.delegate)}</DescriptionList.Item>
          <DescriptionList.Item label="Authorizations">
            {takeover.count}, nonces {takeover.firstNonce} to {takeover.lastNonce}
          </DescriptionList.Item>
          <DescriptionList.Item label="Block">{grant.block_num}</DescriptionList.Item>
          <DescriptionList.Item label="Transaction">
            <Tx hash={grant.tx_hash} />
          </DescriptionList.Item>
        </DescriptionList>
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-16 font-medium">Revocation · {formatTime(revoke.ts)}</h3>
        <DescriptionList size="small">
          <DescriptionList.Item label="Sent by">{address(revoke.from)}</DescriptionList.Item>
          <DescriptionList.Item label="Delegates to">Zero address</DescriptionList.Item>
          <DescriptionList.Item label="Block">{revoke.block_num}</DescriptionList.Item>
          <DescriptionList.Item label="Transaction">
            <Tx hash={revoke.tx_hash} />
          </DescriptionList.Item>
        </DescriptionList>
      </section>
    </div>
  )
}
