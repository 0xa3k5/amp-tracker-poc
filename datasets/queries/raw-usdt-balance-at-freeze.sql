-- The same window-only net USDT flow per frozen address, straight from raw logs
-- (edgeandnode/ethereum_mainnet@0.0.2), for the timing comparison with the derived tables.
WITH f AS (
  SELECT block_num AS freeze_block, d['user'] AS account
  FROM (
    SELECT block_num, evm_decode_log(topic1, topic2, topic3, data, 'AddedBlackList(address user)') AS d
    FROM "{{dataset}}".logs
    WHERE _block_num BETWEEN 26300743 AND 26322290
      AND address = evm_encode_hex('0xdac17f958d2ee523a2206206994597c13d831ec7')
      AND topic0 = evm_topic('AddedBlackList(address user)')
  ) x
),
t AS (
  SELECT block_num, d['from'] AS src, d['to'] AS dst, arrow_cast(d['value'], 'Decimal256(76, 0)') AS v
  FROM (
    SELECT block_num, evm_decode_log(topic1, topic2, topic3, data, 'Transfer(address indexed from, address indexed to, uint256 value)') AS d
    FROM "{{dataset}}".logs
    WHERE _block_num BETWEEN 26300743 AND 26322290
      AND address = evm_encode_hex('0xdac17f958d2ee523a2206206994597c13d831ec7')
      AND topic0 = evm_topic('Transfer(address indexed from, address indexed to, uint256 value)')
  ) y
),
legs AS (
  SELECT block_num, src AS address, -v AS delta FROM t
  UNION ALL
  SELECT block_num, dst AS address, v AS delta FROM t
)
SELECT f.freeze_block, evm_decode_hex(f.account) AS address,
       arrow_cast(sum(l.delta), 'Utf8') AS net_raw,
       count(l.delta) AS legs
FROM f
LEFT JOIN legs l ON l.address = f.account AND l.block_num <= f.freeze_block
GROUP BY f.freeze_block, f.account
ORDER BY f.freeze_block, address
