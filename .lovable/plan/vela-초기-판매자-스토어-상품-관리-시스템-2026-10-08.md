# VELA 초기 판매자 / 스토어 / 상품 관리 시스템

## 현재 상태 확인 결과
- 지금의 13개 초기 스토어와 26개 상품은 앱 안에만 있는 샘플이고, 데이터베이스에는 없습니다.
- 데이터베이스에는 셀러가 올린 실제 게시물(`posts`), 역할(`user_roles`), 셀러 신청서가 있습니다. 홈·검색·숏츠·구매 페이지는 이미 `posts`를 읽습니다.
- 관리자 백오피스(5개 탭)와 스토어 페이지는 이미 있습니다. 새로 만들지 않고 이것을 확장합니다.

## 방향
- **판매자**와 **스토어**를 서로 다른 데이터로 나눕니다. **상품**은 새 테이블을 만들지 않고 기존 `posts`에 열을 추가해 확장합니다. 그래서 홈·검색·숏츠·구매 화면은 그대로 동작합니다.
- 13개 샘플 스토어와 26개 상품은 데이터베이스로 옮기고 SEED로 표시합니다. 15개를 맞추기 위해 SEED 스토어 2개를 더 만듭니다(이름은 제가 정하고, 나중에 바꾸실 수 있습니다). 모두 CURATED 판매자에 연결합니다.
- 옮긴 뒤에는 앱 안의 샘플 상품 목록을 사용하지 않습니다. 고객 화면은 데이터베이스에서 PUBLISHED 상태인 상품만 보여 줍니다.
- 지어낸 판매량·리뷰·조회수는 보여 주지 않습니다. 실제 데이터가 없으면 0이나 빈 상태로 표시합니다.

## 관리자 화면 (/admin)
새 메뉴는 Dashboard / Stores / Products / Categories / Inventory / Orders(준비 중) / Settings입니다. 기존 판매자 승인·주문 검증·분쟁 탭은 지우지 않고 Settings 안이나 기존 위치로 옮깁니다. 데스크톱 우선이며 태블릿에서도 쓸 수 있습니다.
- **Stores**: 이름·ID·국가·상태로 검색하고, 전체/활성/비활성/인증/추천 필터를 씁니다. 목록에서 보기·편집·활성화·비활성화를 할 수 있습니다. 생성·편집 화면에서는 로고·커버·아바타 업로드, 소개, 국가/도시, 전문 분야, 배송 지역·안내, 인증 등급, 추천 여부를 입력합니다. 버튼은 Save Draft / Publish / Deactivate이고, 스토어를 만들면 판매자가 자동으로 함께 생성되어 연결됩니다.
- **Products**: 이름·브랜드·레퍼런스·스토어·카테고리로 검색하고, 상태로 필터합니다. 편집·복제·게시·게시 취소·보관을 할 수 있습니다. 삭제 대신 보관(ARCHIVED)을 씁니다.
- **Add Product**: 단계는 스토어 선택 → 기본 정보 → 이미지(종류 지정, 대표 이미지, 끌어서 순서 변경, 교체/삭제) → 시계 사양 12개 항목(모두 선택) → 가격 → 재고 → QC(영상, 사진, 무브먼트 사진, 타임그래퍼, 검수 메모) → 게시 순입니다. 필수 항목은 이름·스토어·카테고리·가격·재고·대표 이미지입니다.
- **Categories**: 기존 카테고리 구조를 그대로 보여 주고 상품 수를 표시합니다.
- **Inventory**: SKU, 재고, 예약 수량, 판매 가능 수량(재고 − 예약), 부족 기준을 관리하고 재고가 부족한 상품을 강조합니다.

## 상태 규칙 (데이터베이스에서 자동 처리)
- 상품 상태는 DRAFT → READY → PUBLISHED로 진행합니다.
- 판매 가능 수량이 0이 되면 PUBLISHED에서 OUT_OF_STOCK으로 바뀌고, 재고를 다시 입력하면 PUBLISHED로 돌아갑니다.
- 고객에게는 PUBLISHED와 OUT_OF_STOCK 상품만 보입니다. OUT_OF_STOCK 상품은 "품절"로 표시되고 구매 버튼이 비활성화됩니다.
- 스토어가 비활성화되거나 초안 상태이면 그 스토어 페이지와 상품이 고객 화면에서 사라집니다.

## 고객 화면 (디자인 유지)
- 홈, 검색, 카테고리, 추천 상품은 데이터베이스 상품을 보여 줍니다. 상품 카드와 화면 배치는 지금과 같습니다.
- 스토어 페이지는 스토어 정보·배송 정보와 그 스토어의 상품만 보여 줍니다.
- 메뉴의 Featured Studios에는 추천으로 지정한 스토어가 나옵니다.
- 검색 대상은 상품명·브랜드·모델·레퍼런스·스토어명·카테고리입니다.

## 이번에 만들지 않는 것
결제, 체크아웃, 에스크로, 주문 처리, 정산, 외부 셀러 가입, 인증 절차, 복잡한 분석, AI 추천, Watch Passport는 이번 단계에 포함하지 않습니다. 기존 결제·주문 화면은 지우지 않고 그대로 둡니다.

## 확인
관리자 계정으로 9개 테스트 시나리오를 직접 실행합니다. 스토어 생성/게시 → 상품 초안 저장 → 수정 → 게시 → 홈/스토어/검색/카테고리 노출 확인 → 재고 0일 때 품절 표시 → 게시 취소 → 스토어 비활성화 순서이며, 화면 캡처로 확인합니다. 상태 규칙은 테스트 코드로도 남깁니다.

## Technical details
- 새 테이블: `sellers`(seller_type, status, account_id, country, contact_*), `stores`(seller_id FK, slug unique, 미디어, specialties/shipping_regions text[], verification_status, featured, status, data_source), `product_images`(post_id, path, kind, sort_order, is_main), `product_qc`(post_id PK, available, video, timegrapher jsonb, notes).
- `posts`에 추가하는 열: store_id FK, brand, model, reference, subcategory, sku, currency 기본값 'USD', stock_qty, reserved_qty, low_stock_threshold, featured, data_source, product_status. 기존 `status`는 published/draft로 계속 동기화해 기존 정책과 피드를 유지합니다.
- 상태와 재고를 맞추는 트리거, `has_role(admin)` 기반 관리자 쓰기 정책, 공개 읽기 정책(활성 스토어와 PUBLISHED/OUT_OF_STOCK 상품만), GRANT를 추가합니다.
- 이미지는 기존 `market-media` 저장소와 서명 URL 방식을 그대로 씁니다. SEED 미디어는 앱에 들어 있는 이미지 경로를 사용합니다.
- 관리자 서버 함수는 `src/lib/admin-catalog.functions.ts`에 두고 `requireSupabaseAuth`와 관리자 역할 확인을 거칩니다. `getPosts`는 스토어 정보를 함께 불러오도록 확장합니다. `seedPosts`는 SEED 데이터를 데이터베이스에 넣는 용도로만 남기고, 화면에서 섞어 쓰지 않습니다.
- 메뉴 이동은 기존 `section` URL 검색 상태를 확장해 처리합니다.
