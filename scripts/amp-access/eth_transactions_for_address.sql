-- Transactions sent from or to one address with ETH value and 4-byte method selector, 29 Oct to 1 Nov 2026 UTC.
SELECT
    block_num,
    timestamp,
    evm_decode_hex(tx_hash) AS tx_hash,
    evm_decode_hex("from") AS from_address,
    evm_decode_hex("to") AS to_address,
    CAST(value AS DOUBLE) / 1e18 AS value_eth,
    '0x' || substr(encode(input, 'hex'), 1, 8) AS method_selector,
    status
FROM "edgeandnode/ethereum_mainnet@0.0.2".transactions
WHERE _block_num BETWEEN 26294680 AND 26323364
  AND ("from" = evm_encode_hex('0x28c6c06298d514db089934071355e5743bf21d60')
    OR "to" = evm_encode_hex('0x28c6c06298d514db089934071355e5743bf21d60'))
ORDER BY block_num, tx_index
