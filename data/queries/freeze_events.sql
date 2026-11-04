-- Mock query. The data agent replaces this file with the query that ran against Amp.
SELECT
  l.block_num,
  l.tx_hash,
  evm_decode_log(l.topic1, l.topic2, l.topic3, l.data, 'AddedBlackList(address _user)') AS added,
  evm_decode_log(
    l.topic1, l.topic2, l.topic3, l.data,
    'DestroyedBlackFunds(address _blackListedUser, uint256 _balance)'
  ) AS destroyed
FROM eth_rpc.logs AS l
WHERE l.block_num BETWEEN {{from_block}} AND {{to_block}}
  AND l.address = '0xdac17f958d2ee523a2206206994597c13d831ec7'
  AND l.topic0 IN (
    evm_topic('AddedBlackList(address _user)'),
    evm_topic('DestroyedBlackFunds(address _blackListedUser, uint256 _balance)')
  )
ORDER BY l.block_num
