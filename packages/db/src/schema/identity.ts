/**
 * Global identity and tenant membership tables.
 * Values are moved verbatim from the original schema; no SQL migration is needed.
 * Global users and tenants are not guarded by the tenant_id RLS policy; the
 * application's narrow column-level privileges are enforced separately.
 */
import { pgTable, uuid, text, timestamp, integer, boolean, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('member_role', [
  'owner', 'admin', 'pmo_lead', 'project_manager', 'contributor', 'viewer', 'staff_consultant',
  /* The legacy role set, so the vocabulary matches the product customers
     were trained on. Added rather than renamed: a role name is written on
     every membership row. */
  'client_admin', 'portfolio_manager', 'program_manager', 'team_member',
  'executive_viewer', 'governance_risk', 'finance_benefits',
  'external_professional', 'restricted_viewer',
]);

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const tenants = pgTable('tenants', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  createdAt: createdAt(),
}, (t) => ({ slugIdx: uniqueIndex('tenants_slug_key').on(t.slug) }));

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull(),
  /** Optional short login name. People may sign in with either this or email. */
  username: text('username'),
  displayName: text('display_name').notNull(),
  /** Argon2/bcrypt hash. Null means the account cannot sign in with a password. */
  passwordHash: text('password_hash'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  createdAt: createdAt(),
  /* Vendor staff who may change module entitlements. Deliberately on the
     person and not on a membership: operating the platform is not a role
     inside any one customer's workspace. */
  isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
}, (t) => ({
  emailIdx: uniqueIndex('users_email_key').on(t.email),
  usernameIdx: uniqueIndex('users_username_key').on(t.username),
}));

export const memberships = pgTable('memberships', {
  id: id(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: roleEnum('role').notNull().default('viewer'),
  // Per-workspace suspension: users.isActive remains global platform account status.
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
}, (t) => ({
  uniq: uniqueIndex('memberships_tenant_user_key').on(t.tenantId, t.userId),
  tenantIdx: index('memberships_tenant_idx').on(t.tenantId),
}));
