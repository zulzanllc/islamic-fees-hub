alter table public.students
add column if not exists opening_due_amount numeric not null default 0;

update public.students
set opening_due_amount = coalesce(opening_due_amount, 0)
where opening_due_amount is null;

update public.students
set opening_due_amount = coalesce(opening_due_amount, 0) + (coalesce(opening_due_months, 0) * coalesce(monthly_fee, 0))
where coalesce(opening_due_amount, 0) = 0
  and coalesce(opening_due_months, 0) > 0;
