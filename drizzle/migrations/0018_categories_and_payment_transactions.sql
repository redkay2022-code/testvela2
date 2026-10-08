CREATE TABLE public.categories (
  id text PRIMARY KEY,
  parent_id text REFERENCES public.categories(id),
  collection text NOT NULL DEFAULT 'watches',
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are public" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL,
  network text NOT NULL,
  txid text NOT NULL,
  amount_usd numeric NOT NULL,
  escrow_status text NOT NULL DEFAULT 'PENDING' CHECK (escrow_status IN ('PENDING','HELD','RELEASED','REFUNDED','REJECTED')),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (network, txid)
);
GRANT SELECT, INSERT, UPDATE ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order parties read transactions" ON public.payment_transactions FOR SELECT TO authenticated USING (public.is_order_party(order_id, auth.uid()));
CREATE POLICY "Buyer submits own transaction" ON public.payment_transactions FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND escrow_status = 'PENDING' AND verified_at IS NULL
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.buyer_id = auth.uid()));
CREATE POLICY "Admins update transactions" ON public.payment_transactions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));