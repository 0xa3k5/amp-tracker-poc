-- Decoded logs for the traced transactions, decoded at query time with evm_decode_log.
-- Same transaction set as attacker-transactions.sql.
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
binance AS (
  SELECT * FROM (VALUES
    (evm_encode_hex('0x28c6c06298d514db089934071355e5743bf21d60')),
    (evm_encode_hex('0xdfd5293d8e347dfe59e90efd55b2956a1343963d')),
    (evm_encode_hex('0xee7ae85f2fe2239e27d9c1e23fffe168d63b4055'))
  ) AS b(address)
),
traced_txs AS (
  SELECT *
  FROM "{{dataset}}".transactions AS t
  WHERE t._block_num BETWEEN 26300743 AND 26322290
    AND (
      -- sent by a seed
      t."from" IN (SELECT address FROM seeds)
      -- or sent to a seed by Binance, or carrying at least 1 ETH (value is a decimal
      -- string in wei, so 19 or more digits means 1 ETH or more).
      -- This drops on-chain text messages and lookalike-address dust.
      OR (t."to" IN (SELECT address FROM seeds)
          AND (t."from" IN (SELECT address FROM binance)
               OR length(t.value) >= 19))
    )
),
logs AS (
  SELECT l.*
  FROM "{{dataset}}".logs AS l
  WHERE l._block_num BETWEEN 26300743 AND 26322290
    AND l.block_num IN (SELECT block_num FROM traced_txs)
    AND l.tx_hash IN (SELECT tx_hash FROM traced_txs)
),
decoded AS (
  -- One decode per event signature. Each branch filters on topic0 first,
  -- so evm_decode_log only sees logs of its own shape.
  SELECT block_num, tx_hash, log_index, address, arrow_cast('Transfer', 'Utf8') AS event, arrow_cast('from,to,value', 'Utf8') AS arg_names,
    evm_decode_hex(d['from']) AS arg_1,
    evm_decode_hex(d['to']) AS arg_2,
    arrow_cast(d['value'], 'Utf8') AS arg_3
  FROM (SELECT *, evm_decode_log(topic1, topic2, topic3, data, 'Transfer(address indexed from, address indexed to, uint256 value)') AS d
        FROM logs WHERE topic0 = evm_topic('Transfer(address indexed from, address indexed to, uint256 value)') AND topic3 IS NULL)
  UNION ALL
  SELECT block_num, tx_hash, log_index, address, arrow_cast('Approval', 'Utf8') AS event, arrow_cast('owner,spender,value', 'Utf8') AS arg_names,
    evm_decode_hex(d['owner']) AS arg_1,
    evm_decode_hex(d['spender']) AS arg_2,
    arrow_cast(d['value'], 'Utf8') AS arg_3
  FROM (SELECT *, evm_decode_log(topic1, topic2, topic3, data, 'Approval(address indexed owner, address indexed spender, uint256 value)') AS d
        FROM logs WHERE topic0 = evm_topic('Approval(address indexed owner, address indexed spender, uint256 value)') AND topic3 IS NULL)
  UNION ALL
  SELECT block_num, tx_hash, log_index, address, arrow_cast('Deposit', 'Utf8') AS event, arrow_cast('dst,wad', 'Utf8') AS arg_names,
    evm_decode_hex(d['dst']) AS arg_1,
    arrow_cast(d['wad'], 'Utf8') AS arg_2,
    arrow_cast(NULL, 'Utf8') AS arg_3
  FROM (SELECT *, evm_decode_log(topic1, topic2, topic3, data, 'Deposit(address indexed dst, uint256 wad)') AS d
        FROM logs WHERE topic0 = evm_topic('Deposit(address indexed dst, uint256 wad)'))
  UNION ALL
  SELECT block_num, tx_hash, log_index, address, arrow_cast('Withdrawal', 'Utf8') AS event, arrow_cast('src,wad', 'Utf8') AS arg_names,
    evm_decode_hex(d['src']) AS arg_1,
    arrow_cast(d['wad'], 'Utf8') AS arg_2,
    arrow_cast(NULL, 'Utf8') AS arg_3
  FROM (SELECT *, evm_decode_log(topic1, topic2, topic3, data, 'Withdrawal(address indexed src, uint256 wad)') AS d
        FROM logs WHERE topic0 = evm_topic('Withdrawal(address indexed src, uint256 wad)'))
  UNION ALL
  SELECT block_num, tx_hash, log_index, address, arrow_cast('AddedBlackList', 'Utf8') AS event, arrow_cast('_user', 'Utf8') AS arg_names,
    evm_decode_hex(d['_user']) AS arg_1,
    arrow_cast(NULL, 'Utf8') AS arg_2,
    arrow_cast(NULL, 'Utf8') AS arg_3
  FROM (SELECT *, evm_decode_log(topic1, topic2, topic3, data, 'AddedBlackList(address _user)') AS d
        FROM logs WHERE topic0 = evm_topic('AddedBlackList(address _user)'))
)
SELECT
  block_num,
  evm_decode_hex(tx_hash) AS tx_hash,
  log_index,
  evm_decode_hex(address) AS contract,
  event,
  arg_names,
  arg_1,
  arg_2,
  arg_3
FROM decoded
ORDER BY block_num, log_index
