-- Mock query. The data agent replaces this file with the query that ran against Amp.
WITH transfers AS (
  SELECT
    l.block_num,
    l.tx_hash,
    l.address AS token_address,
    evm_decode_log(
      l.topic1, l.topic2, l.topic3, l.data,
      'Transfer(address indexed from, address indexed to, uint256 value)'
    ) AS t
  FROM eth_rpc.logs AS l
  WHERE l.block_num BETWEEN {{from_block}} AND {{to_block}}
    AND l.topic0 = evm_topic('Transfer(address indexed from, address indexed to, uint256 value)')
)
SELECT block_num, tx_hash, token_address, t."from", t."to", t.value
FROM transfers
WHERE t."from" = '{{address}}' OR t."to" = '{{address}}'
ORDER BY block_num
