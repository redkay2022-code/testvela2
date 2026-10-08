import { describe, expect, it } from 'vitest';
import { shouldOpenSellerDashboard } from '@/lib/seller-approval';

describe('seller approval dashboard navigation', () => {
  const approved = { roles: ['seller'], application: { status: 'approved' } };
  it('opens the dashboard when a pending member becomes an approved seller', () => {
    expect(shouldOpenSellerDashboard(approved, false, '/me', true)).toBe(true);
  });
  it('does not accept an approval without the trusted seller role', () => {
    expect(shouldOpenSellerDashboard({ ...approved, roles: ['user'] }, false, '/me', true)).toBe(false);
  });
  it('does not move an administrator away from the admin dashboard', () => {
    expect(shouldOpenSellerDashboard({ ...approved, roles: ['admin', 'seller'] }, false, '/admin', false)).toBe(false);
  });
  it('opens the dashboard after returning to the platform following approval', () => {
    expect(shouldOpenSellerDashboard(approved, null, '/', false)).toBe(true);
  });
  it('allows an existing seller to browse without a redirect loop', () => {
    expect(shouldOpenSellerDashboard(approved, true, '/market', false)).toBe(false);
    expect(shouldOpenSellerDashboard(approved, false, '/seller', false)).toBe(false);
  });
  it('keeps pending applications on the current page', () => {
    expect(shouldOpenSellerDashboard({ roles: ['user'], application: { status: 'pending' } }, false, '/me', true)).toBe(false);
  });
});