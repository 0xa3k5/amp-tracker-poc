-- Every freeze and blacklist event, plus the seizure events that burn frozen funds, from the stablecoin and gold-token issuers
-- whose tokens show up in the trace. Ethereum, blocks 26300743 to 26322290.
-- Event signatures come from each contract's verified ABI on Sourcify (sourcify.dev),
-- read on 5 Nov 2026. For proxies we read the implementation the proxy points to:
--   USDT  0xdac17f95…1ec7  TetherToken (not a proxy)
--   USDC  0xa0b86991…eb48  FiatTokenV2_2   impl 0x43506849…02dd
--   RLUSD 0x8292bb45…17ed  StablecoinUpgradeableV2 impl 0x9747a0d2…fa9e
--   XAUt  0x68749665…2f38  TetherToken     impl 0x4c0d2c74…e566
--   USD1  0x8d0d000e…8b0d  StablecoinV2    impl 0x694aa534…1f08
--   FDUSD 0xc5f0f7b6…6409  StablecoinV2    impl 0xa6b2c3d2…6d50
--   PAXG  0x45804880…af78  PAXG            impl 0x7da4c5d9…a543
--   PYUSD 0x6c3ea903…a0e8  PYUSD           impl 0x8c35caa5…256a
-- Parameter names are lowercase so the decoded struct fields resolve with d['name'].
WITH ev AS (
  SELECT block_num, timestamp, tx_hash, log_index, address AS token, topic0, topic1, topic2, topic3, data
  FROM "{{dataset}}".logs
  WHERE _block_num BETWEEN 26300743 AND 26322290
    AND address IN (
      evm_encode_hex('0xdac17f958d2ee523a2206206994597c13d831ec7'),
      evm_encode_hex('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
      evm_encode_hex('0x8292bb45bf1ee4d140127049757c2e0ff06317ed'),
      evm_encode_hex('0x68749665ff8d2d112fa859aa293f07a622782f38'),
      evm_encode_hex('0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d'),
      evm_encode_hex('0xc5f0f7b66764f6ec8c8dff7ba683102295e16409'),
      evm_encode_hex('0x45804880de22913dafe09f4980848ece6ecbaf78'),
      evm_encode_hex('0x6c3ea9036406852006290770bedfcaba0e23a0e8')
    )
),
decoded AS (
  -- USDT: the address is in the data, not a topic
  SELECT block_num, timestamp, tx_hash, log_index, token, 'AddedBlackList' AS event,
         evm_decode_log(topic1, topic2, topic3, data, 'AddedBlackList(address user)')['user'] AS account,
         arrow_cast(NULL, 'Utf8') AS amount_raw
  FROM ev WHERE topic0 = evm_topic('AddedBlackList(address user)')
  UNION ALL
  SELECT block_num, timestamp, tx_hash, log_index, token, 'DestroyedBlackFunds',
         evm_decode_log(topic1, topic2, topic3, data, 'DestroyedBlackFunds(address user, uint256 balance)')['user'],
         arrow_cast(evm_decode_log(topic1, topic2, topic3, data, 'DestroyedBlackFunds(address user, uint256 balance)')['balance'], 'Utf8')
  FROM ev WHERE topic0 = evm_topic('DestroyedBlackFunds(address user, uint256 balance)')
  UNION ALL
  -- USDC
  SELECT block_num, timestamp, tx_hash, log_index, token, 'Blacklisted',
         evm_decode_log(topic1, topic2, topic3, data, 'Blacklisted(address indexed account)')['account'],
         arrow_cast(NULL, 'Utf8')
  FROM ev WHERE topic0 = evm_topic('Blacklisted(address indexed account)')
  UNION ALL
  -- RLUSD: the address is in the data
  SELECT block_num, timestamp, tx_hash, log_index, token, 'AccountPaused',
         evm_decode_log(topic1, topic2, topic3, data, 'AccountPaused(address account)')['account'],
         arrow_cast(NULL, 'Utf8')
  FROM ev WHERE topic0 = evm_topic('AccountPaused(address account)')
  UNION ALL
  -- XAUt
  SELECT block_num, timestamp, tx_hash, log_index, token, 'BlockPlaced',
         evm_decode_log(topic1, topic2, topic3, data, 'BlockPlaced(address indexed user)')['user'],
         arrow_cast(NULL, 'Utf8')
  FROM ev WHERE topic0 = evm_topic('BlockPlaced(address indexed user)')
  UNION ALL
  -- USD1 and FDUSD: the caller is indexed first, the frozen account second
  SELECT block_num, timestamp, tx_hash, log_index, token, 'Freeze',
         evm_decode_log(topic1, topic2, topic3, data, 'Freeze(address indexed caller, address indexed account)')['account'],
         arrow_cast(NULL, 'Utf8')
  FROM ev WHERE topic0 = evm_topic('Freeze(address indexed caller, address indexed account)')
  UNION ALL
  SELECT block_num, timestamp, tx_hash, log_index, token, 'FrozenAccountDrained',
         evm_decode_log(topic1, topic2, topic3, data, 'FrozenAccountDrained(address indexed caller, address indexed account, uint256 amount)')['account'],
         arrow_cast(evm_decode_log(topic1, topic2, topic3, data, 'FrozenAccountDrained(address indexed caller, address indexed account, uint256 amount)')['amount'], 'Utf8')
  FROM ev WHERE topic0 = evm_topic('FrozenAccountDrained(address indexed caller, address indexed account, uint256 amount)')
  UNION ALL
  -- PAXG and PYUSD (Paxos)
  SELECT block_num, timestamp, tx_hash, log_index, token, 'FreezeAddress',
         evm_decode_log(topic1, topic2, topic3, data, 'FreezeAddress(address indexed addr)')['addr'],
         arrow_cast(NULL, 'Utf8')
  FROM ev WHERE topic0 = evm_topic('FreezeAddress(address indexed addr)')
)
SELECT
  block_num,
  timestamp,
  evm_decode_hex(tx_hash) AS tx_hash,
  log_index,
  evm_decode_hex(token) AS token_address,
  event,
  evm_decode_hex(account) AS account,
  amount_raw
FROM decoded
ORDER BY block_num, log_index
