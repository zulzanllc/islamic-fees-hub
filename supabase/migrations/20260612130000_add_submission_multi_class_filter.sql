ALTER TABLE public.student_payment_submissions
ADD COLUMN IF NOT EXISTS class_grades text[];

UPDATE public.student_payment_submissions
SET class_grades = ARRAY[class_grade]
WHERE class_grade IS NOT NULL
  AND class_grades IS NULL;

CREATE INDEX IF NOT EXISTS student_payment_submissions_class_grades_idx
ON public.student_payment_submissions
USING gin (class_grades);
