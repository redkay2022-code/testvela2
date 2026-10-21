import { z } from 'zod';

/** One commission rate for every plan. Shown as a fixed string so translators never touch it. */
export const COMMISSION_RATE = '9.8%';

export const PLAN_IDS = ['basic', 'pro', 'enterprise'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Paid plans can be billed monthly, or yearly (12 months at once with a discount). */
export const BILLING_PERIODS = ['monthly', 'yearly'] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

/** `listingLimit` / `storyLimit`: null = unlimited. */
export const PLANS: Record<PlanId, {
  monthlyFee: string; regularFee?: string; listingLimit: number | null; storyLimit: number | null;
}> = {
  basic: { monthlyFee: '$0', listingLimit: 10, storyLimit: 5 },
  pro: { monthlyFee: '$0', regularFee: '$49', listingLimit: 35, storyLimit: 10 },
  enterprise: { monthlyFee: '$199', listingLimit: null, storyLimit: null },
};

/** Product listing limit of a plan (Infinity = unlimited). Ready for the upload screen to enforce later. */
export const listingLimitOf = (plan: string | null | undefined) => {
  const found = PLANS[(plan ?? 'basic') as PlanId] ?? PLANS.basic;
  return found.listingLimit ?? Number.POSITIVE_INFINITY;
};

export const CATEGORY_OPTIONS = [
  ['watches', 'Watches'],
  ['jewelry_accessories', 'Jewelry & Accessories'],
  ['bags_leather', 'Bags & Leather Goods'],
  ['apparel', 'Apparel'],
  ['footwear', 'Footwear'],
  ['others', 'Others'],
] as const;

/** Amounts are USD and fixed; `{0}`/`{1}` are filled in with untranslated numbers. */
export const PRICE_RANGE_OPTIONS = [
  ['under_500', 'Under {0}', '$500', ''],
  ['500_2000', '{0} – {1}', '$500', '$2,000'],
  ['2000_10000', '{0} – {1}', '$2,000', '$10,000'],
  ['above_10000', 'Above {0}', '$10,000', ''],
] as const;

export const CHANNEL_OPTIONS = [
  ['instagram', 'Instagram'],
  ['website', 'Website'],
  ['tiktok', 'TikTok'],
  ['reddit', 'Reddit'],
  ['physical_store', 'Physical Store'],
  ['others', 'Others'],
] as const;

export const ROLE_OPTIONS = [
  ['creator_customizer', 'Creator / Customizer'],
  ['supplier_dealer', 'Supplier / Dealer'],
  ['brand_owner', 'Brand Owner'],
] as const;

const ids = <T extends readonly (readonly [string, ...unknown[]])[]>(list: T) => list.map(o => o[0]) as [T[number][0], ...T[number][0][]];

/** Shared by the form (client) and the server function, so both enforce the same rules. */
export const sellerApplicationSchema = z.object({
  country: z.string().trim().regex(/^[A-Z]{2}$/),
  mainCategories: z.array(z.enum(ids(CATEGORY_OPTIONS))).min(1).max(CATEGORY_OPTIONS.length),
  mainSalesItems: z.string().trim().min(1).max(300),
  avgPriceRange: z.enum(ids(PRICE_RANGE_OPTIONS)),
  salesChannels: z.array(z.enum(ids(CHANNEL_OPTIONS))).min(1).max(CHANNEL_OPTIONS.length),
  businessRole: z.enum(ids(ROLE_OPTIONS)),
  hasCourier: z.boolean(),
  plan: z.enum(PLAN_IDS),
  billingPeriod: z.enum(BILLING_PERIODS).default('monthly'),
});
export type SellerApplicationInput = z.infer<typeof sellerApplicationSchema>;

/** ISO 3166-1 region codes offered in the country dropdown (names come from Intl.DisplayNames). */
export const COUNTRY_CODES = ('AF AL DZ AS AD AO AI AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BA BW BR IO VG BN BG BF BI KH CM CA CV BQ KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI XK KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF KP MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA KR SS ES LK BL SH KN LC MF PM VC SD SR SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UY VI UZ VU VA VE VN WF EH YE ZM ZW').split(' ');

export const flagOf = (code: string) => String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt(0)));

/** Months of the Pro launch offer ($0 for the first month, then the regular price). */
export const PRO_PROMO_MONTHS = 1;
/** Plans a seller can switch to right away; Enterprise needs a review by the team first. */
export const INSTANT_PLANS: readonly PlanId[] = ['basic', 'pro'];

