-- Live freeze, unfreeze and seizure events from eight stablecoin and gold-token issuers,
-- read from our derived dataset a3k5/stablecoin_forensics@0.2.0. That version has no end
-- block, so Amp keeps the table at the chain head.
-- Streaming: SETTINGS stream = true. `watched` is true when the account is one of the
-- 21 wallets the transfer stream follows or an account frozen in freezes.json.
SELECT block_num, timestamp, evm_decode_hex(tx_hash) AS tx_hash,
       arrow_cast(log_index, 'Int64') AS log_index,
       evm_decode_hex(token) AS token_address, symbol, event, action,
       evm_decode_hex(account) AS account,
       arrow_cast(amount_raw, 'Utf8') AS amount_raw, decimals,
       account IN (
    evm_encode_hex('0x008f06f04b72da2621a4f37f5531cc7352187dcd'),
    evm_encode_hex('0x0ddf0480016e6bcb2c1f5d190d221fba1320697e'),
    evm_encode_hex('0x28c6c06298d514db089934071355e5743bf21d60'),
    evm_encode_hex('0x42cdf00c85005630cc8605731b9364f712077810'),
    evm_encode_hex('0x5227f603c1ee34ce3c06efe6477003bdfccb2f8c'),
    evm_encode_hex('0x5c23023ca6633f91ded909b4a753a3ca00fea4fc'),
    evm_encode_hex('0x63e842b054bd624a465454d533c33f573e9c6fae'),
    evm_encode_hex('0x77edef23fbd05921c26fe29fcc3a65e14d2ac3eb'),
    evm_encode_hex('0x7aa4d3029e4c6a8e916300014ad95b6d6c03bfd1'),
    evm_encode_hex('0x7c8601d4645b93cea45f71e118a729332e6b5ca0'),
    evm_encode_hex('0x7f9dc988b46336ad536828fad50fa8fa1e5415e3'),
    evm_encode_hex('0x811f15855476156ebf86ba3b84fafb8ceaa4e84c'),
    evm_encode_hex('0x8532fa14acaf483729c449b8458aeddb900543d4'),
    evm_encode_hex('0x897c80d1a9729e94460e2bd93178bd5215158df3'),
    evm_encode_hex('0x8c1c499b1796d7f3c2521ac37186b52de024e58c'),
    evm_encode_hex('0x8d53903625b8e839b9df4bd28b0efb1cd6b8639a'),
    evm_encode_hex('0x9749292d74fd460982d0912ea9515ea24736c762'),
    evm_encode_hex('0xa97bf7836f8a08f9ed91d41453d371493fae8d10'),
    evm_encode_hex('0xaa246bf639586a6ba46762d378ce50ca4fc654a0'),
    evm_encode_hex('0xb171ca86f82070282138352ff7111b494060c8c3'),
    evm_encode_hex('0xb3ddec0ccc5c3ba733fcdf5a15f98c95ec5a5fdb'),
    evm_encode_hex('0xc887af690e0301cd4edbbce8f8d31b4ec65b286a'),
    evm_encode_hex('0xccbef95633adb5cd2b5038db5a38d77e726ca263'),
    evm_encode_hex('0xcf4ca2bdf21bc3a467a00b6afe72b833982723e0'),
    evm_encode_hex('0xe7024ab80143b1ef843efe6a58368696cb87958d'),
    evm_encode_hex('0xee7ae85f2fe2239e27d9c1e23fffe168d63b4055')
       ) AS watched
FROM "a3k5/stablecoin_forensics@0.2.0".stablecoin_freezes
WHERE _block_num >= {{from_block}}
SETTINGS stream = true
