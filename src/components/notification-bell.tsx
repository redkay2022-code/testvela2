import { useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { activeLang } from '@/lib/i18n';
import { SELLER_WELCOME_KIND, sellerWelcomeCopy } from '@/lib/seller-welcome';

/** In-app inbox: realtime notifications for the signed-in user with an unread badge. */
export function useNotifications(user: User | null) {
  const qc = useQueryClient();
  const key = ['notifications', user?.id];
  const { data = [] } = useQuery({ queryKey: key, enabled: !!user, queryFn: async () => {
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) throw error; return data;
  } });
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`notifications-${user.id}-${Math.random().toString(36).slice(2)}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
      void qc.invalidateQueries({ queryKey: ['notifications', user.id] });
      void qc.invalidateQueries({ queryKey: ['my-account', user.id] });
    }).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user?.id, qc]);
  const unread = user ? data.filter(n => !n.read_at).length : 0;
  const markRead = async () => {
    if (!user || !unread) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null).eq('user_id', user.id);
    void qc.invalidateQueries({ queryKey: key });
  };
  return { data: user ? data : [], unread, markRead };
}

export function NotificationInbox({ user, open, onClose, notifications }: { user: User | null; open: boolean; onClose: () => void; notifications: ReturnType<typeof useNotifications> }) {
  const { data, unread, markRead } = notifications;
  useEffect(() => { if (open && unread) void markRead(); }, [open, unread]);
  const lang = activeLang() === 'ko' ? 'ko' : 'en';
  return <Dialog.Root open={open} onOpenChange={o => { if (!o) onClose(); }}>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-background/70" />
      <Dialog.Content aria-describedby={undefined} className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between"><Dialog.Title className="text-base font-semibold">알림함</Dialog.Title><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="닫기"><X /></Button></Dialog.Close></div>
        {!user ? <p className="py-8 text-center text-sm text-muted-foreground">로그인하면 알림을 확인할 수 있습니다.</p> : data.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">새 알림이 없습니다.</p> : data.map(n => {
          const welcome = n.kind === SELLER_WELCOME_KIND ? sellerWelcomeCopy[lang] : null;
          return <article key={n.id} className="mb-3 rounded-xl border border-border p-4">
            <h3 className="font-semibold text-primary">{n.title}</h3>
            <small className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</small>
            {welcome ? <div className="mt-3 space-y-3 text-sm"><p>{welcome.intro}</p>{welcome.rules.map(([h, b]) => <div key={h}><strong className="block text-foreground">{h}</strong><p className="text-muted-foreground">{b}</p></div>)}</div>
              : <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{n.body}</p>}
            {n.cta_url && <Button asChild variant="gold" className="mt-4 w-full"><Link to={n.cta_url} onClick={onClose}>{welcome?.cta ?? n.cta_label}</Link></Button>}
          </article>;
        })}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
