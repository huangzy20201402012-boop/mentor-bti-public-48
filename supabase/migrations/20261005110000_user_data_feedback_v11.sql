-- Mentor BTI User Data & Feedback V1.1
-- Additive migration only. Do not edit the V1.0 migration after it may have
-- been applied to a Supabase project.

alter table public.anonymous_sessions
  add column if not exists privacy_version text;

alter table public.analytics_events
  add column if not exists test_run_id uuid;

alter table public.anonymous_results
  add column if not exists test_run_id uuid,
  add column if not exists questionnaire_version text;

alter table public.feedback
  add column if not exists test_run_id uuid,
  add column if not exists questionnaire_version text,
  add column if not exists scoring_version text;

alter table public.result_feedback
  add column if not exists test_run_id uuid,
  add column if not exists questionnaire_version text,
  add column if not exists scoring_version text;

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  anonymous_session_id uuid not null references public.anonymous_sessions(id) on delete restrict,
  user_id uuid null references auth.users(id) on delete set null,
  consent_type text not null check (consent_type in (
    'essential_operations', 'anonymous_analytics', 'anonymous_research', 'contact_permission'
  )),
  granted boolean not null,
  privacy_version text not null check (privacy_version ~ '^privacy-v[0-9]+\.[0-9]+$'),
  consented_at timestamptz not null default now(),
  revoked_at timestamptz null,
  source text not null default 'web' check (source in ('web', 'future-auth', 'admin-correction')),
  created_at timestamptz not null default now(),
  check ((granted and revoked_at is null) or (not granted and revoked_at is not null))
);

