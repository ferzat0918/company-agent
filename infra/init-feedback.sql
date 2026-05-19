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
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  attachments  JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback (user_id);

-- Index for admin status filtering
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback (status);

-- Grant permissions to authenticated role (PostgREST uses JWT role claim)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO anon;

-- Storage bucket for feedback attachments (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-attachments', 'feedback-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for feedback-attachments bucket
DO $$ BEGIN
  CREATE POLICY "feedback_upload" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'feedback-attachments');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "feedback_read" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'feedback-attachments');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "feedback_public_read" ON storage.objects
    FOR SELECT TO anon USING (bucket_id = 'feedback-attachments');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
