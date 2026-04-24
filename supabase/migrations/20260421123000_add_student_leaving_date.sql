ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS leaving_date date;

ALTER TABLE public.students
DROP CONSTRAINT IF EXISTS students_leaving_date_after_enrollment;

ALTER TABLE public.students
ADD CONSTRAINT students_leaving_date_after_enrollment
CHECK (leaving_date IS NULL OR leaving_date >= enrollment_date);
