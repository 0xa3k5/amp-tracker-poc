const ETHERSCAN = "https://etherscan.io"

export function txUrl(hash: string) {
  return `${ETHERSCAN}/tx/${hash}`
}

export function addressUrl(address: string) {
  return `${ETHERSCAN}/address/${address}`
}
