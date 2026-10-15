-- Mentor BTI Analytics & Feedback V1.0
-- Public Beta stores anonymous product signals only. It never stores a full
-- answer payload, a mentor identity, institution, contact detail, or profile.

create extension if not exists pgcrypto;

create table public.anonymous_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  entry_path text not null check (char_length(entry_path) <= 200 and entry_path like '/%'),
  entry_referrer text check (entry_referrer is null or char_length(entry_referrer) <= 255),
  client_type text not null default 'unknown' check (client_type in ('mobile', 'desktop', 'tablet', 'wechat_webview', 'unknown')),
  utm_source text check (utm_source is null or char_length(utm_source) <= 128),
  utm_medium text check (utm_medium is null or char_length(utm_medium) <= 128),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 128)
);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.anonymous_sessions(id) on delete restrict,
  created_at timestamptz not null default now(),
  event_name text not null check (event_name in (
    'page_view', 'landing_view', 'quick_test_intro_view', 'quick_test_start',
    'quick_test_resume', 'quick_test_question_reached', 'quick_test_na_selected',
    'quick_test_complete', 'quick_result_view', 'type_detail_view', 'domain_detail_view',
    'share_card_generate', 'share_card_download', 'share_to_peer_click',
    'referral_landing', 'result_feedback_open', 'result_feedback_submit',
    'general_feedback_submit', 'question_feedback_submit'
  )),
  page_path text not null check (char_length(page_path) <= 200 and page_path like '/%'),
  question_index smallint check (question_index between 1 and 48),
  question_id text check (question_id is null or question_id ~ '^Q[0-9]{3}$'),
  type_code text check (type_code is null or type_code ~ '^[EM][DN][SF][CO]$'),
  domain_code text check (domain_code is null or domain_code in ('ED', 'EN', 'MD', 'MN')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 2048),
  check ((type_code is null and domain_code is null) or (left(type_code, 2) = domain_code))
);

create table public.feedback (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.anonymous_sessions(id) on delete restrict,
  created_at timestamptz not null default now(),
  feedback_type text not null check (feedback_type in ('general', 'question_unclear', 'result_inaccurate', 'result_accurate', 'page_bug', 'share_issue', 'visual_issue', 'suggestion', 'other')),
  rating smallint check (rating between 1 and 5),
  message text check (message is null or char_length(message) between 1 and 1000),
  page_path text check (page_path is null or (char_length(page_path) <= 200 and page_path like '/%')),
  question_id text check (question_id is null or question_id ~ '^Q[0-9]{3}$'),
  type_code text check (type_code is null or type_code ~ '^[EM][DN][SF][CO]$'),
  domain_code text check (domain_code is null or domain_code in ('ED', 'EN', 'MD', 'MN')),
  reason_code text check (reason_code is null or reason_code in ('not_experienced', 'unclear_wording', 'no_suitable_option', 'context_varies', 'other')),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'ignored')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  check ((type_code is null and domain_code is null) or (left(type_code, 2) = domain_code)),
  check ((feedback_type = 'question_unclear' and question_id is not null and reason_code is not null) or feedback_type <> 'question_unclear'),
  check (reason_code is null or feedback_type = 'question_unclear')
);

create table public.result_feedback (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.anonymous_sessions(id) on delete restrict,
  created_at timestamptz not null default now(),
  result_key text not null check (char_length(result_key) between 1 and 96 and result_key ~ '^[A-Za-z0-9_-]+$'),
  type_code text not null check (type_code ~ '^[EM][DN][SF][CO]$'),
  domain_code text not null check (domain_code in ('ED', 'EN', 'MD', 'MN')),
  accuracy_rating smallint not null check (accuracy_rating between 1 and 5),
  reason_tags text[] not null default '{}'::text[] check (
    cardinality(reason_tags) <= 8
    and reason_tags <@ array[
      'type_matches', 'description_matches', 'axis_matches', 'details_resonate',
      'axis_mismatch', 'description_mismatch', 'questions_hard_to_answer',
      'advisor_changes_by_context', 'not_enough_interaction', 'other'
    ]::text[]
  ),
  comment text check (comment is null or char_length(comment) <= 1000),
  check (left(type_code, 2) = domain_code)
);

