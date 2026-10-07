CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_hash text NOT NULL UNIQUE,
  system_code text NOT NULL UNIQUE,
  nickname text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (nickname) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or admin profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Update own nickname" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.seller_applications ADD COLUMN system_code text, ADD COLUMN nickname text;
ALTER TABLE public.seller_applications ALTER COLUMN wechat_id SET DEFAULT '', ALTER COLUMN wechat_nickname SET DEFAULT '', ALTER COLUMN studio_name SET DEFAULT '', ALTER COLUMN region SET DEFAULT '';
COMMENT ON COLUMN public.seller_applications.wechat_id IS 'DEPRECATED: WeChat removed; replaced by system_code';
COMMENT ON COLUMN public.seller_applications.wechat_nickname IS 'DEPRECATED: WeChat removed; replaced by nickname';
COMMENT ON COLUMN public.seller_applications.wechat_avatar IS 'DEPRECATED: WeChat removed';
COMMENT ON COLUMN public.seller_applications.wechat_phone IS 'DEPRECATED: phone numbers are never stored';
COMMENT ON TABLE public.wechat_identities IS 'DEPRECATED: WeChat sign-in removed; replaced by public.profiles';

CREATE OR REPLACE FUNCTION public.assign_owner_admin()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin') THEN
    INSERT INTO public.user_roles(user_id,role) VALUES (NEW.id,'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;