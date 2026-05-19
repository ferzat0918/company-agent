-- Feedback / Feature-request table
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public.feedback (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  user_email   TEXT,
  type         TEXT NOT NULL CHECK (type IN ('bug', 'feature')),
  content      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'submitted'
               CHECK (status IN ('submitted', 'accepted', 'in_progress', 'rejected', 'on_hold')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback (user_id);

-- Index for admin status filtering
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback (status);
