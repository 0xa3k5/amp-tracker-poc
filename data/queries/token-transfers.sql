-- ERC-20 and ETH transfers for the fund-flow graph: every transfer touching a seed address
-- (hop 0), then everything sent onward by the wallets the seeds paid (hop 1).
-- Hop 1 only follows wallets that sign their own transactions, so DEX pools and
-- routers end the trace instead of pulling in their whole trading history.
-- Blocks 26300743 to 26322290. ETH moved inside contract calls is not here: the
-- dataset has no traces table, so only top-level transaction value shows up.
WITH seeds AS (
  -- The 5 attacker and 15 intermediary addresses from addresses.json
  SELECT * FROM (VALUES
    (evm_encode_hex('0x7c8601d4645b93cea45f71e118a729332e6b5ca0')),
    (evm_encode_hex('0x63e842b054bd624a465454d533c33f573e9c6fae')),
    (evm_encode_hex('0x5227f603c1ee34ce3c06efe6477003bdfccb2f8c')),
    (evm_encode_hex('0x8532fa14acaf483729c449b8458aeddb900543d4')),
    (evm_encode_hex('0x8d53903625b8e839b9df4bd28b0efb1cd6b8639a')),
    (evm_encode_hex('0x9749292d74fd460982d0912ea9515ea24736c762')),
    (evm_encode_hex('0x0ddf0480016e6bcb2c1f5d190d221fba1320697e')),
    (evm_encode_hex('0x811f15855476156ebf86ba3b84fafb8ceaa4e84c')),
    (evm_encode_hex('0xaa246bf639586a6ba46762d378ce50ca4fc654a0')),
    (evm_encode_hex('0x77edef23fbd05921c26fe29fcc3a65e14d2ac3eb')),
    (evm_encode_hex('0x7aa4d3029e4c6a8e916300014ad95b6d6c03bfd1')),
    (evm_encode_hex('0xccbef95633adb5cd2b5038db5a38d77e726ca263')),
    (evm_encode_hex('0xb171ca86f82070282138352ff7111b494060c8c3')),
    (evm_encode_hex('0x897c80d1a9729e94460e2bd93178bd5215158df3')),
    (evm_encode_hex('0xc887af690e0301cd4edbbce8f8d31b4ec65b286a')),
    (evm_encode_hex('0x7f9dc988b46336ad536828fad50fa8fa1e5415e3')),
    (evm_encode_hex('0x42cdf00c85005630cc8605731b9364f712077810')),
    (evm_encode_hex('0xb3ddec0ccc5c3ba733fcdf5a15f98c95ec5a5fdb')),
    (evm_encode_hex('0x5c23023ca6633f91ded909b4a753a3ca00fea4fc')),
    (evm_encode_hex('0x008f06f04b72da2621a4f37f5531cc7352187dcd'))
  ) AS s(address)
),
seed_topics AS (
  -- The same addresses, left-padded to 32 bytes as they appear in log topics
  SELECT * FROM (VALUES
    (evm_encode_hex('0x0000000000000000000000007c8601d4645b93cea45f71e118a729332e6b5ca0')),
    (evm_encode_hex('0x00000000000000000000000063e842b054bd624a465454d533c33f573e9c6fae')),
    (evm_encode_hex('0x0000000000000000000000005227f603c1ee34ce3c06efe6477003bdfccb2f8c')),
    (evm_encode_hex('0x0000000000000000000000008532fa14acaf483729c449b8458aeddb900543d4')),
    (evm_encode_hex('0x0000000000000000000000008d53903625b8e839b9df4bd28b0efb1cd6b8639a')),
    (evm_encode_hex('0x0000000000000000000000009749292d74fd460982d0912ea9515ea24736c762')),
    (evm_encode_hex('0x0000000000000000000000000ddf0480016e6bcb2c1f5d190d221fba1320697e')),
    (evm_encode_hex('0x000000000000000000000000811f15855476156ebf86ba3b84fafb8ceaa4e84c')),
    (evm_encode_hex('0x000000000000000000000000aa246bf639586a6ba46762d378ce50ca4fc654a0')),
    (evm_encode_hex('0x00000000000000000000000077edef23fbd05921c26fe29fcc3a65e14d2ac3eb')),
    (evm_encode_hex('0x0000000000000000000000007aa4d3029e4c6a8e916300014ad95b6d6c03bfd1')),
    (evm_encode_hex('0x000000000000000000000000ccbef95633adb5cd2b5038db5a38d77e726ca263')),
    (evm_encode_hex('0x000000000000000000000000b171ca86f82070282138352ff7111b494060c8c3')),
    (evm_encode_hex('0x000000000000000000000000897c80d1a9729e94460e2bd93178bd5215158df3')),
    (evm_encode_hex('0x000000000000000000000000c887af690e0301cd4edbbce8f8d31b4ec65b286a')),
    (evm_encode_hex('0x0000000000000000000000007f9dc988b46336ad536828fad50fa8fa1e5415e3')),
    (evm_encode_hex('0x00000000000000000000000042cdf00c85005630cc8605731b9364f712077810')),
    (evm_encode_hex('0x000000000000000000000000b3ddec0ccc5c3ba733fcdf5a15f98c95ec5a5fdb')),
    (evm_encode_hex('0x0000000000000000000000005c23023ca6633f91ded909b4a753a3ca00fea4fc')),
    (evm_encode_hex('0x000000000000000000000000008f06f04b72da2621a4f37f5531cc7352187dcd'))
  ) AS s(topic)
),
known_exits AS (
  -- Exchanges and issuers from addresses.json: the trace stops there
  SELECT * FROM (VALUES
    (evm_encode_hex('0x00000011f84b9aa48e5f8aa8b9897600006289be')),
    (evm_encode_hex('0x399740157391a9f1bf4e9921a8834f9bc8f2678e')),
    (evm_encode_hex('0x000000000004444c5dc75cb358380d2e3de08a90')),
    (evm_encode_hex('0x23617e59a5925b2a4bf75d73ff6711cd0b29de85')),
    (evm_encode_hex('0x23878914efe38d27c4d67ab83ed1b93a74d4086a')),
    (evm_encode_hex('0xd01607c3c5ecaba394d8be377a08590149325722')),
    (evm_encode_hex('0xdac17f958d2ee523a2206206994597c13d831ec7')),
    (evm_encode_hex('0xc6cde7c39eb2f0f0095f41570af89efc2c1ea828')),
    (evm_encode_hex('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'))
  ) AS e(address)
),
txs AS (
  SELECT block_num, timestamp, tx_index, tx_hash, "from", "to", value
  FROM "edgeandnode/ethereum_mainnet@0.0.2".transactions
  WHERE _block_num BETWEEN 26300743 AND 26322290
),
hop0_erc20 AS (
  SELECT block_num, timestamp, tx_hash, log_index, address AS token,
         evm_decode_log(topic1, topic2, topic3, data, 'Transfer(address indexed from, address indexed to, uint256 value)') AS d
  FROM "edgeandnode/ethereum_mainnet@0.0.2".logs
  WHERE _block_num BETWEEN 26300743 AND 26322290
    AND topic0 = evm_topic('Transfer(address indexed from, address indexed to, uint256 value)')
    AND topic3 IS NULL  -- ERC-20 only, ERC-721 indexes tokenId in topic3
    AND (topic1 IN (SELECT topic FROM seed_topics) OR topic2 IN (SELECT topic FROM seed_topics))
),
hop1 AS (
  -- Wallets a seed sent tokens or ETH to, that are not seeds or known exits,
  -- and that signed at least one transaction in the range
  SELECT DISTINCT r.address
  FROM (
    SELECT d['to'] AS address FROM hop0_erc20
    WHERE d['from'] IN (SELECT address FROM seeds) AND d['value'] <> '0'
    UNION
    SELECT "to" FROM txs
    WHERE "from" IN (SELECT address FROM seeds) AND value <> '0'
  ) AS r
  WHERE r.address NOT IN (SELECT address FROM seeds)
    AND r.address NOT IN (SELECT address FROM known_exits)
    AND r.address IN (SELECT "from" FROM txs)
),
hop1_erc20 AS (
  SELECT block_num, timestamp, tx_hash, log_index, address AS token,
         evm_decode_log(topic1, topic2, topic3, data, 'Transfer(address indexed from, address indexed to, uint256 value)') AS d
  FROM "edgeandnode/ethereum_mainnet@0.0.2".logs
  WHERE _block_num BETWEEN 26300743 AND 26322290
    AND topic0 = evm_topic('Transfer(address indexed from, address indexed to, uint256 value)')
    AND topic3 IS NULL
    AND evm_decode_hex(topic1) IN (
      SELECT '0x000000000000000000000000' || substr(evm_decode_hex(address), 3) FROM hop1
    )
),
transfers AS (
  SELECT 0 AS hop, block_num, timestamp, tx_hash, log_index, token,
         d['from'] AS sender, d['to'] AS recipient, arrow_cast(d['value'], 'Utf8') AS amount_raw
  FROM hop0_erc20 WHERE d['value'] <> '0'
  UNION ALL
  SELECT 1, block_num, timestamp, tx_hash, log_index, token,
         d['from'], d['to'], arrow_cast(d['value'], 'Utf8')
  FROM hop1_erc20 WHERE d['value'] <> '0'
  UNION ALL
  -- ETH sent as top-level transaction value. Inbound ETH from outsiders needs at
  -- least 1 ETH (19 or more wei digits), which drops lookalike-address dust.
  SELECT 0, block_num, timestamp, tx_hash, -1, arrow_cast(NULL, 'FixedSizeBinary(20)'), "from", "to", value
  FROM txs
  WHERE value <> '0'
    AND ("from" IN (SELECT address FROM seeds)
      OR ("to" IN (SELECT address FROM seeds) AND length(value) >= 19))
  UNION ALL
  SELECT 1, block_num, timestamp, tx_hash, -1, arrow_cast(NULL, 'FixedSizeBinary(20)'), "from", "to", value
  FROM txs
  WHERE value <> '0'
    AND "from" IN (SELECT address FROM hop1)
    AND "to" NOT IN (SELECT address FROM seeds)
)
SELECT
  hop,
  block_num,
  timestamp,
  evm_decode_hex(tx_hash) AS tx_hash,
  log_index,
  CASE WHEN token IS NULL THEN 'ETH' ELSE evm_decode_hex(token) END AS token_address,
  evm_decode_hex(sender) AS from_address,
  evm_decode_hex(recipient) AS to_address,
  amount_raw
FROM transfers
ORDER BY block_num, log_index
