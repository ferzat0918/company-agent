-- Database Migration: Add executed_at column to scheduled_agent_tasks
ALTER TABLE public.scheduled_agent_tasks ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;
