-- Add indexes for credit and trial management
CREATE INDEX IF NOT EXISTS idx_credits_ledger_expires_at ON credits_ledger(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credits_ledger_transaction_type ON credits_ledger(transaction_type);

-- Add indexes on subscriptions for trial management
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end ON subscriptions(trial_end) WHERE trial_end IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);