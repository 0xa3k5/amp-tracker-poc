-- Live ERC-20 transfers and plain ETH transfers to or from the 27 watched wallets.
-- Streaming: SETTINGS stream = true. Amp runs it in microbatches as new blocks land and
-- the server resumes it from its last cursor after a restart.
-- Watched: attackers, intermediaries and every frozen account from addresses.json and
-- freezes.json. Exchanges, issuers and Binance hot wallets are left out (8,639 transfers in
-- 300 blocks); transfers between them and a watched wallet still match.
--   0x008f06f04b72da2621a4f37f5531cc7352187dcd  intermediary: Received 88
--   0x0ddf0480016e6bcb2c1f5d190d221fba1320697e  intermediary: First hop
--   0x28c6c06298d514db089934071355e5743bf21d60  frozen USDT (AddedBlackList)
--   0x42cdf00c85005630cc8605731b9364f712077810  intermediary: Received UNI and ONDO from 0x5227
--   0x5227f603c1ee34ce3c06efe6477003bdfccb2f8c  attacker: Main receiving wallet (Etherscan label: Binance Hot Wallet Exploiter 2)
--   0x5c23023ca6633f91ded909b4a753a3ca00fea4fc  intermediary: Received 88
--   0x63e842b054bd624a465454d533c33f573e9c6fae  attacker: Sweeper contract deployed by the operator at 15:59:11 UTC
--   0x77edef23fbd05921c26fe29fcc3a65e14d2ac3eb  intermediary: Hop chain
--   0x7aa4d3029e4c6a8e916300014ad95b6d6c03bfd1  intermediary: Hop chain
--   0x7c8601d4645b93cea45f71e118a729332e6b5ca0  attacker: Operator wallet (Etherscan label: Binance Hot Wallet Exploiter)
--   0x7f9dc988b46336ad536828fad50fa8fa1e5415e3  intermediary: Received WBETH and ENA from 0x5227
--   0x811f15855476156ebf86ba3b84fafb8ceaa4e84c  intermediary: Relay
--   0x8532fa14acaf483729c449b8458aeddb900543d4  attacker: Etherscan label: Binance Hot Wallet Exploiter 8
--   0x897c80d1a9729e94460e2bd93178bd5215158df3  intermediary: Received 57,891
--   0x8c1c499b1796d7f3c2521ac37186b52de024e58c  frozen USDC (Blacklisted)
--   0x8d53903625b8e839b9df4bd28b0efb1cd6b8639a  attacker: Etherscan label: Binance Hot Wallet Exploiter 3
--   0x9749292d74fd460982d0912ea9515ea24736c762  intermediary: First hop
--   0xa97bf7836f8a08f9ed91d41453d371493fae8d10  frozen PYUSD (FreezeAddress)
--   0xaa246bf639586a6ba46762d378ce50ca4fc654a0  intermediary: Received 175M USDT at 21:08:23 UTC
--   0xb171ca86f82070282138352ff7111b494060c8c3  intermediary: End of the hop chain
--   0xb3ddec0ccc5c3ba733fcdf5a15f98c95ec5a5fdb  intermediary: Received WBTC and USDe from 0x5227
--   0xbeef02961503351625926ea9a11ae13b29f5c555  intermediary: Hop 1
--   0xc887af690e0301cd4edbbce8f8d31b4ec65b286a  intermediary: ETH collector
--   0xccbef95633adb5cd2b5038db5a38d77e726ca263  intermediary: Hop chain
--   0xcf4ca2bdf21bc3a467a00b6afe72b833982723e0  frozen FDUSD (Freeze)
--   0xe7024ab80143b1ef843efe6a58368696cb87958d  intermediary: Hop 1
--   0xee7ae85f2fe2239e27d9c1e23fffe168d63b4055  frozen USDC (Blacklisted)
-- ETH moved inside contract calls is not here: the dataset has no traces table.
SELECT block_num, timestamp, evm_decode_hex(tx_hash) AS tx_hash,
       arrow_cast(log_index, 'Int64') AS log_index,
       evm_decode_hex(token) AS token_address,
       evm_decode_hex(d['from']) AS from_address,
       evm_decode_hex(d['to']) AS to_address,
       arrow_cast(d['value'], 'Utf8') AS amount_raw