create table public.anonymous_results (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.anonymous_sessions(id) on delete restrict,
  created_at timestamptz not null default now(),
  result_key text not null check (char_length(result_key) between 1 and 96 and result_key ~ '^[A-Za-z0-9_-]+$'),
  type_code text not null check (type_code ~ '^[EM][DN][SF][CO]$'),
  domain_code text not null check (domain_code in ('ED', 'EN', 'MD', 'MN')),
  -- Every axis is the percentage for its left-side letter: E, D, S, or C.
  axis_em numeric(5, 2) not null check (axis_em between 0 and 100),
  axis_dn numeric(5, 2) not null check (axis_dn between 0 and 100),
  axis_sf numeric(5, 2) not null check (axis_sf between 0 and 100),
  axis_co numeric(5, 2) not null check (axis_co between 0 and 100),
  confidence_level smallint not null check (confidence_level between 0 and 100),
  boundary_axes text[] not null default '{}'::text[] check (cardinality(boundary_axes) <= 4),
  scoring_version text not null check (scoring_version ~ '^quick-v[0-9]+\.[0-9]+$'),
  content_version text not null check (content_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  unique (session_id, result_key),
  check (left(type_code, 2) = domain_code)
);

create table public.content_config (
  id bigint generated always as identity primary key,
  key text not null unique check (char_length(key) between 1 and 100),
  value jsonb not null check (jsonb_typeof(value) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index analytics_events_name_created_at_idx on public.analytics_events (event_name, created_at desc);
create index analytics_events_session_created_at_idx on public.analytics_events (session_id, created_at desc);
create index feedback_status_created_at_idx on public.feedback (status, created_at desc);
create index feedback_question_id_idx on public.feedback (question_id) where question_id is not null;
create index result_feedback_type_code_idx on public.result_feedback (type_code, created_at desc);
create index anonymous_results_type_code_idx on public.anonymous_results (type_code, created_at desc);
create index anonymous_results_scoring_version_idx on public.anonymous_results (scoring_version, created_at desc);

create or replace function public.set_content_config_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger content_config_set_updated_at
before update on public.content_config
for each row execute function public.set_content_config_updated_at();

-- Aggregation-only views for the first internal operating dashboard. They are
-- intentionally not granted to browser roles; query them from Supabase Studio
-- or an authenticated future server-only admin surface.
create view public.analytics_daily_metrics as
select
  date_trunc('day', created_at)::date as metric_date,
  count(*) filter (where event_name = 'quick_test_start') as test_starts,
  count(*) filter (where event_name = 'quick_test_complete') as test_completes,
  count(*) filter (where event_name = 'quick_result_view') as result_views,
  count(*) filter (where event_name = 'share_card_download') as share_card_downloads,
  count(*) filter (where event_name = 'share_to_peer_click' and metadata ->> 'shareMethod' = 'native') as native_share_actions,
  count(*) filter (where event_name = 'share_to_peer_click' and metadata ->> 'shareMethod' = 'copy') as link_copy_actions
from public.analytics_events
group by 1;

create view public.question_quality_daily as
select
  date_trunc('day', created_at)::date as metric_date,
  question_id,
  count(*) filter (where event_name = 'quick_test_question_reached') as reached_count,
  count(*) filter (where event_name = 'quick_test_na_selected') as na_count
from public.analytics_events
where question_id is not null
group by 1, 2;

alter table public.anonymous_sessions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.feedback enable row level security;
alter table public.result_feedback enable row level security;
alter table public.anonymous_results enable row level security;
alter table public.content_config enable row level security;

-- The browser never speaks to Supabase directly. There are deliberately no
-- anon/authenticated policies: all public-role reads and writes stay denied.
revoke all on table public.anonymous_sessions, public.analytics_events, public.feedback, public.result_feedback, public.anonymous_results, public.content_config from anon, authenticated;
revoke all on sequence public.analytics_events_id_seq, public.feedback_id_seq, public.result_feedback_id_seq, public.anonymous_results_id_seq, public.content_config_id_seq from anon, authenticated;
revoke all on table public.analytics_daily_metrics, public.question_quality_daily from anon, authenticated;
