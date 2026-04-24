ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS monthly_fee numeric NOT NULL DEFAULT 0;

UPDATE public.students AS student
SET monthly_fee = tuition.amount
FROM public.fee_structures AS tuition
WHERE student.monthly_fee = 0
  AND tuition.class_grade = student.class_grade
  AND tuition.fee_type = 'tuition';
