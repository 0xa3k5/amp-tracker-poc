-- USDT balance of each blacklisted address at the block Tether froze it,
-- read with eth_call (balanceOf) against that block's state. Freeze blocks come
-- from AddedBlackList logs in blocks 26300743 to 26322290.
WITH frozen AS (
  SELECT * FROM (VALUES
    (evm_encode_hex('0x5227f603c1ee34ce3c06efe6477003bdfccb2f8c')),  -- main receiving wallet
    (evm_encode_hex('0x9749292d74fd460982d0912ea9515ea24736c762')),  -- 500M first hop
    (evm_encode_hex('0x0ddf0480016e6bcb2c1f5d190d221fba1320697e')),  -- 200M first hop
    (evm_encode_hex('0x8d53903625b8e839b9df4bd28b0efb1cd6b8639a')),  -- Exploiter 3
    (evm_encode_hex('0x7aa4d3029e4c6a8e916300014ad95b6d6c03bfd1')),  -- hop chain
    (evm_encode_hex('0xaa246bf639586a6ba46762d378ce50ca4fc654a0')),  -- 175M relay target
    (evm_encode_hex('0xccbef95633adb5cd2b5038db5a38d77e726ca263')),  -- hop chain
    (evm_encode_hex('0xb171ca86f82070282138352ff7111b494060c8c3')),  -- end of hop chain
    (evm_encode_hex('0x28c6c06298d514db089934071355e5743bf21d60'))   -- Binance 14
  ) AS f(address)
),
freezes AS (
  SELECT block_num,
         evm_decode_log(topic1, topic2, topic3, data, 'AddedBlackList(address _user)')['_user'] AS holder
  FROM "{{dataset}}".logs
  WHERE _block_num BETWEEN 26300743 AND 26322290
    AND address = evm_encode_hex('0xdac17f958d2ee523a2206206994597c13d831ec7')
    AND topic0 = evm_topic('AddedBlackList(address _user)')
),
calls AS (
  SELECT block_num, holder,
         rpc.mainnet.eth_call(
           NULL,
           evm_encode_hex('0xdac17f958d2ee523a2206206994597c13d831ec7'),
           evm_encode_params(holder, 'balanceOf(address account)'),
           block_num
         ) AS result
  FROM freezes
  WHERE holder IN (SELECT address FROM frozen)
)
SELECT
  block_num,
  evm_decode_hex(holder) AS address,
  shift_units(evm_decode_type(result.data, 'uint256'), -6) AS usdt_balance,
  result.message AS revert_reason
FROM calls
ORDER BY block_num, address
