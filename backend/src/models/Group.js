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
  duesCollectorUserId: 'dues_collector_user_id',
};

export class Group {
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
    this.duesCollectorUserId = data.duesCollectorUserId ?? null;
    // Denormalised for display so the banner can say "you owe Dana" without a
    // second round-trip to /members.
    this.duesCollectorName = data.duesCollectorName ?? null;
  }

  // Create new group
  static async create(groupData, creatorId) {
    const { name, identifier, description, isPublic, maxMembers, avatarUrl, poolType } = groupData;
    
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
        INSERT INTO groups (name, identifier, description, is_public, max_members, avatar_url, created_by, pool_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'nfl_weekly'))
        RETURNING *
      `;
      const groupResult = await client.query(groupQuery, [
        name, cleanIdentifier, description, isPublic, maxMembers, avatarUrl, creatorId, poolType || null
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
        userRole: 'admin'
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
    const query = `
      SELECT g.*, 
             COUNT(gm.id) as member_count,
        u_owner.name as owner_name,
        u_owner.picture_url as owner_picture_url,
        u_collector.name as dues_collector_name,
             ${userId ? 'user_gm.role as user_role' : 'NULL as user_role'}
      FROM groups g
      LEFT JOIN group_memberships gm ON g.id = gm.group_id
      LEFT JOIN users u_owner ON g.created_by = u_owner.id
      LEFT JOIN users u_collector ON g.dues_collector_user_id = u_collector.id
      ${userId ? 'LEFT JOIN group_memberships user_gm ON g.id = user_gm.group_id AND user_gm.user_id = $2' : ''}
      WHERE g.identifier = $1
      GROUP BY g.id, u_owner.name, u_owner.picture_url, u_collector.name${userId ? ', user_gm.role' : ''}
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
      duesCollectorUserId: row.dues_collector_user_id,
      duesCollectorName: row.dues_collector_name,
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
    
    const allowedFields = [
      'name', 'description', 'is_public', 'max_members', 'avatar_url',
      // Dues settings. Guarded by the admin check above, so turning dues on and
      // naming a collector is admin-only for free.
      'dues_enabled', 'dues_payment_method', 'dues_amount_cents', 'dues_venmo_handle',
      'dues_cashapp_handle', 'dues_instructions', 'dues_collector_user_id',
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
