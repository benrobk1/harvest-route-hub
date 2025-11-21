-- Add status column to stripe_webhook_events for proper idempotency handling
-- This prevents permanent desyncs when webhook processing fails partway through

-- Add status column with default 'processing' for new inserts
ALTER TABLE public.stripe_webhook_events 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'processing'
  CHECK (status IN ('processing', 'completed', 'failed'));

-- Update existing events to 'completed' (they were successfully processed)
UPDATE public.stripe_webhook_events 
SET status = 'completed' 
WHERE status = 'processing';

-- Add index for efficient queries filtering by status
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status 
  ON public.stripe_webhook_events(status);

-- Add composite index for the common query pattern (event_id + status)
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_stripe_event_id_status 
  ON public.stripe_webhook_events(stripe_event_id, status);

-- Add comment explaining the status column
COMMENT ON COLUMN public.stripe_webhook_events.status IS 
  'Processing status: processing (being processed), completed (successfully finished), failed (processing failed and will be retried on next webhook attempt)';
