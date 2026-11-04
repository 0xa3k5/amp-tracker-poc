-- USDT blacklist events (AddedBlackList, DestroyedBlackFunds) on Ethereum, 29 Oct to 1 Nov 2026 UTC
-- Blocks 26294680..26323364. Parameter names are lowercase so struct fields resolve with d['name'].
SELECT
    block_num,
    timestamp,
    evm_decode_hex(tx_hash) AS tx_hash,
    log_index,
    event,
    evm_decode_hex(coalesce(added['user'], destroyed['user'])) AS account,
    destroyed['balance'] AS balance_raw
FROM (
    SELECT
        block_num, timestamp, tx_hash, log_index,
        CASE WHEN topic0 = evm_topic('AddedBlackList(address user)') THEN 'AddedBlackList' ELSE 'DestroyedBlackFunds' END AS event,
        CASE WHEN topic0 = evm_topic('AddedBlackList(address user)')
             THEN evm_decode_log(topic1, topic2, topic3, data, 'AddedBlackList(address user)') END AS added,
        CASE WHEN topic0 = evm_topic('DestroyedBlackFunds(address user, uint256 balance)')
             THEN evm_decode_log(topic1, topic2, topic3, data, 'DestroyedBlackFunds(address user, uint256 balance)') END AS destroyed
    FROM "edgeandnode/ethereum_mainnet@0.0.2".logs
    WHERE _block_num BETWEEN 26294680 AND 26323364
      AND address = evm_encode_hex('0xdac17f958d2ee523a2206206994597c13d831ec7')
      AND topic0 IN (
          evm_topic('AddedBlackList(address user)'),
          evm_topic('DestroyedBlackFunds(address user, uint256 balance)')
      )
)
ORDER BY block_num, log_index
