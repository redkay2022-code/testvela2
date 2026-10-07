import { formatDate } from '@/lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowDownWideNarrow, ArrowLeft, ArrowRight, Bell, Check, ChevronDown, Compass, Heart, Home, ImagePlus, MapPin, MessageCircle, Plus, Search, Send, Share2, ShoppingBag, Sparkles, User, X } from 'lucide-react';
import type { User as AuthUser } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { categories, media, priceLabel } from '@/lib/market-media';
import { marketSearch, paths, postsQuery, type Mode, type Post } from '@/lib/market';
import { addComment, getComments, setLike } from '@/lib/market.functions';
import { signInWithPhone, signUpWithPhone } from '@/lib/phone-auth.functions';

function imageFor(post: Post) { return post.media_urls[0] || media[post.image_key]; }

export function Marketplace({ mode = 'home' }: { mode?: Mode }) {
  const { data: posts } = useSuspenseQuery(postsQuery);
  const router = useRouter();
  const navigate = useNavigate();
  const location = useRouterState({ select: s => s.location });
  const search = marketSearch.parse(location.search);
  const basePath = paths[mode];
  const [user, setUser] = useState<AuthUser | null>(null);
  const [likes, setLikes] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<'recommended'|'newest'>('recommended');
  const [query, setQuery] = useState(search.q || '');
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();
  const likeAction = useServerFn(setLike);
  const likePending = useRef(new Set<string>());

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    void supabase.auth.getSession().then(({data}) => setUser(data.session?.user || null));
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let active = true;
    if (!user) { setLikes(new Set()); return; }
    void supabase.from('likes').select('post_id').eq('user_id',user.id).then(({data}) => {
      if (active) setLikes(new Set(data?.map(l => l.post_id) || []));
    });
    return () => { active = false; };
  }, [user]);
  useEffect(() => { setQuery(search.q || ''); }, [search.q]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 4500);
    return () => clearTimeout(timer);
  }, [message]);

  const updateSearch = (values: Partial<typeof search>) => navigate({to:basePath,search:prev => ({...prev,...values}),resetScroll:false});
  const closeOverlay = () => {
    const state: unknown = window.history.state;
    if (state && typeof state === 'object' && '__TSR_index' in state && typeof state.__TSR_index === 'number' && state.__TSR_index > 0) router.history.back();
    else void navigate({to:basePath,search:prev => ({...prev,post:undefined,auth:undefined,notice:undefined}),replace:true,resetScroll:false});
  };
  const requestAuth = () => void updateSearch({auth:true});
  const toggleLike = async (post: Post) => {
    if (!user) { requestAuth(); return; }
    if (likePending.current.has(post.id)) return;
    likePending.current.add(post.id);
    const liked = !likes.has(post.id);
    setLikes(prev => {const next = new Set(prev); if(liked) next.add(post.id); else next.delete(post.id); return next;});
    try { await likeAction({data:{postId:post.id,liked}}); }
    catch { setLikes(prev => {const next = new Set(prev); if(liked) next.delete(post.id); else next.add(post.id); return next;}); setMessage('좋아요를 저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { likePending.current.delete(post.id); }
  };

  let filtered = posts.filter(post => {
    if (mode === 'market' && post.price === null) return false;
    if (mode === 'me') return search.tab === 'posts' ? post.user_id === user?.id : likes.has(post.id);
    if (search.tab === 'following') return false;
    if (search.category && search.category !== '전체' && post.category !== search.category) return false;
    if (search.q && !`${post.title} ${post.creator} ${post.category} ${post.description}`.toLowerCase().includes(search.q.toLowerCase())) return false;
    if (search.tab === 'nearby') return post.category === '푸드' || post.category === '일상';
    return true;
  });
  if (sort === 'newest') filtered = [...filtered].sort((a,b) => b.created_at.localeCompare(a.created_at));
  const columns = [0,1,2].map(col => filtered.filter((_,i) => i%3 === col));
  const selected = posts.find(p => p.id === search.post);
  const displayName = String(user?.user_metadata['display_name'] || 'vela member');

  return <>
    <main className="market-shell">
      <header className="market-header">
        <Link to="/" className="brand" aria-label="벨라마켓 홈"><span className="brand-word">velamarket<span className="text-primary">.</span></span><span className="brand-korean">벨라마켓</span></Link>
        <div className="header-tools shrink-0">
          <form className="search-field header-search" onSubmit={e => {e.preventDefault(); void navigate({to:'/explore',search:{q:query || undefined}});}}>
            <Search size={17} className="shrink-0"/><input aria-label="검색" placeholder="어떤 취향을 찾고 있나요?" value={query} onChange={e => setQuery(e.target.value)}/>
          </form>
          <Button asChild variant="ghost" size="icon" className="icon-button mobile-search" title="검색"><Link to="/explore"><Search/></Link></Button>
          <Button variant="ghost" size="icon" className="icon-button relative" aria-label="알림" title="알림" onClick={() => void updateSearch({notice:true})}><Bell/><span className="notification-dot"/></Button>
          <Button asChild variant="ghost" size="icon" className="icon-button hidden sm:inline-flex" title="마이페이지"><Link to="/me"><User/></Link></Button>
        </div>
      </header>

      {mode === 'home' && <nav className="feed-tabs" aria-label="피드 선택">
        {[['following','팔로잉'],['discover','발견'],['nearby','내 주변']].map(([tab,label]) => <Button key={tab} asChild variant="ghost" className={`feed-tab ${(search.tab || 'discover') === tab ? 'active' : ''}`}><Link to="/" search={{tab:tab as 'following'|'discover'|'nearby'}} resetScroll={false}>{label}{tab === 'nearby' && <MapPin size={13}/>}</Link></Button>)}
      </nav>}

      {mode === 'explore' && <>
        <h1 className="page-topline">새로운 취향을 발견해 보세요</h1>
        <form className="search-field mb-5 w-full" onSubmit={e => {e.preventDefault(); void updateSearch({q:query || undefined});}}><Search size={19}/><input autoFocus aria-label="취향 검색" placeholder="상품, 공간, 크리에이터 검색" value={query} onChange={e => setQuery(e.target.value)}/>{query && <Button variant="ghost" size="icon" type="button" aria-label="검색어 지우기" onClick={() => {setQuery(''); void updateSearch({q:undefined});}}><X/></Button>}<Button type="submit" variant="ghost" size="icon" aria-label="검색 실행"><ArrowRight/></Button></form>
        {!search.q && <div className="flex items-center gap-3 text-xs text-muted-foreground"><Sparkles size={14}/><span>지금 많이 찾는</span>{['린넨','카페','카메라'].map(t => <Button key={t} variant="link" size="sm" onClick={() => void updateSearch({q:t})}>#{t}</Button>)}</div>}
      </>}
      {mode === 'market' && <div className="feed-heading mt-6"><div><h1>취향이 담긴 마켓</h1><p>누군가의 발견이, 당신의 일상으로</p></div><ShoppingBag size={23} className="text-primary"/></div>}

      {mode === 'me' && <>
        <div className="profile-summary"><div className="profile-avatar">{user ? displayName.slice(0,1).toUpperCase() : <User size={33}/>}</div><h1 className="text-xl font-bold">{user ? displayName : '나만의 취향을 모아보세요'}</h1><p className="mt-2 text-sm text-muted-foreground">{user ? user.email : '좋아하는 순간과 물건이 기다리고 있어요'}</p><Button className="mt-5" variant={user ? 'outline' : 'default'} onClick={() => user ? void supabase.auth.signOut() : requestAuth()}>{user ? '로그아웃' : '로그인 / 회원가입'}</Button></div>
        <nav className="feed-tabs"><Button asChild variant="ghost" className={`feed-tab ${search.tab !== 'posts' ? 'active':''}`}><Link to="/me" search={{tab:'likes'}} resetScroll={false}><Heart size={16}/>좋아요 {likes.size}</Link></Button><Button asChild variant="ghost" className={`feed-tab ${search.tab === 'posts' ? 'active':''}`}><Link to="/me" search={{tab:'posts'}} resetScroll={false}>내 게시물</Link></Button></nav>
      </>}

      {mode !== 'me' && mode !== 'upload' && <nav className="category-row" aria-label="카테고리">{categories.map(category => <Button asChild key={category} variant="ghost" className={`category-chip ${(search.category || '전체') === category ? 'active' : ''}`}><Link to={basePath} search={prev => ({...prev,category:category === '전체' ? undefined : category})} resetScroll={false}>{category}</Link></Button>)}<Button variant="ghost" size="icon" className="ml-auto shrink-0" title="최신순 정렬" aria-label="정렬 변경" onClick={() => setSort(prev => prev === 'recommended' ? 'newest' : 'recommended')}><ArrowDownWideNarrow size={17}/></Button></nav>}

      {mode === 'upload' ? <UploadForm user={user} requestAuth={requestAuth} onPosted={async () => {await queryClient.invalidateQueries({queryKey:['posts']}); void navigate({to:'/me',search:{tab:'posts'}});}}/> : <>
        {mode === 'home' && <div className="feed-heading"><div><h1>{search.tab === 'following' ? '함께 나누는 취향' : search.tab === 'nearby' ? '가까이 있는 작은 발견' : '오늘, 이런 취향은 어때요?'}</h1><p>{search.tab === 'nearby' ? '동네 카페와 일상의 이야기' : '좋아하는 순간과 물건을 발견하는 곳'}</p></div><span className="flex items-center gap-1 text-[11px] text-muted-foreground">{sort === 'newest' ? '최신순' : '추천순'}<ChevronDown size={12}/></span></div>}
        {mode === 'explore' && <div className="feed-heading"><div><h1>{search.q ? `“${search.q}” 검색 결과` : '지금 눈여겨볼 이야기'}</h1><p>{filtered.length}개의 발견</p></div></div>}
        {filtered.length > 0 ? <div className="feed-waterfall">{columns.map((column,i) => <div className="feed-column" key={i}>{column.map(post => <PostCard key={post.id} post={post} path={basePath} liked={likes.has(post.id)} onLike={() => void toggleLike(post)} search={search}/>)}</div>)}</div> : <div className="empty-state"><Compass size={36}/><p>{search.tab === 'following' ? '아직 팔로우한 크리에이터가 없어요.' : mode === 'me' ? '아직 모아둔 게시물이 없어요.' : '아직 이 취향의 게시물이 없어요.'}</p><Button asChild variant="link" className="mt-4"><Link to="/">새로운 취향 발견하기 <ArrowRight/></Link></Button></div>}
      </>}
    </main>

    <nav className="bottom-nav" aria-label="하단 메뉴"><div className="bottom-nav-inner">
      <Link to="/" className={`nav-item ${mode === 'home'?'active':''}`}><Home/><span>홈</span></Link>
      <Link to="/explore" className={`nav-item ${mode === 'explore'?'active':''}`}><Compass/><span>발견</span></Link>
      <Link to="/upload" className="nav-upload" aria-label="게시물 올리기" title="게시물 올리기"><Plus/></Link>
      <Link to="/market" className={`nav-item ${mode === 'market'?'active':''}`}><ShoppingBag/><span>마켓</span></Link>
      <Link to="/me" className={`nav-item ${mode === 'me'?'active':''}`}><User/><span>마이</span></Link>
    </div></nav>

    <AnimatePresence>{selected && <DetailDrawer key={selected.id} post={selected} user={user} liked={likes.has(selected.id)} onLike={() => void toggleLike(selected)} onClose={closeOverlay} requestAuth={requestAuth} notify={setMessage}/>}</AnimatePresence>
    {search.post && !selected && <SmallDialog title="게시물을 찾을 수 없어요" onClose={closeOverlay}><p className="text-sm text-muted-foreground">삭제되었거나 더 이상 공개되지 않은 게시물입니다.</p></SmallDialog>}
    {search.auth && <AuthDialog onClose={closeOverlay} onSignedIn={closeOverlay}/>}
    {search.notice && <SmallDialog title="알림" onClose={closeOverlay}><div className="py-8 text-center"><Bell className="mx-auto mb-4 text-primary" size={30}/><p className="text-sm font-medium">벨라마켓에 오신 걸 환영해요</p><p className="mt-2 text-xs text-muted-foreground">새로운 소식이 생기면 여기서 알려드릴게요.</p></div></SmallDialog>}
    {message && <div role="status" className="fixed bottom-24 left-1/2 z-[80] w-max max-w-[90%] -translate-x-1/2 rounded-md bg-foreground px-5 py-3 text-sm text-background shadow-lg">{message}</div>}
  </>;
}

function PostCard({post,path,liked,onLike,search}:{post:Post;path:typeof paths[Mode];liked:boolean;onLike:()=>void;search:ReturnType<typeof marketSearch.parse>}) {
  const shape = ['life-0','life-4','discover-1','discover-2'].includes(post.image_key) ? 'tall' : ['life-2','life-3','discover-0','discover-3'].includes(post.image_key) ? 'landscape' : 'medium';
  return <article className="post-card">
    <Link to={path} search={{...search,post:post.id}} resetScroll={false} className="post-open" aria-label={post.title}>
      <img src={imageFor(post)} alt={post.title} width={512} height={768} loading={['sunny-room','daily-bag','matcha-day'].includes(post.id) ? 'eager':'lazy'} className={`post-photo ${post.media_urls.length ? '' : shape}`}/>
      {post.duration && <span className="video-label"><span className="text-[9px]">▷</span>{post.duration}</span>}
      {post.price !== null && <span className="product-label"><ShoppingBag size={11}/>마켓</span>}
    </Link>
    <div className="post-info"><Link to={path} search={{...search,post:post.id}} resetScroll={false}><h2 className="post-title">{post.title}</h2></Link>{post.price !== null && <p className="post-price">{priceLabel(post.price)}</p>}<div className="creator-row"><span className="creator"><img src={imageFor(post)} alt="" loading="lazy" width={21} height={21} className="creator-avatar"/><span className="truncate">{post.creator}</span></span><Button variant="ghost" className={`like-button ${liked?'liked':''}`} onClick={onLike} aria-label={`${post.title} ${liked?'좋아요 취소':'좋아요'}`} aria-pressed={liked}><Heart/>{post.base_likes + (liked?1:0)}</Button></div></div>
  </article>;
}

function DetailDrawer({post,user,liked,onLike,onClose,requestAuth,notify}:{post:Post;user:AuthUser|null;liked:boolean;onLike:()=>void;onClose:()=>void;requestAuth:()=>void;notify:(s:string)=>void}) {
  const reducedMotion = useReducedMotion();
  const [comment,setComment] = useState('');
  const [pending,setPending] = useState(false);
  const [slide,setSlide] = useState(0);
  const carousel = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const commentsFn = useServerFn(getComments);
  const commentFn = useServerFn(addComment);
  const {data:comments,error:commentError} = useQuery({queryKey:['comments',post.id],queryFn:() => commentsFn({data:{postId:post.id}})});
  const pictures = post.media_urls.length ? post.media_urls : [media[post.image_key]];
  const submitComment = async (e:React.FormEvent) => {
    e.preventDefault();
    if(!user) {requestAuth();return;}
    if(!comment.trim() || pending) return;
    setPending(true);
    try {await commentFn({data:{postId:post.id,body:comment}});setComment('');await queryClient.invalidateQueries({queryKey:['comments',post.id]});}
    catch {notify('댓글을 저장하지 못했어요. 다시 시도해 주세요.');}
    finally {setPending(false);}
  };
  return <Dialog.Root open onOpenChange={open => {if(!open) onClose();}}><Dialog.Portal>
    <Dialog.Overlay asChild><motion.div className="drawer-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}/></Dialog.Overlay>
    <Dialog.Content asChild aria-describedby={undefined}><motion.div className="detail-drawer" initial={{y:reducedMotion?0:'100%'}} animate={{y:0}} exit={{y:reducedMotion?0:'100%'}} transition={{type:'spring',damping:32,stiffness:300}}>
      <div className="drawer-top"><Button variant="ghost" size="icon" onClick={onClose} aria-label="게시물 닫기"><ArrowLeft/></Button><div className="creator"><img src={imageFor(post)} className="creator-avatar" width={21} height={21} alt=""/><span className="truncate text-sm text-foreground">{post.creator}</span></div><Button variant="ghost" size="icon" aria-label="공유" onClick={async () => {try{const url = window.location.href;if(navigator.share) await navigator.share({title:post.title,url});else {await navigator.clipboard.writeText(url);notify('링크를 복사했어요.');}}catch{/* Share cancellation is not an error. */}}}><Share2/></Button></div>
      <div className="drawer-body">
        <div ref={carousel} className="detail-carousel" onScroll={e => setSlide(Math.round(e.currentTarget.scrollLeft/e.currentTarget.clientWidth))}>{post.video_url ? <video src={post.video_url} poster={pictures[0]} controls playsInline preload="metadata"/> : pictures.map((src,i) => <img key={i} src={src} alt={`${post.title} ${i+1}`} width={512} height={768}/>)}</div>
        {pictures.length > 1 && <div className="flex items-center justify-center gap-3 py-2"><Button variant="ghost" size="icon" aria-label="이전 사진" disabled={slide === 0} onClick={() => carousel.current?.scrollBy({left:-(carousel.current?.clientWidth || 0),behavior:reducedMotion?'auto':'smooth'})}><ArrowLeft/></Button><span className="text-xs text-muted-foreground">{slide+1} / {pictures.length}</span><Button variant="ghost" size="icon" aria-label="다음 사진" disabled={slide >= pictures.length-1} onClick={() => carousel.current?.scrollBy({left:carousel.current?.clientWidth || 0,behavior:reducedMotion?'auto':'smooth'})}><ArrowRight/></Button></div>}
        <div className="detail-copy"><span className="mb-2 inline-block text-xs text-primary">#{post.category}</span><Dialog.Title asChild><h2>{post.title}</h2></Dialog.Title>{post.price !== null && <p className="mt-3 text-2xl font-bold text-primary">{priceLabel(post.price)}</p>}<p className="detail-description whitespace-pre-wrap">{post.description}</p>{post.duration && !post.video_url && <p className="mb-5 text-xs text-muted-foreground">영상 미리보기 이미지</p>}<p className="text-[11px] text-muted-foreground">{formatDate(post.created_at)} · {post.creator}</p>
          <div className="mt-7 border-t border-border pt-6"><h3 className="flex items-center gap-2 text-sm font-semibold"><MessageCircle size={16}/>댓글 {comments?.length || 0}</h3>{commentError ? <p className="py-5 text-xs text-destructive">댓글을 불러오지 못했어요.</p> : comments?.length ? comments.map(c => <div key={c.id} className="mt-5 flex gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-xs text-primary">{c.creator.slice(0,1)}</span><div className="min-w-0"><p className="text-xs font-medium">{c.creator}</p><p className="mt-1 break-words text-sm text-muted-foreground">{c.body}</p></div></div>) : <p className="py-5 text-xs text-muted-foreground">첫 번째 이야기를 남겨보세요.</p>}
          <form onSubmit={submitComment} className="mt-3 flex items-center gap-2"><input className="form-input" aria-label="댓글" placeholder="따뜻한 댓글을 남겨주세요" value={comment} maxLength={1000} onChange={e => setComment(e.target.value)}/><Button size="icon" type="submit" aria-label="댓글 보내기" disabled={pending}><Send/></Button></form></div>
        </div>
      </div>
      <div className="detail-bottom"><Button variant="ghost" className={`like-button ${liked?'liked':''}`} onClick={onLike} aria-label="상세 좋아요" aria-pressed={liked}><Heart/>{post.base_likes+(liked?1:0)}</Button>{post.price !== null ? <Button className="ml-auto" onClick={() => {if(!user) requestAuth();else {document.querySelector<HTMLInputElement>('input[aria-label="댓글"]')?.focus();notify('댓글로 판매자에게 문의를 남겨주세요.');}}}><MessageCircle/>판매자에게 문의</Button> : <span className="ml-auto text-xs text-muted-foreground">좋아하는 순간을 함께 나눠요</span>}</div>
    </motion.div></Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}

function SmallDialog({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}) {
  return <Dialog.Root open onOpenChange={open => {if(!open) onClose();}}><Dialog.Portal><Dialog.Overlay className="drawer-backdrop auth-backdrop"/><Dialog.Content className="auth-dialog" aria-describedby={undefined}><div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center"><Dialog.Title className="text-xl font-bold">{title}</Dialog.Title><Button variant="ghost" size="icon" aria-label="창 닫기" onClick={onClose}><X/></Button></div>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}

export function AuthDialog({onClose,onSignedIn}:{onClose:()=>void;onSignedIn:()=>void}) {
  const [signup,setSignup] = useState(false);
  const [phone,setPhone] = useState('');
  const [password,setPassword] = useState('');
  const [name,setName] = useState('');
  const [error,setError] = useState('');
  const [pending,setPending] = useState(false);
  const signUpFn = useServerFn(signUpWithPhone), signInFn = useServerFn(signInWithPhone);
  const submit = async (e:React.FormEvent) => {
    e.preventDefault();setError('');setPending(true);
    try {
      const tokens = signup ? await signUpFn({data:{phone,password,nickname:name}}) : await signInFn({data:{phone,password}});
      const { error: sErr } = await supabase.auth.setSession(tokens);
      if (sErr) throw sErr;
      onSignedIn();
    }catch (err) {setError(err instanceof Error && err.message ? err.message : 'Could not connect. Please try again.');}
    finally {setPending(false);}
  };
  return <SmallDialog title={signup?'Create your account':'Welcome back'} onClose={onClose}><form onSubmit={submit}>{signup && <><label className="form-label" htmlFor="name">Display nickname</label><input id="name" className="form-input" required maxLength={30} value={name} onChange={e => setName(e.target.value)}/></>}<label className="form-label" htmlFor="phone">Phone number</label><input id="phone" className="form-input" type="tel" autoComplete="tel" placeholder="+86 138 0000 0000" required value={phone} onChange={e => setPhone(e.target.value)}/><label className="form-label" htmlFor="password">Password</label><input id="password" className="form-input" type="password" autoComplete={signup?'new-password':'current-password'} minLength={8} required value={password} onChange={e => setPassword(e.target.value)}/><p className="mt-3 text-xs leading-5 text-muted-foreground">Your phone number is never stored — only a one-way fingerprint that keeps one account per person.</p>{error && <p role="alert" className="mt-4 text-xs leading-5 text-destructive">{error}</p>}<Button type="submit" className="mt-6 w-full" disabled={pending}>{pending?'Connecting…':signup?'Sign up':'Sign in'}</Button><Button type="button" variant="link" className="mt-3 w-full text-xs" onClick={() => {setSignup(!signup);setError('');}}>{signup?'Already have an account? Sign in':'New here? Sign up'}</Button></form></SmallDialog>;
}

export function UploadForm({user,requestAuth,onPosted}:{user:AuthUser|null;requestAuth:()=>void;onPosted:()=>void}) {
  const [files,setFiles] = useState<File[]>([]);
  const [previews,setPreviews] = useState<string[]>([]);
  const [title,setTitle] = useState('');
  const [description,setDescription] = useState('');
  const [category,setCategory] = useState('일상');
  const [product,setProduct] = useState(false);
  const [price,setPrice] = useState('');
  const [boxPrice,setBoxPrice] = useState('');
  const [error,setError] = useState('');
  const [pending,setPending] = useState(false);
  useEffect(() => {const urls = files.map(f => URL.createObjectURL(f));setPreviews(urls);return () => urls.forEach(u => URL.revokeObjectURL(u));},[files]);
  const submit = async (e:React.FormEvent) => {
    e.preventDefault();if(!user) {requestAuth();return;}
    if(!files.length) {setError('사진 또는 영상을 선택해 주세요.');return;}
    if(files.some(f => f.size > 25*1024*1024)) {setError('파일당 최대 25MB까지 올릴 수 있어요.');return;}
    setError('');setPending(true);
    const uploaded:string[]=[];
    try {
      const video = files.find(f => f.type.startsWith('video/'));
      if(video && !files.some(f => f.type.startsWith('image/'))) throw new Error('영상과 함께 표지 사진도 선택해 주세요.');
      for(const file of files) {
        const extension = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g,'') || 'bin';
        const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const {error:uploadError} = await supabase.storage.from('market-media').upload(path,file);
        if(uploadError) throw new Error('사진을 올리지 못했어요. 다시 시도해 주세요.');
        uploaded.push(path);
      }
      const imagePaths = uploaded.filter((_,i) => files[i]?.type.startsWith('image/'));
      const videoIndex = files.findIndex(f => f.type.startsWith('video/'));
      const {error:saveError} = await supabase.from('posts').insert({user_id:user.id,title:title.trim(),description:description.trim(),category,creator:String(user.user_metadata['display_name'] || user.email?.split('@')[0] || 'vela member').slice(0,40),image_key:'uploaded',media_urls:imagePaths,video_url:videoIndex >= 0 ? uploaded[videoIndex] ?? null:null,price:product?Number(price):null,box_price:product&&boxPrice?Number(boxPrice):null});
      if(saveError) throw new Error('게시물을 저장하지 못했어요. 다시 시도해 주세요.');
      onPosted();
    } catch(err) {if(uploaded.length) await supabase.storage.from('market-media').remove(uploaded);setError(err instanceof Error?err.message:'잠시 후 다시 시도해 주세요.');}
    finally {setPending(false);}
  };
  return <form className="form-panel" onSubmit={submit}><h1 className="page-topline">당신의 취향을 나눠주세요</h1><label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-input bg-muted p-5"><ImagePlus size={28} className="text-primary"/><span className="text-sm text-muted-foreground">사진 · 영상 추가</span><span className="text-[11px] text-muted-foreground">사진 최대 15장 + 영상 1개 · 파일당 25MB</span><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple aria-label="사진 영상 선택" onChange={e => {const selected = Array.from(e.target.files || []);if(selected.filter(f=>f.type.startsWith('image/')).length > 15 || selected.filter(f=>f.type.startsWith('video/')).length > 1) {setError('사진 최대 15장과 영상 1개까지 선택할 수 있어요.');return;}setFiles(selected);setError('');}}/></label>{previews.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{previews.map((src,i) => <div key={src} className="relative overflow-hidden rounded-md bg-muted">{files[i]?.type.startsWith('video/')?<video src={src} className="aspect-square w-full object-cover" muted playsInline/>:<img src={src} alt={`선택한 사진 ${i+1}`} className="aspect-square w-full object-cover"/>}<Button variant="secondary" size="icon" type="button" className="absolute right-1 top-1 size-6" aria-label={`사진 ${i+1} 제거`} onClick={() => setFiles(prev => prev.filter((_,index) => index !== i))}><X/></Button></div>)}</div>}<label htmlFor="post-title" className="form-label">제목</label><input id="post-title" className="form-input" placeholder="어떤 이야기를 나누고 싶나요?" required maxLength={100} value={title} onChange={e => setTitle(e.target.value)}/><label htmlFor="description" className="form-label">이야기</label><textarea id="description" className="form-input min-h-28" placeholder="사진 속 순간이나 물건에 대해 알려주세요" required maxLength={3000} value={description} onChange={e => setDescription(e.target.value)}/><label htmlFor="category" className="form-label">카테고리</label><select id="category" className="form-input" value={category} onChange={e => setCategory(e.target.value)}>{categories.filter(c => c !== '전체').map(c => <option key={c}>{c}</option>)}</select><label className="mt-6 flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={product} onChange={e => setProduct(e.target.checked)} className="size-4 accent-primary"/><ShoppingBag size={17}/>마켓에 판매하기</label>{product && <><label htmlFor="price" className="form-label">판매 가격 (USD $)</label><input id="price" className="form-input" inputMode="numeric" type="number" min={1} max={100000000} required value={price} onChange={e => setPrice(e.target.value)}/><label htmlFor="box-price" className="form-label">풀셋 박스 추가 금액 (USD $, 선택)</label><input id="box-price" className="form-input" inputMode="numeric" type="number" min={0} max={100000000} placeholder="예: 50" value={boxPrice} onChange={e => setBoxPrice(e.target.value)}/></>}{error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}<Button type="submit" className="mt-7 w-full" disabled={pending}><Plus/>{pending?'올리는 중…':'게시물 올리기'}</Button></form>;
}