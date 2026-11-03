import { SellerListings } from './seller-listings';
import type { ProxyTarget } from './member-picker';

/** 최고관리자 전용: 셀러 스토어 화면의 “상품 등록” 탭. 그 셀러를 대신해 상품·스토리를 등록·수정·삭제한다(셀러 대리 관리와 같은 기능). */
export function AdminStoreManage({ sellerId, nickname }: { sellerId: string; nickname: string }) {
  const target: ProxyTarget = { id: sellerId, nickname, seller: true };
  return <section className="mt-4 space-y-4 notranslate" translate="no" data-no-translate>
    <p className="rounded-lg border border-primary bg-primary/10 p-3 text-sm font-semibold">최고관리자 모드 · “{nickname}” 스토어의 상품·스토리를 대신 등록하고 수정합니다.</p>
    <SellerListings key={`${sellerId}-listings`} actAs={target} />
  </section>;
}
