ALTER TABLE public.student_payment_submissions
ADD COLUMN IF NOT EXISTS submitted_by_email text;

UPDATE public.student_payment_submissions AS submission
SET submitted_by_email = auth_user.email
FROM auth.users AS auth_user
WHERE submission.submitted_by = auth_user.id
  AND submission.submitted_by_email IS NULL;

CREATE OR REPLACE FUNCTION public.set_student_payment_submission_submitter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.submitted_by IS NULL THEN
    NEW.submitted_by := auth.uid();
  END IF;

  IF NEW.submitted_by IS NOT NULL AND NEW.submitted_by_email IS NULL THEN
    SELECT auth_user.email
    INTO NEW.submitted_by_email
    FROM auth.users AS auth_user
    WHERE auth_user.id = NEW.submitted_by;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_student_payment_submission_submitter ON public.student_payment_submissions;

CREATE TRIGGER set_student_payment_submission_submitter
BEFORE INSERT OR UPDATE OF submitted_by ON public.student_payment_submissions
FOR EACH ROW
EXECUTE FUNCTION public.set_student_payment_submission_submitter();

DROP POLICY IF EXISTS "Users can create student payment submissions with collection permission"
ON public.student_payment_submissions;

DROP POLICY IF EXISTS "Admins can create student payment submissions"
ON public.student_payment_submissions;

CREATE POLICY "Admins can create student payment submissions"
ON public.student_payment_submissions
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));
