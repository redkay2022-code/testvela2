import { createFileRoute, redirect } from '@tanstack/react-router';
import { rememberReferral } from '@/lib/referral';

/** 추천 링크: /ref/<추천인 ID> — 방문 기록(30일)을 남기고 홈으로 보낸다. */
export const Route = createFileRoute('/ref/$code')({
  beforeLoad: ({ params }) => {
    rememberReferral(params.code);
    throw redirect({ to: '/', replace: true });
  },
  component: () => null,
});
