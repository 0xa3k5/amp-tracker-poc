-- Size check: legs per token in the derived balance-change table.
SELECT symbol, count(*) AS legs, min(block_num) AS first_block, max(block_num) AS last_block
FROM "a3k5/stablecoin_forensics@0.1.0".erc20_balance_changes
GROUP BY symbol ORDER BY legs DESC
