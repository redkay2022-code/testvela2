CREATE TYPE public.app_role AS ENUM ('admin','seller','user');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, role public.app_role NOT NULL, UNIQUE(user_id,role));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
CREATE POLICY "Read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.wechat_identities (user_id uuid PRIMARY KEY, wechat_id text NOT NULL, nickname text NOT NULL, avatar_url text, phone text, is_sample boolean NOT NULL DEFAULT true, verified_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.wechat_identities TO authenticated;
GRANT ALL ON public.wechat_identities TO service_role;
ALTER TABLE public.wechat_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or admin" ON public.wechat_identities FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.seller_applications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE, studio_name text NOT NULL, region text NOT NULL, bio text NOT NULL DEFAULT '', wechat_id text NOT NULL, wechat_nickname text NOT NULL, wechat_avatar text, wechat_phone text, status text NOT NULL DEFAULT 'pending', reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.seller_applications TO authenticated;
GRANT ALL ON public.seller_applications TO service_role;
ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or admin apps" ON public.seller_applications FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.assign_owner_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF lower(NEW.email)='velamarket@proton.me' THEN
    INSERT INTO public.user_roles(user_id,role) VALUES (NEW.id,'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_owner_admin AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.assign_owner_admin();