-- Per-signal counterpart to grades.validation_proof_checked: confirms the
-- specific odds tick that triggered THIS signal (not just the final score,
-- checked once per fixture) is anchored in TxLINE's on-chain Merkle root.
-- Optional per architecture doc section 4.1 step 5, but load-bearing for the
-- "we prove it, not just claim it" pitch once wired into the grading loop.
ALTER TABLE grades ADD COLUMN odds_proof_checked BOOLEAN DEFAULT false;
