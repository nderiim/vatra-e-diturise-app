-- Run this in Supabase SQL Editor after:
-- 1) supabase-teacher-access.sql
-- 2) supabase-enrollments.sql
--
-- It adds daily attendance records used by the Vijueshmeria tab.
-- The reference ids are stored as text to match the existing custom tables.

create extension if not exists pgcrypto;

create table if not exists public.attendance_records (
  id text primary key default gen_random_uuid()::text,
  student_id text not null,
  enrollment_id text not null,
  teacher_id text,
  attendance_date date not null,
  status text not null,
  note text,
  marked_by uuid,
  marked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.attendance_records
add column if not exists student_id text,
add column if not exists enrollment_id text,
add column if not exists teacher_id text,
add column if not exists attendance_date date,
add column if not exists status text,
add column if not exists note text,
add column if not exists marked_by uuid,
add column if not exists marked_at timestamptz not null default now(),
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'attendance_records_status_check'
  ) then
    alter table public.attendance_records
    add constraint attendance_records_status_check
    check (status in ('present', 'absent'));
  end if;
end $$;

create unique index if not exists attendance_records_enrollment_date_unique
on public.attendance_records (enrollment_id, attendance_date);

create index if not exists attendance_records_student_date_idx
on public.attendance_records (student_id, attendance_date);

create index if not exists attendance_records_teacher_date_idx
on public.attendance_records (teacher_id, attendance_date);

create index if not exists attendance_records_date_idx
on public.attendance_records (attendance_date);

update public.attendance_records a
set
  teacher_id = e.teacher_id,
  student_id = coalesce(a.student_id, e.student_id),
  updated_at = now()
from public.enrollments e
where a.enrollment_id = e.id
  and (
    a.teacher_id is null
    or a.teacher_id = ''
    or a.student_id is null
    or a.student_id = ''
  );

create or replace function public.touch_attendance_record()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.marked_at is null then
    new.marked_at := now();
  end if;

  if tg_op = 'UPDATE' then
    new.marked_at := now();
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists attendance_records_touch on public.attendance_records;
create trigger attendance_records_touch
before insert or update on public.attendance_records
for each row execute function public.touch_attendance_record();

alter table public.attendance_records enable row level security;

drop policy if exists "admins read all, teachers read own attendance" on public.attendance_records;
drop policy if exists "admins and teachers can insert own attendance" on public.attendance_records;
drop policy if exists "admins and teachers can update own attendance" on public.attendance_records;
drop policy if exists "admins and teachers can delete own attendance" on public.attendance_records;

create policy "admins read all, teachers read own attendance"
on public.attendance_records for select
to authenticated
using (
  public.is_app_admin()
  or exists (
    select 1
    from public.teachers t
    where lower(t.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (
        t.id::text = attendance_records.teacher_id::text
        or exists (
          select 1
          from public.enrollments e
          where e.id = attendance_records.enrollment_id
            and e.teacher_id = t.id::text
        )
      )
  )
);

create policy "admins and teachers can insert own attendance"
on public.attendance_records for insert
to authenticated
with check (
  public.is_app_admin()
  or exists (
    select 1
    from public.teachers t
    where lower(t.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (
        t.id::text = attendance_records.teacher_id::text
        or exists (
          select 1
          from public.enrollments e
          where e.id = attendance_records.enrollment_id
            and e.teacher_id = t.id::text
        )
      )
  )
);

create policy "admins and teachers can update own attendance"
on public.attendance_records for update
to authenticated
using (
  public.is_app_admin()
  or exists (
    select 1
    from public.teachers t
    where lower(t.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (
        t.id::text = attendance_records.teacher_id::text
        or exists (
          select 1
          from public.enrollments e
          where e.id = attendance_records.enrollment_id
            and e.teacher_id = t.id::text
        )
      )
  )
)
with check (
  public.is_app_admin()
  or exists (
    select 1
    from public.teachers t
    where lower(t.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (
        t.id::text = attendance_records.teacher_id::text
        or exists (
          select 1
          from public.enrollments e
          where e.id = attendance_records.enrollment_id
            and e.teacher_id = t.id::text
        )
      )
  )
);

create policy "admins and teachers can delete own attendance"
on public.attendance_records for delete
to authenticated
using (
  public.is_app_admin()
  or exists (
    select 1
    from public.teachers t
    where lower(t.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (
        t.id::text = attendance_records.teacher_id::text
        or exists (
          select 1
          from public.enrollments e
          where e.id = attendance_records.enrollment_id
            and e.teacher_id = t.id::text
        )
      )
  )
);

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'write_audit_log'
  ) then
    execute 'drop trigger if exists audit_attendance_records_changes on public.attendance_records';
    execute 'create trigger audit_attendance_records_changes after insert or update or delete on public.attendance_records for each row execute function public.write_audit_log()';
  end if;
end $$;
