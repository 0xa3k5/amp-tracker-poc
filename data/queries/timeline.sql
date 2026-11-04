-- Mock query. The data agent replaces this file with the query that ran against Amp.
SELECT
  t.block_num,
  t.timestamp,
  t.tx_hash,
  t."from",
  t."to",
  evm_decode_hex(t.input) AS input,
  t.value
FROM eth_rpc.transactions AS t
WHERE t.block_num BETWEEN {{from_block}} AND {{to_block}}
  AND ('{{address}}' IN (t."from", t."to"))
ORDER BY t.block_num, t.tx_index
