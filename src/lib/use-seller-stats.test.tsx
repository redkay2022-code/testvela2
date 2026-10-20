import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { useSellerStats } from './use-seller-stats';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn(async () => ({ data: [{ seller_key: 'stored-seller', followers: 50, likes: 100, saves: 73 }], error: null })) },
}));

describe('public seller stored totals', () => {
  it('shows stored 50–100 totals unchanged instead of generated display numbers', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useSellerStats(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.get('stored-seller')).toEqual({ followers: 50, likes: 100, saves: 73 });
    expect(result.current.data?.get('unknown-seller')).toBeUndefined();
    client.clear();
  });
});