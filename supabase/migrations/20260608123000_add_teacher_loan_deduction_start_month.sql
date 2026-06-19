ALTER TABLE public.teacher_loans
ADD COLUMN IF NOT EXISTS deduction_start_month text;

UPDATE public.teacher_loans
SET deduction_start_month = to_char(date_issued::date, 'YYYY-MM')
WHERE deduction_start_month IS NULL;