create table public.test_runs (
  id uuid primary key default gen_random_uuid(),
  anonymous_session_id uuid not null references public.anonymous_sessions(id) on delete restrict,
  user_id uuid null references auth.users(id) on delete set null,
  test_kind text not null check (test_kind = 'quick'),
  status text not null check (status in ('started', 'in_progress', 'completed', 'abandoned')),
  questionnaire_version text not null check (questionnaire_version ~ '^quick-q-v[0-9]+\.[0-9]+$'),
  scoring_version text not null check (scoring_version ~ '^quick-v[0-9]+\.[0-9]+$'),
  content_version text not null check (content_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  privacy_version text not null check (privacy_version ~ '^privacy-v[0-9]+\.[0-9]+$'),
  research_consent boolean not null default false,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz null,
  result_key text null check (result_key is null or (char_length(result_key) between 1 and 96 and result_key ~ '^[A-Za-z0-9_-]+$')),
  final_type_code text null check (final_type_code is null or final_type_code ~ '^[EM][DN][SF][CO]$'),
  final_domain_code text null check (final_domain_code is null or final_domain_code in ('ED', 'EN', 'MD', 'MN')),
  axis_em numeric(5, 2) null check (axis_em between 0 and 100),
  axis_dn numeric(5, 2) null check (axis_dn between 0 and 100),
  axis_sf numeric(5, 2) null check (axis_sf between 0 and 100),
  axis_co numeric(5, 2) null check (axis_co between 0 and 100),
  confidence_level smallint null check (confidence_level between 0 and 100),
  boundary_axes text[] not null default '{}'::text[] check (cardinality(boundary_axes) <= 4),
  check ((final_type_code is null and final_domain_code is null) or left(final_type_code, 2) = final_domain_code),
  check ((status = 'completed') = (completed_at is not null)),
  unique (anonymous_session_id, result_key)
);

create table public.test_answers (
  id bigint generated always as identity primary key,
  test_run_id uuid not null references public.test_runs(id) on delete cascade,
  question_id text not null check (question_id ~ '^Q[0-9]{3}$'),
  option_id text not null check (option_id ~ '^[A-Za-z0-9_-]{1,16}$'),
  numeric_value numeric(4, 2) null check (numeric_value between -1 and 1),
  is_na boolean not null default false,
  response_time_ms integer null check (response_time_ms between 0 and 1800000),
  answered_at timestamptz not null default now(),
  questionnaire_version text not null check (questionnaire_version ~ '^quick-q-v[0-9]+\.[0-9]+$'),
  check ((is_na and option_id = 'na' and numeric_value is null) or (not is_na and option_id <> 'na' and numeric_value is not null)),
  unique (test_run_id, question_id)
);

create table public.feedback_contacts (
  id uuid primary key default gen_random_uuid(),
  anonymous_session_id uuid not null references public.anonymous_sessions(id) on delete restrict,
  feedback_id bigint not null unique references public.feedback(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254 and email like '%@%'),
  contact_consent boolean not null check (contact_consent = true),
  privacy_version text not null check (privacy_version ~ '^privacy-v[0-9]+\.[0-9]+$'),
  consent_record_id uuid not null references public.consent_records(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz null
);

alter table public.analytics_events
  add constraint analytics_events_test_run_id_fkey foreign key (test_run_id) references public.test_runs(id) on delete set null;
alter table public.anonymous_results
  add constraint anonymous_results_test_run_id_fkey foreign key (test_run_id) references public.test_runs(id) on delete set null;
alter table public.feedback
  add constraint feedback_test_run_id_fkey foreign key (test_run_id) references public.test_runs(id) on delete set null;
alter table public.result_feedback
  add constraint result_feedback_test_run_id_fkey foreign key (test_run_id) references public.test_runs(id) on delete set null;

-- V1.0 created anonymous check constraints. Find and replace only the one
-- governing event names so the allowed list is explicit and migration-safe.
do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'public.analytics_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%event_name%'
  loop
    execute format('alter table public.analytics_events drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.analytics_events add constraint analytics_events_event_name_allowed check (event_name in (
  'page_view', 'landing_view', 'quick_test_intro_view', 'quick_test_start',
  'quick_test_resume', 'quick_test_question_reached', 'quick_test_na_selected',
  'quick_test_complete', 'quick_result_view', 'type_detail_view', 'domain_detail_view',
  'share_card_generate', 'share_card_download', 'share_to_peer_click',
  'referral_landing', 'result_feedback_open', 'result_feedback_submit',
  'general_feedback_submit', 'question_feedback_submit',
  'save_result_prompt_view', 'save_result_signup_click', 'save_result_signup_complete'
));

-- Same migration-safe replacement for the result-feedback reason white list.
do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'public.result_feedback'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%reason_tags%'
  loop
    execute format('alter table public.result_feedback drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.result_feedback add constraint result_feedback_reason_tags_allowed check (
  cardinality(reason_tags) <= 8
  and reason_tags <@ array[
    'type_matches', 'description_matches', 'axis_matches', 'details_resonate',
    'type_mismatch', 'axis_mismatch', 'description_mismatch', 'questions_hard_to_answer',
    'advisor_changes_by_context', 'not_enough_interaction', 'other'
  ]::text[]
);

create index test_runs_session_started_at_idx on public.test_runs (anonymous_session_id, started_at desc);
create index test_runs_status_started_at_idx on public.test_runs (status, started_at desc);
create index test_answers_test_run_id_idx on public.test_answers (test_run_id);
create index test_answers_question_answered_at_idx on public.test_answers (question_id, answered_at desc);
create index consent_records_session_type_consented_at_idx on public.consent_records (anonymous_session_id, consent_type, consented_at desc);
create index feedback_contacts_active_created_at_idx on public.feedback_contacts (created_at desc) where revoked_at is null;
create index analytics_events_test_run_id_idx on public.analytics_events (test_run_id) where test_run_id is not null;
create index feedback_test_run_id_idx on public.feedback (test_run_id) where test_run_id is not null;
create index result_feedback_test_run_id_idx on public.result_feedback (test_run_id) where test_run_id is not null;

-- Dashboard inputs are aggregation-only. They are not granted to browser roles.
create view public.analytics_daily_metrics_v11 with (security_invoker = true) as
select
  date_trunc('day', created_at)::date as metric_date,
  count(distinct session_id) filter (where event_name = 'landing_view') as landing_sessions,
  count(distinct session_id) filter (where event_name = 'quick_test_start') as test_start_sessions,
  count(distinct session_id) filter (where event_name = 'quick_test_complete') as test_complete_sessions,
  count(distinct session_id) filter (where event_name = 'quick_result_view') as result_view_sessions,
  count(distinct session_id) filter (where event_name in ('share_card_download', 'share_to_peer_click')) as share_sessions,
  count(*) filter (where event_name = 'share_to_peer_click' and metadata ->> 'shareMethod' = 'native') as native_share_actions,
  count(*) filter (where event_name = 'share_to_peer_click' and metadata ->> 'shareMethod' = 'copy') as link_copy_actions
from public.analytics_events
group by 1;

create view public.research_consent_daily_v11 with (security_invoker = true) as
select
  date_trunc('day', consented_at)::date as metric_date,
  count(*) filter (where consent_type = 'anonymous_research') as research_consent_decisions,
  count(*) filter (where consent_type = 'anonymous_research' and granted) as research_consent_granted
from public.consent_records
group by 1;

create view public.question_research_quality_daily_v11 with (security_invoker = true) as
select
  date_trunc('day', answered_at)::date as metric_date,
  questionnaire_version,
  question_id,
  count(*) as answered_count,
  count(*) filter (where is_na) as na_count,
  avg(response_time_ms) filter (where response_time_ms is not null) as avg_response_time_ms
from public.test_answers
group by 1, 2, 3;

alter table public.consent_records enable row level security;
alter table public.test_runs enable row level security;
alter table public.test_answers enable row level security;
alter table public.feedback_contacts enable row level security;

revoke all on table public.consent_records, public.test_runs, public.test_answers, public.feedback_contacts from anon, authenticated;
revoke all on sequence public.test_answers_id_seq from anon, authenticated;
revoke all on table public.analytics_daily_metrics_v11, public.research_consent_daily_v11, public.question_research_quality_daily_v11 from anon, authenticated;
