DROP POLICY IF EXISTS "Admins can delete student payment submissions"
ON public.student_payment_submissions;

CREATE POLICY "Admins can delete student payment submissions"
ON public.student_payment_submissions
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));
