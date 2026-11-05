-- Latency probe, not a UI view: one row per new block, so block-to-client latency can be
-- measured even when no watched wallet moves. Run it for a few minutes only.
SELECT block_num, timestamp
FROM "{{dataset}}".blocks
WHERE _block_num >= {{from_block}}
SETTINGS stream = true
