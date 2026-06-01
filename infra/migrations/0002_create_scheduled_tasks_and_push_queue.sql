-- Database Migration: Create Scheduled Tasks and WeChat Push Queue tables
-- Idempotent: safe to run repeatedly.

-- 1. Create Universal Agent Scheduled Tasks Table
CREATE TABLE IF NOT EXISTS public.scheduled_agent_tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL,            -- Owner of the task (relates to profiles.user_id)
  thread_id        UUID NOT NULL,            -- Conversation thread ID to preserve context/memory
  task_description TEXT NOT NULL,            -- AI-written declarational instruction spec
  context_data     JSONB NOT NULL DEFAULT '{}'::jsonb, -- AI-passed parameter variables (e.g. chat_name, email)
  trigger_spec     TEXT NOT NULL,            -- Time specification (delay_seconds or standard 5-field cron)
  task_type        TEXT NOT NULL CHECK (task_type IN ('one-shot', 'cron')),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_log        TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_run_at      TIMESTAMPTZ               -- The calculated exact time for next execution
);

-- Index for scheduler polling performance
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_polling ON public.scheduled_agent_tasks (status, next_run_at);
-- Index for per-user lookup
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_id ON public.scheduled_agent_tasks (user_id);


-- 2. Create WeChat Push Queue Table for PC WeChat RPA client consumption
CREATE TABLE IF NOT EXISTS public.wechat_push_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,                             -- Owner of the message
  chat_name    TEXT NOT NULL,                             -- The WeChat session/friend nickname pointer
  content      TEXT NOT NULL,                             -- Text message to be sent
  attachments  JSONB NOT NULL DEFAULT '[]'::jsonb,        -- JSON list of absolute filepaths to be sent
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  error_msg    TEXT NOT NULL DEFAULT '',                  -- Stored exception log if sending fails
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ                                -- Exact timestamp when delivered successfully
);

-- Index for WeChat RPA client polling lock
CREATE INDEX IF NOT EXISTS idx_wechat_push_polling ON public.wechat_push_queue (status, created_at);
-- Index for per-user auditing
CREATE INDEX IF NOT EXISTS idx_wechat_push_user_id ON public.wechat_push_queue (user_id);


-- 3. Grant authenticated PostgREST roles read/write access (as done in feedback schema)
GRANT ALL ON public.scheduled_agent_tasks TO authenticated;
GRANT ALL ON public.scheduled_agent_tasks TO anon;

GRANT ALL ON public.wechat_push_queue TO authenticated;
GRANT ALL ON public.wechat_push_queue TO anon;
