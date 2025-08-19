import pool from '../config/database.js';
import crypto from 'crypto';

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
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.memberCount = data.memberCount;
    this.userRole = data.userRole; // For current user's role in group
  }

  // Create new group
  static async create(groupData, creatorId) {
    const { name, identifier, description, isPublic, maxMembers, avatarUrl } = groupData;
    
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
      
      // Create group
      const groupQuery = `
        INSERT INTO groups (name, identifier, description, is_public, max_members, avatar_url, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const groupResult = await client.query(groupQuery, [
        name, cleanIdentifier, description, isPublic, maxMembers, avatarUrl, creatorId
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
             ${userId ? 'user_gm.role as user_role' : 'NULL as user_role'}
      FROM groups g
      LEFT JOIN group_memberships gm ON g.id = gm.group_id
      ${userId ? 'LEFT JOIN group_memberships user_gm ON g.id = user_gm.group_id AND user_gm.user_id = $2' : ''}
      WHERE g.identifier = $1
      GROUP BY g.id${userId ? ', user_gm.role' : ''}
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
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      memberCount: parseInt(row.member_count),
      userRole: row.user_role
    });
  }

  // Get user's groups
  static async getUserGroups(userId) {
    const query = `
      SELECT g.*, gm.role as user_role, COUNT(all_gm.id) as member_count
      FROM groups g
      JOIN group_memberships gm ON g.id = gm.group_id
      LEFT JOIN group_memberships all_gm ON g.id = all_gm.group_id
      WHERE gm.user_id = $1
      GROUP BY g.id, gm.role
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
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      memberCount: parseInt(row.member_count),
      userRole: row.user_role
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
    return result.rows.reverse();
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
