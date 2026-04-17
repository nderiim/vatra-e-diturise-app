-- Run this in Supabase SQL Editor after adding teacher emails in the app.
-- Change this email if your owner/admin Google account is different.

alter table public.teachers
add column if not exists email text;

create unique index if not exists teachers_email_unique
on public.teachers (lower(email))
where email is not null and email <> '';

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = any (
    array['shtepiaediturise@gmail.com']
  );
$$;

create or replace function public.is_teacher_account()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teachers
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.courses enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "authenticated users can select students" on public.students;
drop policy if exists "authenticated users can insert students" on public.students;
drop policy if exists "authenticated users can update students" on public.students;
drop policy if exists "authenticated users can delete students" on public.students;
drop policy if exists "app users can read students" on public.students;
drop policy if exists "admins can insert students" on public.students;
drop policy if exists "admins can update students" on public.students;
drop policy if exists "admins can delete students" on public.students;

create policy "app users can read students"
on public.students for select
to authenticated
using (public.is_app_admin() or public.is_teacher_account());

create policy "admins can insert students"
on public.students for insert
to authenticated
with check (public.is_app_admin());

create policy "admins can update students"
on public.students for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

create policy "admins can delete students"
on public.students for delete
to authenticated
using (public.is_app_admin());

drop policy if exists "authenticated users can select teachers" on public.teachers;
drop policy if exists "authenticated users can insert teachers" on public.teachers;
drop policy if exists "authenticated users can update teachers" on public.teachers;
drop policy if exists "authenticated users can delete teachers" on public.teachers;
drop policy if exists "app users can read teachers" on public.teachers;
drop policy if exists "admins can insert teachers" on public.teachers;
drop policy if exists "admins can update teachers" on public.teachers;
drop policy if exists "admins can delete teachers" on public.teachers;

create policy "app users can read teachers"
on public.teachers for select
to authenticated
using (public.is_app_admin() or public.is_teacher_account());

create policy "admins can insert teachers"
on public.teachers for insert
to authenticated
with check (public.is_app_admin());

create policy "admins can update teachers"
on public.teachers for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

create policy "admins can delete teachers"
on public.teachers for delete
to authenticated
using (public.is_app_admin());

drop policy if exists "authenticated users can select courses" on public.courses;
drop policy if exists "authenticated users can insert courses" on public.courses;
drop policy if exists "authenticated users can update courses" on public.courses;
drop policy if exists "authenticated users can delete courses" on public.courses;
drop policy if exists "app users can read courses" on public.courses;
drop policy if exists "admins can insert courses" on public.courses;
drop policy if exists "admins can update courses" on public.courses;
drop policy if exists "admins can delete courses" on public.courses;

create policy "app users can read courses"
on public.courses for select
to authenticated
using (public.is_app_admin() or public.is_teacher_account());

create policy "admins can insert courses"
on public.courses for insert
to authenticated
with check (public.is_app_admin());

create policy "admins can update courses"
on public.courses for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

create policy "admins can delete courses"
on public.courses for delete
to authenticated
using (public.is_app_admin());

drop policy if exists "authenticated users can select payments" on public.payments;
drop policy if exists "authenticated users can insert payments" on public.payments;
drop policy if exists "authenticated users can update payments" on public.payments;
drop policy if exists "authenticated users can delete payments" on public.payments;
drop policy if exists "admins read all, teachers read own payments" on public.payments;
drop policy if exists "admins can insert payments" on public.payments;
drop policy if exists "admins can update payments" on public.payments;
drop policy if exists "admins can delete payments" on public.payments;

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
        t.id = payments.teacher_id
        or exists (
          select 1
          from public.students s
          where s.id = payments.student_id
            and s.teacher_id = t.id
        )
      )
  )
);

create policy "admins can insert payments"
on public.payments for insert
to authenticated
with check (public.is_app_admin());

create policy "admins can update payments"
on public.payments for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

create policy "admins can delete payments"
on public.payments for delete
to authenticated
using (public.is_app_admin());

drop policy if exists "authenticated users can select expenses" on public.expenses;
drop policy if exists "authenticated users can insert expenses" on public.expenses;
drop policy if exists "authenticated users can update expenses" on public.expenses;
drop policy if exists "authenticated users can delete expenses" on public.expenses;
drop policy if exists "admins can read expenses" on public.expenses;
drop policy if exists "admins can insert expenses" on public.expenses;
drop policy if exists "admins can update expenses" on public.expenses;
drop policy if exists "admins can delete expenses" on public.expenses;

create policy "admins can read expenses"
on public.expenses for select
to authenticated
using (public.is_app_admin());

create policy "admins can insert expenses"
on public.expenses for insert
to authenticated
with check (public.is_app_admin());

create policy "admins can update expenses"
on public.expenses for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

create policy "admins can delete expenses"
on public.expenses for delete
to authenticated
using (public.is_app_admin());
