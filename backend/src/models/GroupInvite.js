import pool from '../config/database.js';
import crypto from 'crypto';

export class GroupInvite {
  static generateToken() {
    return crypto.randomBytes(16).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  static async createLinkInvite({ groupId, userId, expiresInDays = 14, maxUses = null }) {
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const query = `
      INSERT INTO group_invitations (group_id, invited_by, invited_email, token, expires_at, invite_type, max_uses)
      VALUES ($1, $2, NULL, $3, $4, 'link', $5)
      RETURNING *
    `;
    const result = await pool.query(query, [groupId, userId, token, expiresAt, maxUses]);
    return result.rows[0];
  }

  static async getByToken(token) {
    const query = `
      SELECT gi.*, g.name, g.identifier, g.description, g.max_members, g.created_by,
             u_owner.name AS owner_name, u_owner.picture_url AS owner_picture_url,
             COUNT(gm.id) as member_count
      FROM group_invitations gi
      JOIN groups g ON gi.group_id = g.id
      LEFT JOIN users u_owner ON g.created_by = u_owner.id
      LEFT JOIN group_memberships gm ON g.id = gm.group_id
      WHERE gi.token = $1
      GROUP BY gi.id, g.id, u_owner.name, u_owner.picture_url
    `;
    const result = await pool.query(query, [token]);
    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  static inviteValidity(inviteRow) {
    if (!inviteRow) return { valid: false, reason: 'not_found' };
    if (inviteRow.revoked_at) return { valid: false, reason: 'revoked' };
    if (new Date(inviteRow.expires_at).getTime() < Date.now()) return { valid: false, reason: 'expired' };
    if (inviteRow.max_uses != null && inviteRow.uses >= inviteRow.max_uses) return { valid: false, reason: 'exhausted' };
    return { valid: true };
  }

  static async accept(token, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Lock the invitation row (and associated group row) to ensure consistent uses increment
      const inviteRes = await client.query(`
        SELECT gi.*, g.max_members, g.identifier
        FROM group_invitations gi
        JOIN groups g ON gi.group_id = g.id
        WHERE gi.token = $1
        FOR UPDATE
      `, [token]);
      if (inviteRes.rows.length === 0) throw new Error('Invalid invitation');
      const invite = inviteRes.rows[0];

      // Get current member count separately (no GROUP BY in locked select)
      const memberCountRes = await client.query('SELECT COUNT(*)::int AS count FROM group_memberships WHERE group_id = $1', [invite.group_id]);
      const currentMembers = memberCountRes.rows[0].count;
      const validity = this.inviteValidity(invite);
      if (!validity.valid) throw new Error(validity.reason);
      if (currentMembers >= invite.max_members) throw new Error('group_full');
      const memberRes = await client.query('SELECT 1 FROM group_memberships WHERE group_id=$1 AND user_id=$2', [invite.group_id, userId]);
      let alreadyMember = memberRes.rows.length > 0;
      if (!alreadyMember) {
        await client.query('INSERT INTO group_memberships (group_id, user_id, role) VALUES ($1,$2,\'member\') ON CONFLICT DO NOTHING', [invite.group_id, userId]);
        alreadyMember = false;
      }
      const usageRes = await client.query('SELECT 1 FROM group_invitation_uses WHERE invitation_id=$1 AND user_id=$2', [invite.id, userId]);
      if (usageRes.rows.length === 0) {
        await client.query('INSERT INTO group_invitation_uses (invitation_id, user_id) VALUES ($1,$2)', [invite.id, userId]);
        if (!alreadyMember) {
          await client.query('UPDATE group_invitations SET uses = uses + 1 WHERE id=$1', [invite.id]);
        }
      }
      await client.query('COMMIT');
      return { groupIdentifier: invite.identifier, alreadyMember };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
