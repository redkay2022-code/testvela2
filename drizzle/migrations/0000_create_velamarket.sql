CREATE TABLE public.posts (id text PRIMARY KEY DEFAULT gen_random_uuid()::text, user_id uuid, title text NOT NULL, description text NOT NULL DEFAULT '', creator text NOT NULL DEFAULT 'vela member', category text NOT NULL DEFAULT '일상', image_key text NOT NULL, media_urls text[] NOT NULL DEFAULT '{}', video_url text, duration text, price integer, base_likes integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.posts TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public feed" ON public.posts FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Own posts insert" ON public.posts FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());
CREATE POLICY "Own posts update" ON public.posts FOR UPDATE TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
CREATE POLICY "Own posts delete" ON public.posts FOR DELETE TO authenticated USING (user_id=auth.uid());
CREATE TABLE public.likes (user_id uuid NOT NULL,post_id text NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,PRIMARY KEY(user_id,post_id));
GRANT SELECT,INSERT,DELETE ON public.likes TO authenticated;
GRANT ALL ON public.likes TO service_role;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own likes" ON public.likes FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE POLICY "Like posts" ON public.likes FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());
CREATE POLICY "Unlike posts" ON public.likes FOR DELETE TO authenticated USING (user_id=auth.uid());
CREATE TABLE public.comments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),post_id text NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,user_id uuid NOT NULL,creator text NOT NULL,body text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.comments TO anon;
GRANT SELECT,INSERT,DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read comments" ON public.comments FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY "Add own comment" ON public.comments FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY "Delete own comment" ON public.comments FOR DELETE TO authenticated USING(user_id=auth.uid());
INSERT INTO public.posts(id,title,description,creator,category,image_key,price,base_likes,duration) VALUES
('sunny-room','햇살이 머무는 나의 작은 공간 🌿','좋아하는 것들로 천천히 채워가는 집. 오후 세 시의 햇살이 가장 좋아요.','소소한집','홈·리빙','life-0',NULL,128,NULL),
('daily-bag','매일 들고 싶은, 클래식 레더 숄더백','부드러운 천연 가죽과 여유로운 수납. 데일리 룩에 자연스럽게 어울리는 숄더백이에요.','유나의옷장','패션','life-1',89000,256,NULL),
('matcha-day','오늘의 행복은 말차 한 잔 🍵','잠깐 멈추고 즐기는 달콤한 오후. 말차와 딸기 케이크는 언제나 정답.','카페노트','푸드','life-2',NULL,92,'0:24'),
('linen-day','가볍게, 자연스럽게. 린넨 데일리 룩','산뜻한 린넨으로 완성한 오늘의 코디. 편안함과 아름다움 사이.','무드앤','패션','life-3',45000,184,NULL),
('room-corner','비워두니 더 좋아진 거실 한 켠','따뜻한 햇살, 좋아하는 의자, 읽다 만 책 한 권.','공간기록','홈·리빙','life-4',NULL,347,'0:18'),
('tulips','꽃 한 다발로 달라지는 하루 🌷','창가에 두고 매일 바라보는 작은 행복. 여러분은 어떤 꽃을 좋아하세요?','봄의기록','일상','life-5',NULL,76,NULL),
('blue-cup','커피 시간이 기다려지는 블루 컵','깊은 코발트 블루의 세라믹 컵과 소서. 손에 쏙 들어오는 사이즈.','오브제스튜디오','홈·리빙','discover-0',24000,163,NULL),
('sea-trip','다음 여행은 바다가 보이는 곳으로','푸른 바다를 따라 느리게 걷던 날의 기록.','어디든지','여행','discover-1',NULL,512,'0:32'),
('film-camera','필름으로 남기는, 조금 느린 순간','소장하고 있던 레트로 카메라입니다. 상태와 세부 사진은 댓글로 문의해 주세요.','필름로그','디지털','discover-2',185000,219,NULL),
('white-sneakers','어떤 옷에도 잘 어울리는 스니커즈','깔끔한 화이트와 편안한 착화감. 사이즈 240, 새 상품입니다.','데일리픽','패션','discover-3',59000,105,NULL),
('cafe-corner','골목 끝에서 만난 작은 카페 ☕','조용한 음악과 따뜻한 커피. 나만 알고 싶은 공간.','서울산책','푸드','discover-4',NULL,284,NULL),
('spring-walk','산책하다 발견한 작은 봄','아무 계획 없이 걸었던 오후. 발끝에 작은 꽃들이 피어 있었어요.','오후의산책','일상','discover-5',NULL,68,NULL);