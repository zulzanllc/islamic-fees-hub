
CREATE TABLE public.manager_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  can_access_students BOOLEAN NOT NULL DEFAULT true,
  can_access_teachers BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.manager_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage manager_permissions" ON public.manager_permissions
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own permissions" ON public.manager_permissions
  FOR SELECT USING (auth.uid() = user_id);
