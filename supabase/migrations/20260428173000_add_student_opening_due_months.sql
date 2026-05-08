alter table public.students
add column if not exists opening_due_months integer not null default 0;
