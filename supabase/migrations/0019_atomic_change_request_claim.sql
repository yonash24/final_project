-- Prevent replay/concurrent confirmation of a management change request.
ALTER TABLE public.activity_change_requests
    DROP CONSTRAINT IF EXISTS activity_change_requests_status_check;

ALTER TABLE public.activity_change_requests
    ADD CONSTRAINT activity_change_requests_status_check
    CHECK (status IN ('pending','processing','confirmed','cancelled','expired','stale','failed'));

CREATE OR REPLACE FUNCTION public.claim_activity_change_request(
    p_nonce_hash TEXT,
    p_actor_email TEXT
)
RETURNS SETOF public.activity_change_requests
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.activity_change_requests
    SET status = 'processing'
    WHERE id = (
        SELECT id
        FROM public.activity_change_requests
        WHERE nonce_hash = p_nonce_hash
          AND actor_email = p_actor_email
          AND status = 'pending'
          AND expires_at > now()
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    )
    RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.claim_activity_change_request(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_activity_change_request(TEXT, TEXT) TO service_role;