FROM (
  SELECT block_num, timestamp, tx_hash, log_index, address AS token,
         evm_decode_log(topic1, topic2, topic3, data, 'Transfer(address indexed from, address indexed to, uint256 value)') AS d
  FROM "{{dataset}}".logs
  WHERE _block_num >= {{from_block}}
    AND topic0 = evm_topic('Transfer(address indexed from, address indexed to, uint256 value)')
    AND topic3 IS NULL  -- ERC-20 only, ERC-721 indexes tokenId in topic3
    AND (topic1 IN (
    evm_encode_hex('0x000000000000000000000000008f06f04b72da2621a4f37f5531cc7352187dcd'),
    evm_encode_hex('0x0000000000000000000000000ddf0480016e6bcb2c1f5d190d221fba1320697e'),
    evm_encode_hex('0x00000000000000000000000028c6c06298d514db089934071355e5743bf21d60'),
    evm_encode_hex('0x00000000000000000000000042cdf00c85005630cc8605731b9364f712077810'),
    evm_encode_hex('0x0000000000000000000000005227f603c1ee34ce3c06efe6477003bdfccb2f8c'),
    evm_encode_hex('0x0000000000000000000000005c23023ca6633f91ded909b4a753a3ca00fea4fc'),
    evm_encode_hex('0x00000000000000000000000063e842b054bd624a465454d533c33f573e9c6fae'),
    evm_encode_hex('0x00000000000000000000000077edef23fbd05921c26fe29fcc3a65e14d2ac3eb'),
    evm_encode_hex('0x0000000000000000000000007aa4d3029e4c6a8e916300014ad95b6d6c03bfd1'),
    evm_encode_hex('0x0000000000000000000000007c8601d4645b93cea45f71e118a729332e6b5ca0'),
    evm_encode_hex('0x0000000000000000000000007f9dc988b46336ad536828fad50fa8fa1e5415e3'),
    evm_encode_hex('0x000000000000000000000000811f15855476156ebf86ba3b84fafb8ceaa4e84c'),
    evm_encode_hex('0x0000000000000000000000008532fa14acaf483729c449b8458aeddb900543d4'),
    evm_encode_hex('0x000000000000000000000000897c80d1a9729e94460e2bd93178bd5215158df3'),
    evm_encode_hex('0x0000000000000000000000008c1c499b1796d7f3c2521ac37186b52de024e58c'),
    evm_encode_hex('0x0000000000000000000000008d53903625b8e839b9df4bd28b0efb1cd6b8639a'),
    evm_encode_hex('0x0000000000000000000000009749292d74fd460982d0912ea9515ea24736c762'),
    evm_encode_hex('0x000000000000000000000000a97bf7836f8a08f9ed91d41453d371493fae8d10'),
    evm_encode_hex('0x000000000000000000000000aa246bf639586a6ba46762d378ce50ca4fc654a0'),
    evm_encode_hex('0x000000000000000000000000b171ca86f82070282138352ff7111b494060c8c3'),
    evm_encode_hex('0x000000000000000000000000b3ddec0ccc5c3ba733fcdf5a15f98c95ec5a5fdb'),
    evm_encode_hex('0x000000000000000000000000beef02961503351625926ea9a11ae13b29f5c555'),
    evm_encode_hex('0x000000000000000000000000c887af690e0301cd4edbbce8f8d31b4ec65b286a'),
    evm_encode_hex('0x000000000000000000000000ccbef95633adb5cd2b5038db5a38d77e726ca263'),
    evm_encode_hex('0x000000000000000000000000cf4ca2bdf21bc3a467a00b6afe72b833982723e0'),
    evm_encode_hex('0x000000000000000000000000e7024ab80143b1ef843efe6a58368696cb87958d'),
    evm_encode_hex('0x000000000000000000000000ee7ae85f2fe2239e27d9c1e23fffe168d63b4055')
    ) OR topic2 IN (
    evm_encode_hex('0x000000000000000000000000008f06f04b72da2621a4f37f5531cc7352187dcd'),
    evm_encode_hex('0x0000000000000000000000000ddf0480016e6bcb2c1f5d190d221fba1320697e'),
    evm_encode_hex('0x00000000000000000000000028c6c06298d514db089934071355e5743bf21d60'),
    evm_encode_hex('0x00000000000000000000000042cdf00c85005630cc8605731b9364f712077810'),
    evm_encode_hex('0x0000000000000000000000005227f603c1ee34ce3c06efe6477003bdfccb2f8c'),
    evm_encode_hex('0x0000000000000000000000005c23023ca6633f91ded909b4a753a3ca00fea4fc'),
    evm_encode_hex('0x00000000000000000000000063e842b054bd624a465454d533c33f573e9c6fae'),
    evm_encode_hex('0x00000000000000000000000077edef23fbd05921c26fe29fcc3a65e14d2ac3eb'),
    evm_encode_hex('0x0000000000000000000000007aa4d3029e4c6a8e916300014ad95b6d6c03bfd1'),
    evm_encode_hex('0x0000000000000000000000007c8601d4645b93cea45f71e118a729332e6b5ca0'),
    evm_encode_hex('0x0000000000000000000000007f9dc988b46336ad536828fad50fa8fa1e5415e3'),
    evm_encode_hex('0x000000000000000000000000811f15855476156ebf86ba3b84fafb8ceaa4e84c'),
    evm_encode_hex('0x0000000000000000000000008532fa14acaf483729c449b8458aeddb900543d4'),
    evm_encode_hex('0x000000000000000000000000897c80d1a9729e94460e2bd93178bd5215158df3'),
    evm_encode_hex('0x0000000000000000000000008c1c499b1796d7f3c2521ac37186b52de024e58c'),
    evm_encode_hex('0x0000000000000000000000008d53903625b8e839b9df4bd28b0efb1cd6b8639a'),
    evm_encode_hex('0x0000000000000000000000009749292d74fd460982d0912ea9515ea24736c762'),
    evm_encode_hex('0x000000000000000000000000a97bf7836f8a08f9ed91d41453d371493fae8d10'),
    evm_encode_hex('0x000000000000000000000000aa246bf639586a6ba46762d378ce50ca4fc654a0'),
    evm_encode_hex('0x000000000000000000000000b171ca86f82070282138352ff7111b494060c8c3'),
    evm_encode_hex('0x000000000000000000000000b3ddec0ccc5c3ba733fcdf5a15f98c95ec5a5fdb'),
    evm_encode_hex('0x000000000000000000000000beef02961503351625926ea9a11ae13b29f5c555'),
    evm_encode_hex('0x000000000000000000000000c887af690e0301cd4edbbce8f8d31b4ec65b286a'),
    evm_encode_hex('0x000000000000000000000000ccbef95633adb5cd2b5038db5a38d77e726ca263'),
    evm_encode_hex('0x000000000000000000000000cf4ca2bdf21bc3a467a00b6afe72b833982723e0'),
    evm_encode_hex('0x000000000000000000000000e7024ab80143b1ef843efe6a58368696cb87958d'),
    evm_encode_hex('0x000000000000000000000000ee7ae85f2fe2239e27d9c1e23fffe168d63b4055')
    ))
) erc20
WHERE d['value'] <> '0'
UNION ALL
SELECT block_num, timestamp, evm_decode_hex(tx_hash), arrow_cast(-1, 'Int64'), 'ETH',
       evm_decode_hex("from"), evm_decode_hex("to"), value
