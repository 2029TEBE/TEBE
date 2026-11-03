/**
 * Type-safe models for the existing migration 0016 onboarding tables.
 * Definitions reflect the historical SQL constraints; this file does not
 * generate, apply, or rewrite migrations.
 */
import { pgTable, uuid, text, timestamp, index, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { roleEnum, tenants, users } from './identity';

export const tenantProfiles = pgTable('tenant_profiles', {
  tenantId: uuid('tenant_id').primaryKey().references(() => tenants.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  nameAr: text('name_ar'),
  contactEmail: text('contact_email'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
}, (t) => ({
  displayNameLength: check('tenant_profiles_display_name_check',
    sql`char_length(trim(${t.displayName})) BETWEEN 2 AND 120`),
  nameArLength: check('tenant_profiles_name_ar_check',
    sql`${t.nameAr} IS NULL OR char_length(trim(${t.nameAr})) BETWEEN 2 AND 120`),
  contactEmailLength: check('tenant_profiles_contact_email_check',
    sql`${t.contactEmail} IS NULL OR char_length(${t.contactEmail}) <= 254`),
}));

export const tenantInvitations = pgTable('tenant_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: roleEnum('role').notNull(),
  tokenHash: text('token_hash').notNull(),
  deliveryStatus: text('delivery_status').notNull().default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  invitedBy: uuid('invited_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  acceptedBy: uuid('accepted_by').references(() => users.id),
}, (t) => ({
  tokenHashUnique: uniqueIndex('tenant_invitations_token_hash_key').on(t.tokenHash),
  listIdx: index('tenant_invitations_list_idx').on(t.tenantId, t.createdAt.desc()),
  pendingEmailUnique: uniqueIndex('tenant_invitation_one_pending_email')
    .on(t.tenantId, t.email)
    .where(sql`${t.consumedAt} IS NULL AND ${t.revokedAt} IS NULL AND ${t.deliveryStatus} IN ('pending', 'sent')`),
  emailNormalized: check('tenant_invitations_email_check',
    sql`${t.email} = lower(trim(${t.email})) AND char_length(${t.email}) <= 254`),
  tokenHashFormat: check('tenant_invitations_token_hash_check',
    sql`${t.tokenHash} ~ '^[a-f0-9]{64}$'`),
  deliveryStatusAllowed: check('tenant_invitations_delivery_status_check',
    sql`${t.deliveryStatus} IN ('pending', 'sent', 'failed')`),
  terminalExclusive: check('invitation_terminal_exclusive',
    sql`${t.consumedAt} IS NULL OR ${t.revokedAt} IS NULL`),
  acceptedUserConsistent: check('invitation_acceptance_consistency',
    sql`(${t.consumedAt} IS NULL) = (${t.acceptedBy} IS NULL)`),
}));
