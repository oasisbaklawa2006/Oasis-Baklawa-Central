// src/lib/auth-routing.ts
// OASIS BAKLAWA CENTRAL — Role-Based Routing
// Single source of truth for all role → destination decisions
// Last updated: 14 May 2026

import { supabase } from '@/integrations/supabase/client';

// ─── Role Groups ───────────────────────────────────────────────
// All lowercase — matches the users.role column after normalisation

export const ADMIN_ROLES = [
  'super_admin',
  'admin',
];

export const STAFF_ROLES = [
  'super_admin', 'admin',
  'finance_head', 'finance_exec',
  'operations_manager',
  'production_manager',
  'prod_arabic_sweets', 'prod_fusion', 'prod_chocolate',
  'prod_bakery', 'prod_nuts',
  'hod_assembly',
  'dispatch_head', 'dispatch_manager',
  'store_incharge',
  'sales_executive',
  'support_executive',
  'catalogue_contributor',
  'security_control',
];

export const BUYER_ROLES = [
  'b2b_buyer',
  'customer_user',
  'buyer',
  'client',
  'wholesale_buyer',
  'special_buyer',
];

// ─── Route Destinations ────────────────────────────────────────

export function getRoleDestination(role: string | null | undefined): string {
  const r = (role ?? '').toLowerCase().trim();

  // Super admin & admin → CMD War Room
  if (r === 'super_admin' || r === 'admin') {
    return '/admin/cmd-war-room';
  }

  // Finance
  if (r === 'finance_head' || r === 'finance_exec') {
    return '/admin/finance';
  }

  // Operations
  if (r === 'operations_manager') {
    return '/admin/orders';
  }

  // Production floor staff
  if ([
    'production_manager',
    'prod_arabic_sweets',
    'prod_fusion',
    'prod_chocolate',
    'prod_bakery',
    'prod_nuts',
    'hod_assembly',
  ].includes(r)) {
    return '/admin/production';
  }

  // Dispatch
  if (r === 'dispatch_head' || r === 'dispatch_manager') {
    return '/admin/dispatch';
  }

  // Ready Goods Store
  if (r === 'store_incharge') {
    return '/admin/rgs';
  }

  // Sales
  if (r === 'sales_executive') {
    return '/sales/dashboard';
  }

  // Support
  if (r === 'support_executive') {
    return '/admin/support';
  }

  // Catalogue
  if (r === 'catalogue_contributor') {
    return '/admin/catalogue';
  }

  // Security Gate
  if (r === 'security_control') {
    return '/admin/security-gate';
  }

  // All buyer variants → customer home
  if (BUYER_ROLES.includes(r)) {
    return '/home';
  }

  // Unknown / pending → approval pending
  return '/approval-pending';
}

// ─── Role Checks ───────────────────────────────────────────────

export function isAdminRole(role: string | null | undefined): boolean {
  return ADMIN_ROLES.includes((role ?? '').toLowerCase().trim());
}

export function isStaffRole(role: string | null | undefined): boolean {
  return STAFF_ROLES.includes((role ?? '').toLowerCase().trim());
}

export function isBuyerRole(role: string | null | undefined): boolean {
  return BUYER_ROLES.includes((role ?? '').toLowerCase().trim());
}

// ─── Auth Record Fetcher ───────────────────────────────────────
// Fetches role from users table — maybeSingle() to never crash

export async function fetchAuthRoleRecord(userId: string): Promise<{
  role: string | null;
  company_id: string | null;
  is_active: boolean;
}> {
  if (!userId) {
    return { role: null, company_id: null, is_active: false };
  }

  // Primary: check users table
  const { data: userData } = await supabase
    .from('users')
    .select('role, company_id, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (userData) {
    return {
      role: (userData.role ?? '').toLowerCase().trim() || null,
      company_id: userData.company_id ?? null,
      is_active: userData.is_active ?? true,
    };
  }

  // Fallback: check profiles table
  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, company_id, is_approved')
    .eq('id', userId)
    .maybeSingle();

  if (profileData) {
    return {
      role: (profileData.role ?? '').toLowerCase().trim() || null,
      company_id: profileData.company_id ?? null,
      is_active: profileData.is_approved ?? false,
    };
  }

  return { role: null, company_id: null, is_active: false };
}

// ─── Main: resolve redirect after login ───────────────────────

export async function resolveRedirect(userId: string): Promise<string> {
  if (!userId) return '/login';

  try {
    const { role, is_active } = await fetchAuthRoleRecord(userId);

    // Inactive account
    if (is_active === false) {
      return '/approval-pending';
    }

    // No role yet
    if (!role) {
      return '/approval-pending';
    }

    return getRoleDestination(role);

  } catch {
    // Never crash — safe fallback
    return '/login';
  }
}
