-- Transactions sent from or to the seed addresses, ordered by block and index.
-- Block range 26300743 to 26322290 (29 Oct 20:20 UTC to 1 Nov 20:24 UTC 2026):
-- 10 blocks before the EIP-7702 delegation, to the first sweep plus 72 hours.
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
)
SELECT
  block_num,
  timestamp,
  tx_index,
  evm_decode_hex(tx_hash) AS tx_hash,
  evm_decode_hex("from") AS from_address,
  evm_decode_hex("to") AS to_address,
  value AS value_wei,
  '0x' || substr(encode(input, 'hex'), 1, 8) AS method_selector,
  status
FROM traced_txs
ORDER BY block_num, tx_index
