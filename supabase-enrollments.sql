-- Run this in Supabase SQL Editor before using the new active/inactive course history flow.
-- It keeps students as people and stores course/teacher/month history in enrollments.

create extension if not exists pgcrypto;

alter table public.teachers
add column if not exists role text,
add column if not exists cv text;

create table if not exists public.enrollments (
  id text primary key default gen_random_uuid()::text,
  student_id text not null,
  course_id text,
  course_name text,
  teacher_id text,
  teacher_name text,
  start_month text,
  end_month text,
  group_name text,
  status text not null default 'active',
  note text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.enrollments
add column if not exists student_id text,
add column if not exists course_id text,
add column if not exists course_name text,
add column if not exists teacher_id text,
add column if not exists teacher_name text,
add column if not exists start_month text,
add column if not exists end_month text,
add column if not exists group_name text,
add column if not exists status text not null default 'active',
add column if not exists note text,
add column if not exists archived_at timestamptz,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'enrollments_status_check'
  ) then
    alter table public.enrollments
    add constraint enrollments_status_check
    check (status in ('active', 'inactive', 'paused', 'completed'));
  end if;
end $$;

create index if not exists enrollments_student_id_idx
on public.enrollments (student_id);

create index if not exists enrollments_teacher_id_idx
on public.enrollments (teacher_id);

create index if not exists enrollments_start_month_idx
on public.enrollments (start_month);

drop index if exists public.enrollments_one_active_per_student_idx;

create index if not exists enrollments_active_student_idx
on public.enrollments (student_id, status)
where archived_at is null;

alter table public.payments
add column if not exists enrollment_id text,
add column if not exists course_id text,
add column if not exists course_name text,
add column if not exists group_name text,
add column if not exists payment_month text;

create index if not exists payments_enrollment_id_idx
on public.payments (enrollment_id);

create index if not exists payments_payment_month_idx
on public.payments (payment_month);

update public.payments
set payment_month = left(date::text, 7)
where payment_month is null and date is not null;

insert into public.enrollments (
  student_id,
  course_name,
  teacher_id,
  group_name,
  start_month,
  status,
  archived_at
)
select
  s.id::text,
  nullif(s.course, ''),
  nullif(s.teacher_id::text, ''),
  nullif(s.student_group, ''),
  nullif(s."group", ''),
  case when s.archived_at is null then 'active' else 'inactive' end,
  s.archived_at
from public.students s
where not exists (
  select 1
  from public.enrollments e
  where e.student_id = s.id::text
);

update public.enrollments e
set
  teacher_name = t.name,
  course_id = c.id::text,
  updated_at = now()
from public.teachers t, public.courses c
where e.teacher_id = t.id::text
  and e.course_id is null
  and lower(coalesce(e.course_name, '')) = lower(coalesce(c.name, ''));

update public.enrollments e
set
  course_id = c.id::text,
  updated_at = now()
from public.courses c
where e.course_id is null
  and lower(coalesce(e.course_name, '')) = lower(coalesce(c.name, ''));

update public.enrollments e
set
  teacher_name = t.name,
  updated_at = now()
from public.teachers t
where e.teacher_id = t.id::text
  and coalesce(e.teacher_name, '') = '';

update public.payments p
set
  enrollment_id = e.id,
  course_id = e.course_id,
  course_name = e.course_name,
  group_name = e.group_name,
  payment_month = coalesce(p.payment_month, left(p.date::text, 7))
from public.enrollments e
where p.student_id::text = e.student_id
  and p.enrollment_id is null
  and (
    e.status = 'active'
    or e.start_month = left(p.date::text, 7)
    or not exists (
      select 1
      from public.enrollments later_e
      where later_e.student_id = e.student_id
        and later_e.start_month > coalesce(e.start_month, '')
        and later_e.start_month <= left(p.date::text, 7)
    )
  );

alter table public.enrollments enable row level security;

drop policy if exists "app users can read enrollments" on public.enrollments;
drop policy if exists "admins can insert enrollments" on public.enrollments;
drop policy if exists "admins can update enrollments" on public.enrollments;
drop policy if exists "admins can delete enrollments" on public.enrollments;

create policy "app users can read enrollments"
on public.enrollments for select
to authenticated
using (public.is_app_admin() or public.is_teacher_account());

create policy "admins can insert enrollments"
on public.enrollments for insert
to authenticated
with check (public.is_app_admin());

create policy "admins can update enrollments"
on public.enrollments for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

create policy "admins can delete enrollments"
on public.enrollments for delete
to authenticated
using (public.is_app_admin());

drop policy if exists "admins read all, teachers read own payments" on public.payments;

create policy "admins read all, teachers read own payments"
on public.payments for select
to authenticated
using (
  public.is_app_admin()
  or exists (
    select 1
    from public.teachers t
    where lower(t.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (
        t.id::text = payments.teacher_id::text
        or exists (
          select 1
          from public.enrollments e
          where e.id = payments.enrollment_id
            and e.teacher_id = t.id::text
        )
        or exists (
          select 1
          from public.students s
          where s.id::text = payments.student_id::text
            and s.teacher_id::text = t.id::text
        )
      )
  )
);