FROM "{{dataset}}".transactions
WHERE _block_num >= {{from_block}}
  AND value <> '0'
  AND ("from" IN (
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
    evm_encode_hex('0xbeef02961503351625926ea9a11ae13b29f5c555'),
    evm_encode_hex('0xc887af690e0301cd4edbbce8f8d31b4ec65b286a'),
    evm_encode_hex('0xccbef95633adb5cd2b5038db5a38d77e726ca263'),
    evm_encode_hex('0xcf4ca2bdf21bc3a467a00b6afe72b833982723e0'),
    evm_encode_hex('0xe7024ab80143b1ef843efe6a58368696cb87958d'),
    evm_encode_hex('0xee7ae85f2fe2239e27d9c1e23fffe168d63b4055')
  ) OR "to" IN (
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
    evm_encode_hex('0xbeef02961503351625926ea9a11ae13b29f5c555'),
    evm_encode_hex('0xc887af690e0301cd4edbbce8f8d31b4ec65b286a'),
    evm_encode_hex('0xccbef95633adb5cd2b5038db5a38d77e726ca263'),
    evm_encode_hex('0xcf4ca2bdf21bc3a467a00b6afe72b833982723e0'),
    evm_encode_hex('0xe7024ab80143b1ef843efe6a58368696cb87958d'),
    evm_encode_hex('0xee7ae85f2fe2239e27d9c1e23fffe168d63b4055')
  ))
SETTINGS stream = true
