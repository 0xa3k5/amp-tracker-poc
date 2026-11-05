-- USDT balance change of each frozen address from the dataset start (block 26300743)
-- to the end of its freeze block, from the derived tables.
-- Window-only: 0.1.0 starts at the hack window, so this is the net flow inside the window,
-- not the absolute balance. It matches the absolute balance only for addresses that held
-- no USDT before block 26300743.
WITH f AS (
  SELECT block_num AS freeze_block, account
  FROM "a3k5/stablecoin_forensics@0.1.0".stablecoin_freezes
  WHERE symbol = 'USDT' AND action = 'freeze'
)
SELECT f.freeze_block, evm_decode_hex(f.account) AS address,
       arrow_cast(sum(b.delta_raw), 'Utf8') AS net_raw,
       count(b.delta_raw) AS legs
FROM f
LEFT JOIN "a3k5/stablecoin_forensics@0.1.0".erc20_balance_changes b
  ON b.address = f.account AND b.symbol = 'USDT' AND b.block_num <= f.freeze_block
GROUP BY f.freeze_block, f.account
ORDER BY f.freeze_block, address
