import express from 'express';
import { optionalAuth, authenticateToken } from '../middleware/auth.js';
import { Group } from '../models/Group.js';
import { GroupInvite } from '../models/GroupInvite.js';

const router = express.Router();

router.get('/:token', optionalAuth, async (req, res) => {
  try {
    const token = req.params.token;
    const row = await GroupInvite.getByToken(token);
    if (!row) return res.status(404).json({ valid: false, reason: 'not_found' });
    const validity = GroupInvite.inviteValidity(row);
    let alreadyMember = false;
    if (req.user) {
      const memberCheck = await Group.getUserGroups(req.user.id);
      alreadyMember = memberCheck.some(g => g.id === row.group_id);
    }
    res.json({
      valid: validity.valid,
      reason: validity.reason,
      alreadyMember,
      group: {
        identifier: row.identifier,
        name: row.name,
        description: row.description,
        memberCount: parseInt(row.member_count || 0),
        maxMembers: row.max_members,
        ownerName: row.owner_name,
        ownerPictureUrl: row.owner_picture_url
      },
      invite: {
        token: row.token,
        expiresAt: row.expires_at,
        maxUses: row.max_uses,
        uses: row.uses,
        remainingUses: row.max_uses != null ? Math.max(row.max_uses - row.uses, 0) : null
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:token/accept', authenticateToken, async (req, res) => {
  try {
    const { token } = req.params;
    const result = await GroupInvite.accept(token, req.user.id);
    res.json({ joined: !result.alreadyMember, alreadyMember: result.alreadyMember, groupIdentifier: result.groupIdentifier });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
