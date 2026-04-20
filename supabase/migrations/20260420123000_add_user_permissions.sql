CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  can_view_students boolean NOT NULL DEFAULT true,
  can_edit_students boolean NOT NULL DEFAULT true,
  can_view_teachers boolean NOT NULL DEFAULT false,
  can_edit_teachers boolean NOT NULL DEFAULT false,
  can_manage_roles boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own permissions"
ON public.user_permissions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage permissions"
ON public.user_permissions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.user_permissions (
  user_id,
  can_view_students,
  can_edit_students,
  can_view_teachers,
  can_edit_teachers,
  can_manage_roles
)
SELECT
  user_id,
  true,
  true,
  role IN ('admin', 'manager'),
  role = 'admin',
  role = 'admin'
FROM public.user_roles
ON CONFLICT (user_id) DO UPDATE SET
  can_view_students = EXCLUDED.can_view_students,
  can_edit_students = EXCLUDED.can_edit_students,
  can_view_teachers = EXCLUDED.can_view_teachers,
  can_edit_teachers = EXCLUDED.can_edit_teachers,
  can_manage_roles = EXCLUDED.can_manage_roles,
  updated_at = now();

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
      WHEN 'view_teachers' THEN can_view_teachers
      WHEN 'edit_teachers' THEN can_edit_teachers
      WHEN 'manage_roles' THEN can_manage_roles
      ELSE false
    END
    FROM public.user_permissions
    WHERE user_id = _user_id
  ), false)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_permissions (
    user_id,
    can_view_students,
    can_edit_students,
    can_view_teachers,
    can_edit_teachers,
    can_manage_roles
  )
  VALUES (NEW.id, true, true, false, false, false)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Authenticated users can access students" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can access payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can access fee_structures" ON public.fee_structures;

CREATE POLICY "Users can view students with permission"
ON public.students
FOR SELECT
USING (public.has_permission(auth.uid(), 'view_students'));

CREATE POLICY "Users can edit students with permission"
ON public.students
FOR ALL
USING (public.has_permission(auth.uid(), 'edit_students'))
WITH CHECK (public.has_permission(auth.uid(), 'edit_students'));

CREATE POLICY "Users can view payments with student permission"
ON public.payments
FOR SELECT
USING (public.has_permission(auth.uid(), 'view_students'));

CREATE POLICY "Users can edit payments with student permission"
ON public.payments
FOR ALL
USING (public.has_permission(auth.uid(), 'edit_students'))
WITH CHECK (public.has_permission(auth.uid(), 'edit_students'));

CREATE POLICY "Users can view fee structures with student permission"
ON public.fee_structures
FOR SELECT
USING (public.has_permission(auth.uid(), 'view_students'));

CREATE POLICY "Users can edit fee structures with student permission"
ON public.fee_structures
FOR ALL
USING (public.has_permission(auth.uid(), 'edit_students'))
WITH CHECK (public.has_permission(auth.uid(), 'edit_students'));

DROP POLICY IF EXISTS "Managers can view teachers" ON public.teachers;
DROP POLICY IF EXISTS "Managers can view teacher_loans" ON public.teacher_loans;
DROP POLICY IF EXISTS "Managers can view teacher_salaries" ON public.teacher_salaries;
DROP POLICY IF EXISTS "Managers can view teacher_attendance" ON public.teacher_attendance;

CREATE POLICY "Users can view teachers with permission"
ON public.teachers
FOR SELECT
USING (public.has_permission(auth.uid(), 'view_teachers'));

CREATE POLICY "Users can edit teachers with permission"
ON public.teachers
FOR ALL
USING (public.has_permission(auth.uid(), 'edit_teachers'))
WITH CHECK (public.has_permission(auth.uid(), 'edit_teachers'));

CREATE POLICY "Users can view teacher loans with permission"
ON public.teacher_loans
FOR SELECT
USING (public.has_permission(auth.uid(), 'view_teachers'));

CREATE POLICY "Users can edit teacher loans with permission"
ON public.teacher_loans
FOR ALL
USING (public.has_permission(auth.uid(), 'edit_teachers'))
WITH CHECK (public.has_permission(auth.uid(), 'edit_teachers'));

CREATE POLICY "Users can view teacher salaries with permission"
ON public.teacher_salaries
FOR SELECT
USING (public.has_permission(auth.uid(), 'view_teachers'));

CREATE POLICY "Users can edit teacher salaries with permission"
ON public.teacher_salaries
FOR ALL
USING (public.has_permission(auth.uid(), 'edit_teachers'))
WITH CHECK (public.has_permission(auth.uid(), 'edit_teachers'));

CREATE POLICY "Users can view teacher attendance with permission"
ON public.teacher_attendance
FOR SELECT
USING (public.has_permission(auth.uid(), 'view_teachers'));

CREATE POLICY "Users can edit teacher attendance with permission"
ON public.teacher_attendance
FOR ALL
USING (public.has_permission(auth.uid(), 'edit_teachers'))
WITH CHECK (public.has_permission(auth.uid(), 'edit_teachers'));
