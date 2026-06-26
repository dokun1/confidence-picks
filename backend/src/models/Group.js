import pool from '../config/database.js';
import crypto from 'crypto';

export class Group {
  // Self-heal latch for the knockout_only column (see ensureKnockoutOnlyColumn).
  // Once the column is confirmed present in this process, every later create()
  // skips even the catalog lookup — so the migration cost is paid at most once per
  // warm lambda and then "goes back to normal" (zero extra queries).
  static _knockoutOnlyColumnEnsured = false;

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
    // World Cup 2026 sub-setting: when true, members may only pick knockout-stage
    // games (no group stage). Defaults to false so NFL pools and ordinary WC pools
    // are unaffected. The WC picks routes read this to reject group-stage picks.
    this.knockoutOnly = data.knockoutOnly ?? false;
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

  // Create new group
  static async create(groupData, creatorId) {
    const { name, identifier, description, isPublic, maxMembers, avatarUrl, poolType, knockoutOnly } = groupData;

    // Self-heal the knockout_only column before the INSERT references it. No-op
    // once the column exists (latched), so this is free on the steady-state path.
    await Group.ensureKnockoutOnlyColumn();
    
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
    const query = `
      SELECT g.*, 
             COUNT(gm.id) as member_count,
        u_owner.name as owner_name,
        u_owner.picture_url as owner_picture_url,
             ${userId ? 'user_gm.role as user_role' : 'NULL as user_role'}
      FROM groups g
      LEFT JOIN group_memberships gm ON g.id = gm.group_id
      LEFT JOIN users u_owner ON g.created_by = u_owner.id
      ${userId ? 'LEFT JOIN group_memberships user_gm ON g.id = user_gm.group_id AND user_gm.user_id = $2' : ''}
      WHERE g.identifier = $1
      GROUP BY g.id, u_owner.name, u_owner.picture_url${userId ? ', user_gm.role' : ''}
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
      knockoutOnly: row.knockout_only,
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
    const query = `
      SELECT u.id, u.name, u.email, u.picture_url, gm.role, gm.joined_at
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

    const allowedFields = ['name', 'description', 'is_public', 'max_members', 'avatar_url'];
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key === 'isPublic' ? 'is_public' : 
                   key === 'maxMembers' ? 'max_members' : 
                   key === 'avatarUrl' ? 'avatar_url' : key;
      
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
