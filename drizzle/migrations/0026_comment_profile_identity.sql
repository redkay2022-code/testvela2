CREATE FUNCTION public.comment_author_profiles(_post_id text)
RETURNS TABLE(user_id uuid, nickname text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT pr.user_id, pr.nickname,
    CASE WHEN pr.avatar_url LIKE pr.user_id::text || '/%' AND pr.avatar_url NOT LIKE '%..%' THEN pr.avatar_url ELSE NULL END
  FROM public.comments c
  JOIN public.profiles pr ON pr.user_id = c.user_id
  JOIN public.posts p ON p.id = c.post_id
  WHERE c.post_id = _post_id AND p.status = 'published'
    AND auth.uid() IS NOT NULL
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'seller'))
    AND (public.store_is_visible(p.store_id) OR p.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
$$;
REVOKE ALL ON FUNCTION public.comment_author_profiles(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comment_author_profiles(text) TO authenticated, service_role;
COMMENT ON FUNCTION public.comment_author_profiles(text) IS 'Safe comment author identity only; preserves prelaunch staff and active-store visibility. Does not expose private profile columns.';