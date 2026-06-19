ALTER TABLE public.student_payment_submissions
ADD COLUMN IF NOT EXISTS class_grade text;

CREATE INDEX IF NOT EXISTS student_payment_submissions_month_class_idx
ON public.student_payment_submissions (fee_month, class_grade);
