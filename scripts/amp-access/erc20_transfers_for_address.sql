-- ERC-20 Transfer events into or out of one address, 29 Oct to 1 Nov 2026 UTC (blocks 26294680..26323364).
-- Address used for the smoke test: 0x28c6c06298d514db089934071355e5743bf21d60 (frozen by USDT at block 26301278).
SELECT
    block_num,
    timestamp,
    evm_decode_hex(tx_hash) AS tx_hash,
    log_index,
    evm_decode_hex(address) AS token_address,
    evm_decode_hex(d['from']) AS from_address,
    evm_decode_hex(d['to']) AS to_address,
    d['value'] AS amount_raw
FROM (
    SELECT block_num, timestamp, tx_hash, log_index, address,
           evm_decode_log(topic1, topic2, topic3, data, 'Transfer(address indexed from, address indexed to, uint256 value)') AS d
    FROM "edgeandnode/ethereum_mainnet@0.0.2".logs
    WHERE _block_num BETWEEN 26294680 AND 26323364
      AND topic0 = evm_topic('Transfer(address indexed from, address indexed to, uint256 value)')
      AND topic3 IS NULL  -- ERC-20 only; ERC-721 Transfer indexes tokenId in topic3
      AND (topic1 = evm_encode_hex('0x00000000000000000000000028c6c06298d514db089934071355e5743bf21d60')
        OR topic2 = evm_encode_hex('0x00000000000000000000000028c6c06298d514db089934071355e5743bf21d60'))
)
ORDER BY block_num, log_index
