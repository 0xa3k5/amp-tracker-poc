export const DEFAULT_DATASET = "edgeandnode/ethereum_mainnet@0.0.2"

export function withDataset(sql: string, dataset: string) {
  return sql.replaceAll("{{dataset}}", dataset)
}
