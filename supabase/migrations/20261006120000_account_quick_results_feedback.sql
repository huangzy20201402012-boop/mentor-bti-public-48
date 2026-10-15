-- Mentor BTI Account, Quick Results & Feedback
--
-- Additive migration. Do not edit after it has been applied to a Supabase project.
--
-- This is the first migration in this repository whose tables are reachable by the
-- `authenticated` role. V1.0 and V1.1 chose the opposite posture: revoke everything
-- from `anon` and `authenticated` and let the service role write on the server. That
-- posture is not available here, because the client writes these rows directly and
-- the whole point is that a user can read their own history. The gate is therefore
-- row-level security keyed on auth.uid(), not the absence of a grant.
--
-- Not applied by Claude Code. Review, then apply deliberately.

create table public.quick_results (
  id uuid primary key,
  -- The local result key the browser already uses. It is a UUID in a secure
  -- context but falls back to `quick-<base36>` over plain HTTP on a LAN, so it
  -- cannot be the primary key. Stored alongside so the existing result route can
  -- look its own record back up.
  result_key text not null check (
    char_length(result_key) between 1 and 96 and result_key ~ '^[A-Za-z0-9_-]+$'
  ),
  owner_id uuid not null references auth.users(id) on delete cascade,
  content_version text not null check (content_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  -- Derived scores only. The 48-item answers are never uploaded, so there is no
  -- column here that could hold them.
  result_payload jsonb not null check (jsonb_typeof(result_payload) = 'object'),
  created_at timestamptz not null default now(),
  constraint quick_results_owner_result_key_key unique (owner_id, result_key),
  -- Keeps the promoted column and the payload from drifting apart.
  constraint quick_results_payload_content_version_check
    check (result_payload ->> 'contentVersion' = content_version)
);

create table public.feedback_submissions (
  id bigint generated always as identity primary key,
  -- Nullable so that deleting an account keeps the feedback text for triage
  -- instead of erasing it. Submissions always populate it at insert time.
  owner_id uuid null references auth.users(id) on delete set null,
  category text not null check (category in ('bug', 'suggestion', 'content', 'other')),
  message text not null check (char_length(message) between 1 and 4000),
  status text not null default 'new' check (status in ('new', 'reviewed', 'resolved')),
  created_at timestamptz not null default now()
);

-- Account history is read newest-first and always scoped to one owner.
create index quick_results_owner_created_at_idx on public.quick_results (owner_id, created_at desc);
create index feedback_submissions_owner_created_at_idx on public.feedback_submissions (owner_id, created_at desc);
-- Triage in the Dashboard reads by status across all owners.
create index feedback_submissions_status_created_at_idx on public.feedback_submissions (status, created_at desc);

alter table public.quick_results enable row level security;
alter table public.feedback_submissions enable row level security;

-- Deliberately not FORCE ROW LEVEL SECURITY. FORCE extends the policies to the
-- table owner, and operators triage feedback through the Dashboard Table Editor;
-- if that connection resolves to the owner rather than to a BYPASSRLS role,
-- FORCE would hide every row and break the only review path this phase has.
-- It buys nothing against the threat that matters here: the browser never
-- connects as the owner, and a leaked owner credential would already be total.

create policy quick_results_select_own on public.quick_results
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy quick_results_insert_own on public.quick_results
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy quick_results_delete_own on public.quick_results
  for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy feedback_submissions_select_own on public.feedback_submissions
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy feedback_submissions_insert_own on public.feedback_submissions
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and status = 'new');

-- No update policy and no delete policy on feedback_submissions, on purpose.
-- A user must not be able to move their own ticket to `resolved`, and status
-- changes happen through the Dashboard under administrator credentials.

-- RLS is the gate; the grants below are the second lock. Supabase grants broad
-- table privileges to anon/authenticated by default in the public schema, so
-- revoking first is what makes the grant list below the complete statement of
-- what these roles may attempt at all.
revoke all on table public.quick_results, public.feedback_submissions from anon, authenticated;
revoke all on sequence public.feedback_submissions_id_seq from anon, authenticated;

grant select, insert, delete on table public.quick_results to authenticated;
-- No update or delete: users submit and read back their own feedback, nothing more.
grant select, insert on table public.feedback_submissions to authenticated;
-- An identity column still consults its sequence, so inserting needs USAGE on it.
grant usage on sequence public.feedback_submissions_id_seq to authenticated;
