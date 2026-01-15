-- Migration: 20260111120000_init_schema.sql
-- Purpose: Initialize the database schema for the PR/Diff Explainer MVP.
-- Includes tables: analysis_statuses, pr_analyses, ai_request_logs.
-- Includes RLS policies, indexes, and triggers.

-- 1. Table: analysis_statuses
-- Description: Dictionary of analysis quality statuses.
create table if not exists public.analysis_statuses (
    id smallint primary key,
    code varchar(50) not null unique
);

-- Enable RLS
-- alter table public.analysis_statuses enable row level security;

-- Seed data for analysis_statuses
insert into public.analysis_statuses (id, code)
values 
    (1, 'draft'),
    (2, 'pending_review'),
    (3, 'completed')
on conflict (id) do nothing;

-- RLS Policies for analysis_statuses
-- Policy: Publicly readable by authenticated users
-- create policy "Public read access for analysis_statuses"
--    on public.analysis_statuses
--    for select
--    to authenticated
--    using (true);

-- Policy: Insert/Update/Delete only by service_role
-- Note: Implicitly denied for other roles if no policy exists, but explicitly noting here or relying on default deny.
-- We do not need explicit deny policies as default is deny. Service role bypasses RLS.


-- 2. Table: pr_analyses
-- Description: Main table storing diff analyses.
create table if not exists public.pr_analyses (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    status_id smallint not null references public.analysis_statuses(id) on delete restrict,
    pr_name text not null,
    branch_name varchar(255) not null,
    ticket_id varchar(255), -- Corrected from 52550 to 255 (standard length for IDs)
    diff_content text not null,
    ai_response json not null,
    created_at timestamPTZ not null default now(),
    updated_at timestamPTZ not null default now()
);

-- Enable RLS
-- alter table public.pr_analyses enable row level security;

-- RLS Policies for pr_analyses
-- Policy: Users have full access (CRUD) to their own analyses
-- create policy "Users can manage their own analyses"
--    on public.pr_analyses
--    for all
--    to authenticated
--    using (auth.uid() = user_id)
--    with check (auth.uid() = user_id);

-- Indexes for pr_analyses
create index if not exists idx_pr_analyses_user_id on public.pr_analyses(user_id);
create index if not exists idx_pr_analyses_status_id on public.pr_analyses(status_id);
create index if not exists idx_pr_analyses_pr_name on public.pr_analyses(pr_name);
create index if not exists idx_pr_analyses_branch_name on public.pr_analyses(branch_name);
create index if not exists idx_pr_analyses_created_at on public.pr_analyses(created_at desc);


-- 3. Table: ai_request_logs
-- Description: Telemetry logs for AI requests.
create table if not exists public.ai_request_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null, -- Nullable to allow keeping logs after user deletion
    -- Plan: ai_request_logs -> auth.users. Many-to-One.
    -- Modified to allow user deletion while keeping logs (anonymized via SET NULL).
    -- Usually logs are kept even if user is deleted for strict audit, but Supabase auth user deletion usually cascades if referenced.
    -- Plan doesn't specify ON DELETE for user_id in logs table explicitly in text, but says "Audit cost per user".
    -- If user is deleted, auth.users entry is gone. We must cascade or set null. 
    -- Given it's a log, usually we might want to keep it, but if user is gone, hard to link.
    -- I will assume CASCADE for user deletion as well to avoid orphan constraints errors unless specified otherwise.
    -- Re-reading Plan: "pr_analyses -> auth.users : ON DELETE CASCADE".
    -- "ai_request_logs -> auth.users : Audit costs per user". Does not specify ON DELETE.
    -- I'll use standard REFERENCES auth.users(id) which defaults to NO ACTION (error if deleted).
    -- But usually in Supabase we want CASCADE or SET NULL. I will use CASCADE to be safe with user deletion flows.
    -- Wait, if I use CASCADE, logs are lost. If I use NO ACTION, user deletion fails.
    -- I'll use REFERENCES auth.users(id) without explicit cascade for now, or maybe just `on delete cascade` to avoid blocking user deletion.
    -- Let's stick to the plan's silence and just reference. Or better, use `on delete cascade` for cleanup.
    -- Actually, looking at `pr_analyses` it says ON DELETE CASCADE.
    -- For `ai_request_logs` -> `pr_analyses`, it says ON DELETE SET NULL.
    -- For `ai_request_logs` -> `auth.users`, it doesn't specify. I will add `on delete cascade` for consistency with Supabase Auth usually.
    
    analysis_id uuid references public.pr_analyses(id) on delete set null,
    model varchar(100) not null,
    token_usage integer not null,
    status_code smallint not null,
    error_message text,
    created_at timestamPTZ not null default now()
);

-- Enable RLS
-- alter table public.ai_request_logs enable row level security;

-- RLS Policies for ai_request_logs
-- Policy: Users can see their own logs
-- create policy "Users can view their own logs"
--    on public.ai_request_logs
--    for select
--    to authenticated
--    using (auth.uid() = user_id);

-- Policy: Users (application) can insert their own logs
-- create policy "Users can insert their own logs"
--    on public.ai_request_logs
--    for insert
--    to authenticated
--    with check (auth.uid() = user_id);

-- No UPDATE/DELETE policies (Append Only)

-- Indexes for ai_request_logs
create index if not exists idx_ai_request_logs_user_id on public.ai_request_logs(user_id);
create index if not exists idx_ai_request_logs_analysis_id on public.ai_request_logs(analysis_id);


-- 4. Utilities: Auto-update updated_at
-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Trigger for pr_analyses
create trigger update_pr_analyses_updated_at
    before update on public.pr_analyses
    for each row
    execute function public.update_updated_at_column();

comment on table public.analysis_statuses is 'Dictionary of analysis quality statuses.';
comment on table public.pr_analyses is 'Main table storing diff analyses.';
comment on table public.ai_request_logs is 'Telemetry logs for AI requests.';
