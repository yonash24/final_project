-- Ensure notification delivery idempotency keys can prevent duplicate queued sends.

CREATE UNIQUE INDEX IF NOT EXISTS notification_deliveries_idempotency_idx
    ON public.notification_deliveries(idempotency_key)
    WHERE idempotency_key IS NOT NULL;