export const YEARLY_DISCOUNT_PERCENT = 10;
export const YEARLY_DISCOUNT_LABEL = `${YEARLY_DISCOUNT_PERCENT}%`;
/** Regular monthly price in USD of the plans that are paid. */
export const REGULAR_MONTHLY_USD: Partial<Record<PlanId, number>> = { pro: 49, enterprise: 199 };

const cents = (n: number) => Math.round(n * 100) / 100;
export const formatUsd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
/** Price of a paid plan: the monthly price, or 12 months minus the yearly discount (with its monthly equivalent). */
export function paidPrice(plan: PlanId, period: BillingPeriod): { monthly: number; total: number; perMonth: number; unit: 'month' | 'year' } | null {
  const monthly = REGULAR_MONTHLY_USD[plan];
  if (!monthly) return null;
  if (period === 'monthly') return { monthly, total: monthly, perMonth: monthly, unit: 'month' };
  const total = cents(monthly * 12 * (100 - YEARLY_DISCOUNT_PERCENT) / 100);
  return { monthly, total, perMonth: cents(total / 12), unit: 'year' };
}

/** Pro seller whose free launch period is over and who has not paid or chosen yet (payment_status is set once a payment was submitted). */
export function promoEnded(app: { plan?: string | null; promo_ends_at?: string | null; payment_status?: string | null } | null | undefined, now = Date.now()) {
  if (!app || app.plan !== 'pro' || !app.promo_ends_at) return false;
  if (app.payment_status === 'pending' || app.payment_status === 'paid') return false;
  const ends = Date.parse(app.promo_ends_at);
  return Number.isFinite(ends) && ends <= now;
}

/** True when the seller has to choose / pay: the free Pro month is over, or an approved Enterprise plan has no payment yet. A pending plan request or a submitted payment waits for the team. */
export function paymentDue(app: { plan?: string | null; promo_ends_at?: string | null; payment_status?: string | null; requested_plan?: string | null } | null | undefined, now = Date.now()) {
  if (!app || app.requested_plan) return false;
  if (app.payment_status === 'pending' || app.payment_status === 'paid') return false;
  return app.plan === 'enterprise' || promoEnded(app, now);
}

/** Plans that need a payment when they start (Pro only after its free month was used). */
export const needsPayment = (plan: PlanId, promoUsed: boolean) => plan === 'enterprise' || (plan === 'pro' && promoUsed);

/** USDT networks of the shared payment window (same ids as the product checkout). */
export const PAYMENT_NETWORKS = ['USDT-TRC20', 'USDT-ERC20', 'USDT-POLYGON', 'USDT-BEP20'] as const;

/** A move to a plan with a lower product limit: which published products have to be deactivated.
 *  ok = nothing to do · need_keep = the seller must choose · invalid = the choice is wrong · drop = ids to deactivate. */
export function planDowngrade(productIds: string[], limit: number, keepIds?: string[]): { kind: 'ok' } | { kind: 'need_keep' } | { kind: 'invalid' } | { kind: 'drop'; drop: string[] } {
  if (!Number.isFinite(limit) || productIds.length <= limit) return { kind: 'ok' };
  if (!keepIds) return { kind: 'need_keep' };
  const own = new Set(productIds), keep = new Set(keepIds);
  if (keep.size > limit || [...keep].some(id => !own.has(id))) return { kind: 'invalid' };
  return { kind: 'drop', drop: productIds.filter(id => !keep.has(id)) };
}

export const planChangeSchema = z.object({
  plan: z.enum(PLAN_IDS),
  billingPeriod: z.enum(BILLING_PERIODS).default('monthly'),
  /** On a downgrade: the products that stay active (the rest are deactivated). */
  keepIds: z.array(z.string().uuid()).max(2000).optional(),
});
/** A plan payment made in the shared USDT payment window: plan, billing period, network and the (optional) transaction id. */
export const planPaymentSchema = z.object({
  plan: z.enum(['pro', 'enterprise']),
  billingPeriod: z.enum(BILLING_PERIODS),
  network: z.enum(PAYMENT_NETWORKS),
  txid: z.string().trim().max(120).regex(/^((0x)?[A-Za-z0-9]{20,100})?$/),
});
