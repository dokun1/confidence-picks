import pool from '../config/database.js';
import crypto from 'crypto';

// camelCase payload key -> groups column. Replaces the ternary chain that grew
// unreadable once dues added six more fields. Keys absent here pass through
// unchanged (they are already snake_case) and are still gated by allowedFields.
const CAMEL_TO_COLUMN = {
  isPublic: 'is_public',
  maxMembers: 'max_members',
  avatarUrl: 'avatar_url',
  duesEnabled: 'dues_enabled',
  duesPaymentMethod: 'dues_payment_method',
  duesAmountCents: 'dues_amount_cents',
  duesVenmoHandle: 'dues_venmo_handle',
  duesCashappHandle: 'dues_cashapp_handle',
  duesInstructions: 'dues_instructions',
  duesPayoutNotes: 'dues_payout_notes',
  duesCollectorUserId: 'dues_collector_user_id',
};

export class Group {
  // Self-heal latch for the knockout_only column (see ensureKnockoutOnlyColumn).
  // Once the column is confirmed present in this process, every later create()
  // skips even the catalog lookup — so the migration cost is paid at most once per
  // warm lambda and then "goes back to normal" (zero extra queries).
  static _knockoutOnlyColumnEnsured = false;

  // Self-heal latch for the max_members CHECK constraint (see
  // ensureMaxMembersConstraint). Same warm-instance fast path as above.
  static _maxMembersConstraintEnsured = false;

