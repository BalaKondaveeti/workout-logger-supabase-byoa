-- Gym log schema. Paste into the Supabase SQL Editor and run. Safe to re-run.
-- Every table is prefixed gym_ so it can live next to other apps in the same project;
-- nothing here touches any other table.

-- ---------- tables ----------

create table if not exists public.gym_muscles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  color text not null default '#888888',
  archived boolean not null default false
);

-- Day splits / workout types (Push, Pull, Legs, Arms…): the user's own list.
create table if not exists public.gym_day_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  color text not null default '#888888',
  archived boolean not null default false
);

create table if not exists public.gym_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  primary_muscle_id uuid references public.gym_muscles on delete set null,
  notes text,
  default_unit text not null default 'kg' check (default_unit in ('kg', 'lb')),
  archived boolean not null default false
);

create table if not exists public.gym_exercise_secondary_muscles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  exercise_id uuid not null references public.gym_exercises on delete cascade,
  muscle_id uuid not null references public.gym_muscles on delete cascade,
  unique (exercise_id, muscle_id)
);

create table if not exists public.gym_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  date date not null,
  check_in time,
  check_out time,
  pre_workout boolean not null default false,
  pre_workout_note text,
  rating smallint check (rating between 1 and 5),
  notes text,
  deleted_at timestamptz -- set = in Recently deleted; only "Delete permanently" removes the row
);

create table if not exists public.gym_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  day_id uuid not null references public.gym_days on delete cascade,
  exercise_id uuid not null references public.gym_exercises on delete restrict,
  position integer not null default 0,
  rating smallint check (rating between 1 and 5),
  notes text
);

create table if not exists public.gym_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  log_id uuid not null references public.gym_logs on delete cascade,
  position integer not null default 0,
  weight numeric,
  unit text not null default 'kg' check (unit in ('kg', 'lb')),
  reps integer,
  per_arm boolean not null default false, -- done with each arm separately
  side text check (side in ('left', 'right')), -- one arm only
  note text
);

create table if not exists public.gym_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  body text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- Columns added after the first version (no-ops on a fresh install).
alter table public.gym_sets add column if not exists side text check (side in ('left', 'right'));
alter table public.gym_sets add column if not exists note text;

-- ---------- indexes ----------

create index if not exists gym_muscles_user_idx on public.gym_muscles (user_id);
create index if not exists gym_exercises_user_idx on public.gym_exercises (user_id);
create index if not exists gym_exercises_primary_idx on public.gym_exercises (primary_muscle_id);
create index if not exists gym_secondary_user_idx on public.gym_exercise_secondary_muscles (user_id);
create index if not exists gym_secondary_muscle_idx on public.gym_exercise_secondary_muscles (muscle_id);
create index if not exists gym_days_user_date_idx on public.gym_days (user_id, date desc);

-- Soft delete for days: one live (not deleted) day per date; deleted days can share a date.
alter table public.gym_days add column if not exists deleted_at timestamptz;
alter table public.gym_days add column if not exists type_id uuid references public.gym_day_types on delete set null;
create index if not exists gym_day_types_user_idx on public.gym_day_types (user_id);
create index if not exists gym_days_type_idx on public.gym_days (type_id);
alter table public.gym_days drop constraint if exists gym_days_user_id_date_key;
create unique index if not exists gym_days_user_date_live_key on public.gym_days (user_id, date) where deleted_at is null;
create index if not exists gym_logs_user_idx on public.gym_logs (user_id);
create index if not exists gym_logs_day_idx on public.gym_logs (day_id);
create index if not exists gym_logs_exercise_idx on public.gym_logs (exercise_id);
create index if not exists gym_sets_user_idx on public.gym_sets (user_id);
create index if not exists gym_sets_log_idx on public.gym_sets (log_id);

-- ---------- row level security: each user sees only their own rows ----------

do $rls$
declare
  t text;
begin
  foreach t in array array[
    'gym_muscles', 'gym_day_types', 'gym_exercises', 'gym_exercise_secondary_muscles',
    'gym_days', 'gym_logs', 'gym_sets', 'gym_notes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated '
      'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end
$rls$;
