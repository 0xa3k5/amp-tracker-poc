-- One hop of the freeze trace: issuer-token transfers sent by the current frontier.
-- This is hop 1, where the frontier is the three Binance hot wallets. scripts/freeze/trace.mjs
-- runs this query for each hop with the next frontier, then drops transfers under
-- about $10,000, transfers sent before the sender was reached, and lookalike tokens.
-- Addresses with more than 50 distinct senders are hubs and are not expanded.
-- Blocks 26300743 to 26322290.
SELECT block_num, evm_decode_hex(tx_hash) AS tx_hash, log_index, evm_decode_hex(address) AS token,
       evm_decode_hex(d['from']) AS sender, evm_decode_hex(d['to']) AS recipient,
       arrow_cast(d['value'], 'Utf8') AS amount_raw
FROM (
  SELECT block_num, tx_hash, log_index, address,
         evm_decode_log(topic1, topic2, topic3, data, 'Transfer(address indexed from, address indexed to, uint256 value)') AS d
  FROM "{{dataset}}".logs
  WHERE _block_num BETWEEN 26300743 AND 26322290
    AND topic0 = evm_topic('Transfer(address indexed from, address indexed to, uint256 value)')
    AND topic3 IS NULL
    AND topic1 IN (
      evm_encode_hex('0x00000000000000000000000028c6c06298d514db089934071355e5743bf21d60'),  -- Binance 14
      evm_encode_hex('0x000000000000000000000000dfd5293d8e347dfe59e90efd55b2956a1343963d'),  -- Binance 16
      evm_encode_hex('0x000000000000000000000000ee7ae85f2fe2239e27d9c1e23fffe168d63b4055')   -- Binance 34
    )
    AND address IN (
      evm_encode_hex('0xdac17f958d2ee523a2206206994597c13d831ec7'),  -- USDT
      evm_encode_hex('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),  -- USDC
      evm_encode_hex('0x8292bb45bf1ee4d140127049757c2e0ff06317ed'),  -- RLUSD
      evm_encode_hex('0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d'),  -- USD1
      evm_encode_hex('0xc5f0f7b66764f6ec8c8dff7ba683102295e16409'),  -- FDUSD
      evm_encode_hex('0x6c3ea9036406852006290770bedfcaba0e23a0e8'),  -- PYUSD
      evm_encode_hex('0x68749665ff8d2d112fa859aa293f07a622782f38'),  -- XAUt
      evm_encode_hex('0x45804880de22913dafe09f4980848ece6ecbaf78')   -- PAXG
    )
)
WHERE d['value'] <> '0'
ORDER BY block_num, log_index
