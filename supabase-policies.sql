-- Run this in Supabase SQL Editor.
-- It enables RLS and allows signed-in users to use the app tables.

alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.courses enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "authenticated users can select students" on public.students;
drop policy if exists "authenticated users can insert students" on public.students;
drop policy if exists "authenticated users can update students" on public.students;
drop policy if exists "authenticated users can delete students" on public.students;

create policy "authenticated users can select students"
on public.students for select
to authenticated
using (true);

create policy "authenticated users can insert students"
on public.students for insert
to authenticated
with check (true);

create policy "authenticated users can update students"
on public.students for update
to authenticated
using (true)
with check (true);

create policy "authenticated users can delete students"
on public.students for delete
to authenticated
using (true);

drop policy if exists "authenticated users can select teachers" on public.teachers;
drop policy if exists "authenticated users can insert teachers" on public.teachers;
drop policy if exists "authenticated users can update teachers" on public.teachers;
drop policy if exists "authenticated users can delete teachers" on public.teachers;

create policy "authenticated users can select teachers"
on public.teachers for select
to authenticated
using (true);

create policy "authenticated users can insert teachers"
on public.teachers for insert
to authenticated
with check (true);

create policy "authenticated users can update teachers"
on public.teachers for update
to authenticated
using (true)
with check (true);

create policy "authenticated users can delete teachers"
on public.teachers for delete
to authenticated
using (true);

drop policy if exists "authenticated users can select courses" on public.courses;
drop policy if exists "authenticated users can insert courses" on public.courses;
drop policy if exists "authenticated users can update courses" on public.courses;
drop policy if exists "authenticated users can delete courses" on public.courses;

create policy "authenticated users can select courses"
on public.courses for select
to authenticated
using (true);

create policy "authenticated users can insert courses"
on public.courses for insert
to authenticated
with check (true);

create policy "authenticated users can update courses"
on public.courses for update
to authenticated
using (true)
with check (true);

create policy "authenticated users can delete courses"
on public.courses for delete
to authenticated
using (true);

drop policy if exists "authenticated users can select payments" on public.payments;
drop policy if exists "authenticated users can insert payments" on public.payments;
drop policy if exists "authenticated users can update payments" on public.payments;
drop policy if exists "authenticated users can delete payments" on public.payments;

create policy "authenticated users can select payments"
on public.payments for select
to authenticated
using (true);

create policy "authenticated users can insert payments"
on public.payments for insert
to authenticated
with check (true);

create policy "authenticated users can update payments"
on public.payments for update
to authenticated
using (true)
with check (true);

create policy "authenticated users can delete payments"
on public.payments for delete
to authenticated
using (true);

drop policy if exists "authenticated users can select expenses" on public.expenses;
drop policy if exists "authenticated users can insert expenses" on public.expenses;
drop policy if exists "authenticated users can update expenses" on public.expenses;
drop policy if exists "authenticated users can delete expenses" on public.expenses;

create policy "authenticated users can select expenses"
on public.expenses for select
to authenticated
using (true);

create policy "authenticated users can insert expenses"
on public.expenses for insert
to authenticated
with check (true);

create policy "authenticated users can update expenses"
on public.expenses for update
to authenticated
using (true)
with check (true);

create policy "authenticated users can delete expenses"
on public.expenses for delete
to authenticated
using (true);
