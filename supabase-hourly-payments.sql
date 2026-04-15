alter table public.courses
add column if not exists pricing_type text not null default 'fixed';

alter table public.payments
add column if not exists payment_type text not null default 'fixed',
add column if not exists hours numeric,
add column if not exists rate numeric;

update public.courses
set pricing_type = 'fixed'
where pricing_type is null;

update public.payments
set payment_type = 'fixed'
where payment_type is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'courses_pricing_type_check'
  ) then
    alter table public.courses
    add constraint courses_pricing_type_check
    check (pricing_type in ('fixed', 'hourly'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'payments_payment_type_check'
  ) then
    alter table public.payments
    add constraint payments_payment_type_check
    check (payment_type in ('fixed', 'hourly'));
  end if;
end $$;