  // Self-heal latch for the opt-in email preference columns (see
  // ensureEmailPrefsSchema). Same warm-instance fast path as above.
  static _emailPrefsSchemaEnsured = false;

  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.identifier = data.identifier;
    this.description = data.description;
    this.isPublic = data.isPublic;
    this.maxMembers = data.maxMembers;
    this.avatarUrl = data.avatarUrl;
    this.createdBy = data.createdBy;
  this.createdByName = data.createdByName; // owner display name
  this.createdByPictureUrl = data.createdByPictureUrl; // owner avatar
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.memberCount = data.memberCount;
    this.userRole = data.userRole; // For current user's role in group
    // 'nfl_weekly' (default) or 'world_cup_2026'. Carried through so the
    // frontend's GroupDetailsPage can branch on group.poolType — without it
    // every WC group rendered the NFL PicksTab.
    this.poolType = data.poolType;
    // Dues. `duesEnabled` gates every other field; when false the frontend
    // renders no banner and no settings block. Amount is integer cents (USD).
    // The three payment affordances (venmo / cashapp / free-text instructions)
    // are independent and any combination may be set.
    this.duesEnabled = data.duesEnabled ?? false;
    // Exactly one of 'venmo' | 'cashapp' | 'other' (or null when unset). The
    // three value fields below are storage; this says which one is live.
    this.duesPaymentMethod = data.duesPaymentMethod ?? null;
    this.duesAmountCents = data.duesAmountCents ?? null;
    this.duesVenmoHandle = data.duesVenmoHandle ?? null;
    this.duesCashappHandle = data.duesCashappHandle ?? null;
    this.duesInstructions = data.duesInstructions ?? null;
    // How the pot is disbursed (winner-takes-all, second place refunded, ...).
    // Independent of duesPaymentMethod: that is money in, this is money out.
    this.duesPayoutNotes = data.duesPayoutNotes ?? null;
    this.duesCollectorUserId = data.duesCollectorUserId ?? null;
    // Denormalised for display so the banner can say "you owe Dana" without a
    // second round-trip to /members.
    this.duesCollectorName = data.duesCollectorName ?? null;
    // World Cup 2026 sub-setting: when true, members may only pick knockout-stage
    // games (no group stage). Defaults to false so NFL pools and ordinary WC pools
    // are unaffected. The WC picks routes read this to reject group-stage picks.
    this.knockoutOnly = data.knockoutOnly ?? false;
    // The viewing member's own opt-ins. Default false so a non-member, or a row
    // predating the columns, reads as "not subscribed" rather than undefined.
    this.emailReminders = data.emailReminders ?? false;
    this.emailSummaries = data.emailSummaries ?? false;
  }

  // Ensure the groups.knockout_only column exists. Production resilience: prod
  // runs with INIT_DB unset, so schema.sql is NOT synced on deploy — mirror the
  // ensureChatReadsSchema / GroupInvite.ensureLinkInviteSchema self-heal so the
  // column lands automatically on the first group creation after a deploy, with no
  // manual migration or INIT_DB toggle. This matters specifically for create():
  // its INSERT names knockout_only, so a missing column would 500 EVERY new group
  // (NFL included). Reads already tolerate a missing column (SELECT g.* yields
  // undefined -> false), so only this write path needs the gate. Idempotent: a
  // single indexed catalog lookup that early-returns once latched, and the ALTER
  // itself is ADD COLUMN IF NOT EXISTS (safe under concurrent cold starts).
  static async ensureKnockoutOnlyColumn() {
    if (this._knockoutOnlyColumnEnsured) return; // warm-instance fast path: no query
    try {
      const check = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'knockout_only'`
      );
      if (check.rows.length === 0) {
        console.log('[groups] Missing knockout_only column – adding');
        await pool.query(
          `ALTER TABLE groups ADD COLUMN IF NOT EXISTS knockout_only BOOLEAN NOT NULL DEFAULT false`
        );
        console.log('[groups] knockout_only column added');
      }
      // Latch only after a confirmed present/added column, so the next create
      // settles into the zero-query fast path.
      this._knockoutOnlyColumnEnsured = true;
    } catch (e) {
      // Do NOT latch on failure — a transient error must let the next create retry
      // rather than permanently believing the column is present.
      console.warn('[groups] Failed to ensure knockout_only column (may already exist):', e.message);
    }
  }

  // Ensure every dues column exists. Production resilience: prod runs with
  // INIT_DB unset, so schema.sql is NOT synced on deploy -- mirror the
  // ensureKnockoutOnlyColumn / ensureMaxMembersConstraint self-heal.
  //
  // This one gates READS, not just writes, which the others do not. The dues
  // queries name their columns explicitly -- findByIdentifier joins on
  // g.dues_collector_user_id, getMembers selects gm.dues_paid_at, and the invite
  // preview selects g.dues_enabled -- and Postgres errors on a missing column in
  // a JOIN or select list rather than yielding undefined. Without this,
  // findByIdentifier alone would 500 EVERY group route on the first deploy.
  //
  // Idempotent and concurrency-safe: ADD COLUMN IF NOT EXISTS throughout, one
  // indexed catalog lookup that early-returns once latched.
  static async ensureDuesSchema() {
    if (this._duesSchemaEnsured) return; // warm-instance fast path: no query
    try {
      const check = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'dues_enabled'`
      );
      if (check.rows.length === 0) {
        console.log('[groups] Missing dues columns – adding');
        await pool.query(`
          ALTER TABLE groups
            ADD COLUMN IF NOT EXISTS dues_enabled BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS dues_payment_method VARCHAR(20) NULL,
            ADD COLUMN IF NOT EXISTS dues_amount_cents INTEGER NULL,
            ADD COLUMN IF NOT EXISTS dues_venmo_handle VARCHAR(64) NULL,
            ADD COLUMN IF NOT EXISTS dues_cashapp_handle VARCHAR(64) NULL,
            ADD COLUMN IF NOT EXISTS dues_instructions TEXT NULL,
            ADD COLUMN IF NOT EXISTS dues_payout_notes TEXT NULL,
            ADD COLUMN IF NOT EXISTS dues_collector_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL
        `);
        await pool.query(`
          ALTER TABLE group_memberships
            ADD COLUMN IF NOT EXISTS dues_paid_at TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS dues_marked_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL
        `);
        console.log('[groups] dues columns added');
      }
      // Latch only after a confirmed present/added column, so the next call
      // settles into the zero-query fast path.
      this._duesSchemaEnsured = true;
    } catch (e) {
      // Do NOT latch on failure — a transient error must let the next call retry
      // rather than permanently believing the columns are present.
      console.warn('[groups] Failed to ensure dues columns (may already exist):', e.message);
    }
  }

  // Self-heal the opt-in email preference columns. Prod runs with INIT_DB unset,
  // so schema.sql is NOT synced on deploy -- mirror ensureDuesSchema.
  //
  // Like the dues columns, these gate READS as well as writes: findByIdentifier
  // names user_gm.email_reminders in its select list, and Postgres errors on a
  // missing column rather than yielding undefined. Without this, the first
  // deploy would 500 every group route.
  static async ensureEmailPrefsSchema() {
    if (this._emailPrefsSchemaEnsured) return; // warm-instance fast path: no query
    try {
      const check = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'group_memberships' AND column_name = 'email_reminders'`
      );
      if (check.rows.length === 0) {
        console.log('[groups] Missing email preference columns – adding');
        await pool.query(`
          ALTER TABLE group_memberships
            ADD COLUMN IF NOT EXISTS email_reminders BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS email_summaries BOOLEAN NOT NULL DEFAULT false
        `);
        await pool.query(`
          ALTER TABLE users
            ADD COLUMN IF NOT EXISTS email_paused_at TIMESTAMP NULL
        `);
        console.log('[groups] email preference columns added');
      }
      // Latch only after a confirmed present/added column, so the next call
      // settles into the zero-query fast path.
      this._emailPrefsSchemaEnsured = true;
    } catch (e) {
      // Do NOT latch on failure — a transient error must let the next call retry
      // rather than permanently believing the columns are present.
      console.warn('[groups] Failed to ensure email preference columns (may already exist):', e.message);
    }
  }

  /**
   * Set the CALLING member's own email preferences.
   *
   * Member-scoped, not admin-gated: every member owns their own inbox, so there
   * is deliberately no role check here and no path for an admin to subscribe
   * someone else. Omitted fields are left alone; `false` is a real value.
   */
  static async setEmailPrefs(groupId, userId, prefs) {
    const sets = [];
    const values = [];
    if (typeof prefs.emailReminders === 'boolean') {
      values.push(prefs.emailReminders);
      sets.push(`email_reminders = $${values.length}`);
    }
    if (typeof prefs.emailSummaries === 'boolean') {
      values.push(prefs.emailSummaries);
      sets.push(`email_summaries = $${values.length}`);
    }
    if (sets.length === 0) throw new Error('No valid fields to update');

    await Group.ensureEmailPrefsSchema();

    values.push(groupId, userId);
    const { rows } = await pool.query(
      `UPDATE group_memberships SET ${sets.join(', ')}
       WHERE group_id = $${values.length - 1} AND user_id = $${values.length}
       RETURNING email_reminders, email_summaries`,
      values
    );
    if (rows.length === 0) throw new Error('User is not a member of this group');
    return {
      emailReminders: rows[0].email_reminders,
      emailSummaries: rows[0].email_summaries,
    };
  }

  // Ensure the groups.max_members CHECK allows up to 500. Production resilience:
  // prod runs with INIT_DB unset, so schema.sql is NOT synced on deploy, and the
  // legacy inline constraint (groups_max_members_check) still caps at 40. Because
  // create() now defaults max_members to 50, a missing migration would 500 EVERY
  // new group. Mirror the ensureKnockoutOnlyColumn self-heal: swap the legacy
  // <=40 constraint for the named groups_max_members_range (<=500) on the first
  // create/update after a deploy, then latch. Concurrency-safe: DROP ... IF EXISTS
  // is idempotent, and a duplicate ADD from a racing cold start throws into the
  // catch (which does NOT latch, so the next call settles to a no-op).
  static async ensureMaxMembersConstraint() {
    if (this._maxMembersConstraintEnsured) return; // warm-instance fast path
    try {
      const { rows } = await pool.query(
        `SELECT conname FROM pg_constraint WHERE conname IN ('groups_max_members_check', 'groups_max_members_range')`
      );
      const names = rows.map((r) => r.conname);
      const hasNew = names.includes('groups_max_members_range');
      const hasLegacy = names.includes('groups_max_members_check');
      if (hasLegacy || !hasNew) {
        console.log('[groups] Migrating max_members constraint to allow up to 500');
        await pool.query(`ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_max_members_check`);
        if (!hasNew) {
          await pool.query(
            `ALTER TABLE groups ADD CONSTRAINT groups_max_members_range CHECK (max_members <= 500 AND max_members >= 2)`
          );
        }
        console.log('[groups] max_members constraint now allows up to 500');
      }
      // Align the column default with the app default (50). Idempotent metadata-only
      // change; only matters for inserts that omit max_members (the API always sends it).
      await pool.query(`ALTER TABLE groups ALTER COLUMN max_members SET DEFAULT 50`);
      this._maxMembersConstraintEnsured = true;
    } catch (e) {
      // Do NOT latch on failure — let the next create/update retry.
      console.warn('[groups] Failed to ensure max_members constraint (may already be applied):', e.message);
    }
  }

  // Create new group
  static async create(groupData, creatorId) {
    const { name, identifier, description, isPublic, maxMembers, avatarUrl, poolType, knockoutOnly } = groupData;

    // Self-heal schema before the INSERT: the knockout_only column must exist, and
    // the max_members constraint must allow the new default (50 > the legacy 40
    // cap). Both no-op once latched, so this is free on the steady-state path.
    await Group.ensureKnockoutOnlyColumn();
    await Group.ensureMaxMembersConstraint();
    
    // Ensure identifier is unique and URL-friendly
    // Clean identifier: lowercase, replace invalid chars with dash, collapse dashes, trim dashes
    const cleanIdentifier = identifier
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')      // Replace invalid chars with dash
      .replace(/-+/g, '-')              // Collapse consecutive dashes
      .replace(/^-+|-+$/g, '');         // Trim leading/trailing dashes
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Create group. pool_type defaults to 'nfl_weekly' at the schema level
      // (see addWorldCupColumns.js migration), so omitting it preserves the
      // pre-WC behavior for NFL callers. Pass through when set.
      const groupQuery = `
        INSERT INTO groups (name, identifier, description, is_public, max_members, avatar_url, created_by, pool_type, knockout_only)
        VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'nfl_weekly'), COALESCE($9, false))
        RETURNING *
      `;
      const groupResult = await client.query(groupQuery, [
        name, cleanIdentifier, description, isPublic, maxMembers, avatarUrl, creatorId, poolType || null, knockoutOnly ?? null
      ]);
      
      const group = groupResult.rows[0];
      
      // Add creator as admin member
      const memberQuery = `
        INSERT INTO group_memberships (group_id, user_id, role)
        VALUES ($1, $2, 'admin')
      `;
      await client.query(memberQuery, [group.id, creatorId]);
      
      await client.query('COMMIT');
      
      return new Group({
        id: group.id,
        name: group.name,
        identifier: group.identifier,
        description: group.description,
        isPublic: group.is_public,
        maxMembers: group.max_members,
        avatarUrl: group.avatar_url,
        createdBy: group.created_by,
        createdAt: group.created_at,
        updatedAt: group.updated_at,
        memberCount: 1,
        userRole: 'admin',
        poolType: group.pool_type,
        knockoutOnly: group.knockout_only,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Find group by identifier
  static async findByIdentifier(identifier, userId = null) {
    // The query below joins on g.dues_collector_user_id and selects
    // user_gm.email_reminders; a missing column is a hard SQL error, not a soft
    // undefined. Both no-op once latched.
    await Group.ensureDuesSchema();
    await Group.ensureEmailPrefsSchema();
    const query = `
      SELECT g.*, 
             COUNT(gm.id) as member_count,
        u_owner.name as owner_name,
        u_owner.picture_url as owner_picture_url,
        u_collector.name as dues_collector_name,
             ${userId ? 'user_gm.role as user_role' : 'NULL as user_role'},
             ${userId ? 'user_gm.email_reminders as user_email_reminders' : 'false as user_email_reminders'},
             ${userId ? 'user_gm.email_summaries as user_email_summaries' : 'false as user_email_summaries'}
      FROM groups g
      LEFT JOIN group_memberships gm ON g.id = gm.group_id
      LEFT JOIN users u_owner ON g.created_by = u_owner.id
      LEFT JOIN users u_collector ON g.dues_collector_user_id = u_collector.id
      ${userId ? 'LEFT JOIN group_memberships user_gm ON g.id = user_gm.group_id AND user_gm.user_id = $2' : ''}
      WHERE g.identifier = $1
      GROUP BY g.id, u_owner.name, u_owner.picture_url, u_collector.name${userId ? ', user_gm.role, user_gm.email_reminders, user_gm.email_summaries' : ''}
    `;
    
    const values = userId ? [identifier, userId] : [identifier];
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return new Group({
      id: row.id,
      name: row.name,
      identifier: row.identifier,
      description: row.description,
      isPublic: row.is_public,
      maxMembers: row.max_members,
      avatarUrl: row.avatar_url,
      createdBy: row.created_by,
  createdByName: row.owner_name,
  createdByPictureUrl: row.owner_picture_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      memberCount: parseInt(row.member_count),
      userRole: row.user_role,
      poolType: row.pool_type,
      duesEnabled: row.dues_enabled,
      duesPaymentMethod: row.dues_payment_method,
      duesAmountCents: row.dues_amount_cents,
      duesVenmoHandle: row.dues_venmo_handle,
      duesCashappHandle: row.dues_cashapp_handle,
      duesInstructions: row.dues_instructions,
      duesPayoutNotes: row.dues_payout_notes,
      duesCollectorUserId: row.dues_collector_user_id,
      duesCollectorName: row.dues_collector_name,
      knockoutOnly: row.knockout_only,
      // The CALLER's own preferences, from the membership join already used for
      // user_role — so the settings tab reads them off the group it already has.
      emailReminders: row.user_email_reminders,
      emailSummaries: row.user_email_summaries,
    });
  }

  // Get user's groups
  static async getUserGroups(userId) {
    const query = `
      SELECT g.*, gm.role as user_role, COUNT(all_gm.id) as member_count,
        u_owner.name as owner_name,
        u_owner.picture_url as owner_picture_url
      FROM groups g
      JOIN group_memberships gm ON g.id = gm.group_id
      LEFT JOIN group_memberships all_gm ON g.id = all_gm.group_id
      LEFT JOIN users u_owner ON g.created_by = u_owner.id
      WHERE gm.user_id = $1
      GROUP BY g.id, gm.role, u_owner.name, u_owner.picture_url
      ORDER BY g.name
    `;
    
    const result = await pool.query(query, [userId]);
    
    return result.rows.map(row => new Group({
      id: row.id,
      name: row.name,
      identifier: row.identifier,
      description: row.description,
      isPublic: row.is_public,
      maxMembers: row.max_members,
      avatarUrl: row.avatar_url,
      createdBy: row.created_by,
  createdByName: row.owner_name,
  createdByPictureUrl: row.owner_picture_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      memberCount: parseInt(row.member_count),
      userRole: row.user_role,
      poolType: row.pool_type,
      knockoutOnly: row.knockout_only,
    }));
  }

  // Join group
  static async joinGroup(groupId, userId) {
    const query = `
      INSERT INTO group_memberships (group_id, user_id, role)
      VALUES ($1, $2, 'member')
      ON CONFLICT (group_id, user_id) DO NOTHING
      RETURNING *
    `;
    
    const result = await pool.query(query, [groupId, userId]);
    return result.rows.length > 0;
  }

  // Leave group (and delete user's picks for that group)
  static async leaveGroup(groupId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Delete user's picks for this group
      await client.query('DELETE FROM user_picks WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
      
      // Remove membership
      const result = await client.query(
        'DELETE FROM group_memberships WHERE group_id = $1 AND user_id = $2 RETURNING *',
        [groupId, userId]
      );
      
      await client.query('COMMIT');
      return result.rows.length > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Generate invitation token
  static async createInvitation(groupId, invitedEmail, invitedBy) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    const query = `
      INSERT INTO group_invitations (group_id, invited_by, invited_email, token, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (group_id, invited_email)
      DO UPDATE SET token = $4, expires_at = $5, created_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const result = await pool.query(query, [groupId, invitedBy, invitedEmail, token, expiresAt]);
    return result.rows[0];
  }

  // Accept invitation
  static async acceptInvitation(token, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Get invitation details
      const inviteQuery = `
        SELECT gi.*, g.max_members, COUNT(gm.id) as current_members
        FROM group_invitations gi
        JOIN groups g ON gi.group_id = g.id
        LEFT JOIN group_memberships gm ON g.id = gm.group_id
        WHERE gi.token = $1 AND gi.expires_at > CURRENT_TIMESTAMP AND gi.accepted_at IS NULL
        GROUP BY gi.id, g.max_members
      `;
      
      const inviteResult = await client.query(inviteQuery, [token]);
      
      if (inviteResult.rows.length === 0) {
        throw new Error('Invalid or expired invitation');
      }
      
      const invitation = inviteResult.rows[0];
      
      // Check if group is full
      if (invitation.current_members >= invitation.max_members) {
        throw new Error('Group is full');
      }
      
      // Add user to group
      await client.query(
        'INSERT INTO group_memberships (group_id, user_id, role) VALUES ($1, $2, \'member\') ON CONFLICT DO NOTHING',
        [invitation.group_id, userId]
      );
      
      // Mark invitation as accepted
      await client.query(
        'UPDATE group_invitations SET accepted_at = CURRENT_TIMESTAMP WHERE id = $1',
        [invitation.id]
      );
      
      await client.query('COMMIT');
      
      return { groupId: invitation.group_id, success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get group members
  static async getMembers(groupId) {
    // Selects gm.dues_paid_at explicitly. No-op once latched.
    await Group.ensureDuesSchema();
    const query = `
      SELECT u.id, u.name, u.email, u.picture_url, gm.role, gm.joined_at,
             gm.dues_paid_at
      FROM users u
      JOIN group_memberships gm ON u.id = gm.user_id
      WHERE gm.group_id = $1
      ORDER BY gm.role DESC, gm.joined_at ASC
    `;
    
    const result = await pool.query(query, [groupId]);
    return result.rows;
  }

  // Get group messages
  static async getMessages(groupId, limit = 50, offset = 0) {
    const query = `
      SELECT gm.id, gm.user_id, gm.message, gm.created_at, u.name as user_name, u.picture_url as user_picture
      FROM group_messages gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = $1
      ORDER BY gm.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [groupId, limit, offset]);
    return result.rows;
  }

  // Post message to group
  static async postMessage(groupId, userId, message) {
    const query = `
      INSERT INTO group_messages (group_id, user_id, message)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await pool.query(query, [groupId, userId, message]);
    return result.rows[0];
  }

  // Ensure the chat read-marker table exists. Production resilience: prod runs
  // with INIT_DB unset, so schema.sql is NOT synced on deploy — mirror the
  // GroupInvite.ensureLinkInviteSchema self-heal so this feature works on a plain
  // deploy with no manual migration step. Cheap: a single catalog lookup that
  // early-returns once the table is present.
  static async ensureChatReadsSchema() {
    try {
      const check = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = 'group_message_reads'`
      );
      if (check.rows.length > 0) return; // already present
      console.log('[chat] Missing group_message_reads table – creating');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS group_message_reads (
          id SERIAL PRIMARY KEY,
          group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          last_read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(group_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_group_message_reads_group_user ON group_message_reads(group_id, user_id);
      `);
      console.log('[chat] group_message_reads table created');
    } catch (e) {
      console.warn('[chat] Failed to ensure chat reads schema (may already exist):', e.message);
    }
  }

  // Whether the given user has unread chat messages in the group. A message is
  // unread when it was authored by someone else and is newer than the user's last
  // read marker. With no marker row (the default for everyone), every message from
  // another member reads as unread — the intended "nobody has read chat yet" state.
  static async getUnreadStatus(groupId, userId) {
    await this.ensureChatReadsSchema();
    const query = `
      SELECT EXISTS (
        SELECT 1
        FROM group_messages gm
        LEFT JOIN group_message_reads r
          ON r.group_id = gm.group_id AND r.user_id = $2
        WHERE gm.group_id = $1
          AND gm.user_id <> $2
          AND (r.last_read_at IS NULL OR gm.created_at > r.last_read_at)
      ) AS has_unread
    `;
    const result = await pool.query(query, [groupId, userId]);
    return result.rows[0].has_unread;
  }

  // Mark the group chat as read for the user (upsert the last_read_at marker to
  // now). Called when a member opens the chat tab so the unread indicator clears.
  static async markMessagesRead(groupId, userId) {
    await this.ensureChatReadsSchema();
    const query = `
      INSERT INTO group_message_reads (group_id, user_id, last_read_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (group_id, user_id)
      DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
      RETURNING last_read_at
    `;
    const result = await pool.query(query, [groupId, userId]);
    return result.rows[0].last_read_at;
  }

  // Update group
  static async update(groupId, updates, userId) {
    // Check if user is admin
    const roleCheck = await pool.query(
      'SELECT role FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    
    if (roleCheck.rows.length === 0 || roleCheck.rows[0].role !== 'admin') {
      throw new Error('Only group admins can update group settings');
    }

    // Self-heal the dues columns: update() writes them by name. No-op once latched.
    await Group.ensureDuesSchema();

    // Self-heal the max_members constraint so an admin raising the limit past the
    // legacy 40 cap isn't rejected by a stale CHECK. No-op once latched.
    await Group.ensureMaxMembersConstraint();

    // Member-limit changes are bounded to [2, 500] and may not be lowered below the
    // group's CURRENT member count — an admin must have members leave first. A group
    // can be expanded freely up to the cap.
    if (Object.prototype.hasOwnProperty.call(updates, 'maxMembers')) {
      const newMax = updates.maxMembers;
      if (!Number.isInteger(newMax) || newMax < 2 || newMax > 500) {
        throw new Error('Member limit must be a whole number between 2 and 500');
      }
      const { rows } = await pool.query(
        'SELECT COUNT(*)::int AS count FROM group_memberships WHERE group_id = $1',
        [groupId]
      );
      const currentCount = rows[0].count;
      if (newMax < currentCount) {
        throw new Error(
          `Member limit (${newMax}) is below the current member count (${currentCount}). ` +
          `Members must leave the group before you can lower the limit this far.`
        );
      }
    }

    const allowedFields = [
      'name', 'description', 'is_public', 'max_members', 'avatar_url',
      // Dues settings. Guarded by the admin check above, so turning dues on and
      // naming a collector is admin-only for free.
      'dues_enabled', 'dues_payment_method', 'dues_amount_cents', 'dues_venmo_handle',
      'dues_cashapp_handle', 'dues_instructions', 'dues_payout_notes',
      'dues_collector_user_id',
    ];
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      const dbKey = CAMEL_TO_COLUMN[key] ?? key;
      
      if (allowedFields.includes(dbKey)) {
        updateFields.push(`${dbKey} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }
    
    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(groupId);
    
    const query = `
      UPDATE groups 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Mark a member paid or unpaid. Admin-only by design: no payment processor is
   * involved, so an admin confirming receipt out of band IS the ledger. Returns
   * the updated membership row.
   *
   * `paid=false` clears both columns so an unpaid row is indistinguishable from
   * one that was never marked -- keeps "unpaid" a single representable state.
   */
  static async setDuesPaid(groupId, targetUserId, paid, actingUserId) {
    await Group.ensureDuesSchema();
    const roleCheck = await pool.query(
      'SELECT role FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, actingUserId]
    );

    if (roleCheck.rows.length === 0 || roleCheck.rows[0].role !== 'admin') {
      throw new Error('Only group admins can update dues status');
    }

    const result = await pool.query(
      `UPDATE group_memberships
       SET dues_paid_at = $1, dues_marked_by = $2
       WHERE group_id = $3 AND user_id = $4
       RETURNING user_id, dues_paid_at, dues_marked_by`,
      [paid ? new Date() : null, paid ? actingUserId : null, groupId, targetUserId]
    );

    if (result.rows.length === 0) {
      throw new Error('That user is not a member of this group');
    }

    return result.rows[0];
  }

  // Delete group (admin only). Cascades: memberships, messages, picks assumed by FK constraints or manual cleanup here.
  static async delete(groupId, userId) {
    // Verify admin
    const roleCheck = await pool.query(
      'SELECT role FROM group_memberships WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    if (roleCheck.rows.length === 0 || roleCheck.rows[0].role !== 'admin') {
      throw new Error('Only group admins can delete the group');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM group_messages WHERE group_id = $1', [groupId]);
      await client.query('DELETE FROM user_picks WHERE group_id = $1', [groupId]);
      await client.query('DELETE FROM group_memberships WHERE group_id = $1', [groupId]);
      const res = await client.query('DELETE FROM groups WHERE id = $1 RETURNING id', [groupId]);
      await client.query('COMMIT');
      return res.rows.length > 0;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
