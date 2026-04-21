ALTER TABLE public.user_permissions
ADD COLUMN IF NOT EXISTS can_edit_fees boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS can_edit_salaries boolean NOT NULL DEFAULT true;

UPDATE public.user_permissions
SET
  can_edit_fees = CASE
    WHEN can_manage_roles THEN true
    WHEN can_view_students AND can_edit_students AND can_view_teachers AND can_edit_teachers THEN true
    ELSE false
  END,
  can_edit_salaries = CASE
    WHEN can_manage_roles THEN true
    WHEN can_view_students AND can_edit_students AND can_view_teachers AND can_edit_teachers THEN true
    ELSE false
  END;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin') OR COALESCE((
    SELECT CASE _permission
      WHEN 'view_students' THEN can_view_students
      WHEN 'edit_students' THEN can_edit_students
      WHEN 'edit_fees' THEN can_edit_fees
      WHEN 'view_teachers' THEN can_view_teachers
      WHEN 'edit_teachers' THEN can_edit_teachers
      WHEN 'edit_salaries' THEN can_edit_salaries
      WHEN 'manage_roles' THEN can_manage_roles
      ELSE false
    END
    FROM public.user_permissions
    WHERE user_id = _user_id
  ), false)
$$;

DROP POLICY IF EXISTS "Users can edit payments with student permission" ON public.payments;
DROP POLICY IF EXISTS "Users can edit fee structures with student permission" ON public.fee_structures;
DROP POLICY IF EXISTS "Users can edit teacher salaries with permission" ON public.teacher_salaries;

CREATE POLICY "Users can edit payments with fee permission"
ON public.payments
FOR ALL
USING (public.has_permission(auth.uid(), 'edit_fees'))
WITH CHECK (public.has_permission(auth.uid(), 'edit_fees'));

CREATE POLICY "Users can edit fee structures with fee permission"
ON public.fee_structures
FOR ALL
USING (public.has_permission(auth.uid(), 'edit_fees'))
WITH CHECK (public.has_permission(auth.uid(), 'edit_fees'));

CREATE POLICY "Users can edit teacher salaries with salary permission"
ON public.teacher_salaries
FOR ALL
USING (public.has_permission(auth.uid(), 'edit_salaries'))
WITH CHECK (public.has_permission(auth.uid(), 'edit_salaries'));
