-- EIP-7702 transactions that touch Binance 14 (0x28c6…1d60), blocks 26300743 to 26322290.
-- Two rows come back:
--   20:20:59 UTC, block 26300753: 0x7c86…5ca0 sends a type-4 transaction to Binance 14
--     carrying 50 authorizations. All 50 delegate to 0x63e8…6fae on chain 1, with
--     consecutive nonces 18914775 to 18914824. Binance 14's own transaction in the same
--     block used nonce 18914808, inside that range.
--   00:10:35 UTC, block 26301896: Binance 14 sends a type-4 transaction to itself that
--     delegates to 0x0000…0000, which clears the delegation.
-- The table stores each authorization's signature (y_parity, r, s) but not the signer.
-- Recovering it needs ecrecover, which Amp has no built-in function for. The nonce match
-- is the evidence that Binance 14 signed them.
-- CROSS JOIN LATERAL unnest(...) fails on Amp (DataFusion: OuterReferenceColumn not
-- supported), so the unnest sits in a subquery.
SELECT
  block_num,
  timestamp,
  evm_decode_hex(tx_hash) AS tx_hash,
  evm_decode_hex(from_address) AS from_address,
  evm_decode_hex(to_address) AS to_address,
  tx_nonce,
  auth['chain_id'] AS auth_chain_id,
  evm_decode_hex(auth['address']) AS delegate,
  auth['nonce'] AS auth_nonce
FROM (
  SELECT block_num, timestamp, tx_hash, "from" AS from_address, "to" AS to_address, nonce AS tx_nonce,
         unnest(authorization_list) AS auth
  FROM "{{dataset}}".transactions
  WHERE _block_num BETWEEN 26300743 AND 26322290
    AND type = 4
    AND ("to" = evm_encode_hex('0x28c6c06298d514db089934071355e5743bf21d60')
      OR "from" = evm_encode_hex('0x28c6c06298d514db089934071355e5743bf21d60'))
)
ORDER BY block_num, auth['nonce']
