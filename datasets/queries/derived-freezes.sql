-- Freeze, unfreeze and seizure events in the hack window, from the derived table.
-- a3k5/stablecoin_forensics@0.1.0 starts at block 26300743 and was materialized to 26322290.
SELECT block_num, timestamp, evm_decode_hex(tx_hash) AS tx_hash, log_index,
       symbol, evm_decode_hex(token) AS token_address, event, action,
       evm_decode_hex(account) AS account, arrow_cast(amount_raw, 'Utf8') AS amount_raw
FROM "a3k5/stablecoin_forensics@0.1.0".stablecoin_freezes
WHERE block_num BETWEEN 26300743 AND 26322290
ORDER BY block_num, log_index
