import express from 'express';
import { Group } from '../models/Group.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { GroupInvite } from '../models/GroupInvite.js';

const router = express.Router();

// Venmo usernames and Cash App cashtags are both [A-Za-z0-9_-] with a length
// cap; users habitually paste them with the leading @ or $, so accept and strip
// it rather than rejecting. Kept deliberately permissive -- we are building a
// URL, not authenticating against either service, and a wrong handle simply
// lands the payer on a "user not found" page.
const HANDLE_RE = /^[A-Za-z0-9_-]{1,50}$/;

// A group collects dues one way. 'other' carries free-text instructions for
// everything neither service covers (Zelle, cash, check).
const DUES_METHODS = ['venmo', 'cashapp', 'other'];

function normalizeHandle(raw) {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim().replace(/^[@$]/, '');
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Validate + normalise the dues fields on a PUT /groups/:identifier body.
 * Mutates `updates` in place (stripping @/$ from handles, coercing blanks to
 * NULL) and returns an error string, or null when the payload is acceptable.
 *
 * Deliberately does NOT require a payment method when dues are enabled: an
 * admin may legitimately turn dues on, then fill in the handle afterwards, and
 * blocking that makes the settings form hostile to fill out top-to-bottom.
 */
function validateDuesUpdates(updates) {
  if (Object.prototype.hasOwnProperty.call(updates, 'duesAmountCents')) {
    const raw = updates.duesAmountCents;
    if (raw === null || raw === '') {
      updates.duesAmountCents = null;
    } else {
      const cents = Number(raw);
      if (!Number.isInteger(cents) || cents <= 0) {
        return 'Dues amount must be a whole number of cents greater than zero';
      }
      // $10,000 ceiling: this is a rec-league pool, and a stray keystroke
      // turning $20 into $200000 should not reach a payment deeplink.
      if (cents > 1000000) {
        return 'Dues amount must be $10,000 or less';
      }
      updates.duesAmountCents = cents;
    }
  }

  for (const field of ['duesVenmoHandle', 'duesCashappHandle']) {
    if (!Object.prototype.hasOwnProperty.call(updates, field)) continue;
    const handle = normalizeHandle(updates[field]);
    if (handle !== null && !HANDLE_RE.test(handle)) {
      const label = field === 'duesVenmoHandle' ? 'Venmo username' : 'Cash App cashtag';
      return `${label} may only contain letters, numbers, hyphens and underscores`;
    }
    updates[field] = handle;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'duesInstructions')) {
    const raw = updates.duesInstructions;
    const text = raw === null || raw === undefined ? null : String(raw).trim();
    if (text && text.length > 1000) {
      return 'Payment instructions must be 1000 characters or less';
    }
    updates.duesInstructions = text && text.length > 0 ? text : null;
  }

  // Payout notes survive a method change: how the pot is split has nothing to
  // do with how it was collected, so this is NOT cleared alongside the
  // method-specific fields below.
  if (Object.prototype.hasOwnProperty.call(updates, 'duesPayoutNotes')) {
    const raw = updates.duesPayoutNotes;
    const text = raw === null || raw === undefined ? null : String(raw).trim();
    if (text && text.length > 1000) {
      return 'Payout notes must be 1000 characters or less';
    }
    updates.duesPayoutNotes = text && text.length > 0 ? text : null;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'duesEnabled')) {
    updates.duesEnabled = Boolean(updates.duesEnabled);
  }

  // A group collects dues exactly one way. When the method is specified, the
  // other two value columns are cleared here rather than merely ignored, so the
  // database never holds a second method that the UI would not show but a later
  // query might pick up.
  if (Object.prototype.hasOwnProperty.call(updates, 'duesPaymentMethod')) {
    const method = updates.duesPaymentMethod || null;
    if (method !== null && !DUES_METHODS.includes(method)) {
      return `Payment method must be one of: ${DUES_METHODS.join(', ')}`;
    }
    updates.duesPaymentMethod = method;

    if (method === 'venmo') {
      updates.duesCashappHandle = null;
      updates.duesInstructions = null;
    } else if (method === 'cashapp') {
      updates.duesVenmoHandle = null;
      updates.duesInstructions = null;
    } else if (method === 'other') {
      updates.duesVenmoHandle = null;
      updates.duesCashappHandle = null;
    } else {
      updates.duesVenmoHandle = null;
      updates.duesCashappHandle = null;
      updates.duesInstructions = null;
    }
  }

  return null;
}

// Create a new group
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, identifier, description, isPublic = true, maxMembers = 40, avatarUrl, poolType } = req.body;

    if (!name || !identifier) {
      return res.status(400).json({ error: 'Name and identifier are required' });
    }

    if (maxMembers > 40) {
      return res.status(400).json({ error: 'Maximum members cannot exceed 40' });
    }

    // poolType is optional. The CHECK constraint on groups.pool_type would
    // reject bad values with a 500, so we surface a 400 first.
    if (poolType && poolType !== 'nfl_weekly' && poolType !== 'world_cup_2026') {
      return res.status(400).json({ error: 'Invalid poolType' });
    }

    const group = await Group.create({
      name,
      identifier,
      description,
      isPublic,
      maxMembers,
      avatarUrl,
      poolType,
    }, req.user.id);
    
    res.status(201).json(group);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'Group identifier already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get user's groups
router.get('/my-groups', authenticateToken, async (req, res) => {
  try {
    const groups = await Group.getUserGroups(req.user.id);
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get group by identifier
router.get('/:identifier', optionalAuth, async (req, res) => {
  try {
    const { identifier } = req.params;
    const userId = req.user?.id; // Optional auth - user might not be logged in
    
    const group = await Group.findByIdentifier(identifier, userId);
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    // If group is private and user is not a member, don't show details
    if (!group.isPublic && !group.userRole) {
      return res.status(403).json({ error: 'This group is private' });
    }
    
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Join a group
router.post('/:identifier/join', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    
    const group = await Group.findByIdentifier(identifier);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    if (!group.isPublic) {
      return res.status(403).json({ error: 'This group requires an invitation' });
    }
    
    if (group.memberCount >= group.maxMembers) {
      return res.status(400).json({ error: 'Group is full' });
    }
    
    const joined = await Group.joinGroup(group.id, req.user.id);
    
    if (!joined) {
      return res.status(400).json({ error: 'Already a member of this group' });
    }
    
    res.json({ message: 'Successfully joined group' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Leave a group
router.post('/:identifier/leave', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    
    const group = await Group.findByIdentifier(identifier, req.user.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    if (!group.userRole) {
      return res.status(400).json({ error: 'Not a member of this group' });
    }
    
    const left = await Group.leaveGroup(group.id, req.user.id);
    
    if (!left) {
      return res.status(400).json({ error: 'Failed to leave group' });
    }
    
    res.json({ message: 'Successfully left group' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create invitation
router.post('/:identifier/invite', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const group = await Group.findByIdentifier(identifier, req.user.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    if (group.userRole !== 'admin') {
      return res.status(403).json({ error: 'Only group admins can send invitations' });
    }
    
    if (group.memberCount >= group.maxMembers) {
      return res.status(400).json({ error: 'Group is full' });
    }
    
    const invitation = await Group.createInvitation(group.id, email, req.user.id);
    
    res.json({
      message: 'Invitation created successfully',
      token: invitation.token,
      expiresAt: invitation.expires_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create shareable link invite (no email)
router.post('/:identifier/invites', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    const { expiresInDays = 14, maxUses = null } = req.body || {};
    const group = await Group.findByIdentifier(identifier, req.user.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.userRole !== 'admin') return res.status(403).json({ error: 'Only group admins can create invites' });
    if (group.memberCount >= group.maxMembers) return res.status(400).json({ error: 'Group is full' });
    const invite = await GroupInvite.createLinkInvite({ groupId: group.id, userId: req.user.id, expiresInDays, maxUses });
    // Determine frontend base: env override > request origin (if trusted) > localhost fallback
    const trustedOrigins = new Set([
      'https://www.confidence-picks.com',
      'https://confidence-picks.com'
    ]);
    let frontendBase = process.env.FRONTEND_BASE_URL;
    if (!frontendBase) {
      const origin = (req.get('origin') || '').replace(/\/$/, '');
      if (trustedOrigins.has(origin)) {
        frontendBase = origin;
      } else {
        frontendBase = 'http://localhost:5173';
      }
    }
    const joinUrl = `${frontendBase}/invite/${invite.token}`;
    res.status(201).json({
      token: invite.token,
      joinUrl,
      expiresAt: invite.expires_at,
      maxUses: invite.max_uses,
      uses: invite.uses
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Accept invitation
router.post('/join/:token', authenticateToken, async (req, res) => {
  try {
    const { token } = req.params;
    
    const result = await Group.acceptInvitation(token, req.user.id);
    
    res.json({
      message: 'Successfully joined group',
      groupId: result.groupId
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get group members
router.get('/:identifier/members', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    
    const group = await Group.findByIdentifier(identifier, req.user.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    if (!group.userRole) {
      return res.status(403).json({ error: 'Must be a group member to view members' });
    }
    
    const members = await Group.getMembers(group.id);
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark a member paid / unpaid (admin only).
// Manual by necessity: neither Venmo nor Cash App exposes a payment-confirmation
// API to third parties, so an admin confirming receipt out of band is the only
// possible source of truth.
router.post('/:identifier/members/:userId/dues', authenticateToken, async (req, res) => {
  try {
    const { identifier, userId } = req.params;
    const { paid } = req.body;

    if (typeof paid !== 'boolean') {
      return res.status(400).json({ error: 'Body must include a boolean "paid" field' });
    }

    const group = await Group.findByIdentifier(identifier, req.user.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const membership = await Group.setDuesPaid(group.id, userId, paid, req.user.id);
    res.json({
      userId: membership.user_id,
      duesPaidAt: membership.dues_paid_at,
    });
  } catch (error) {
    if (error.message.includes('Only group admins')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message.includes('not a member')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get group messages
router.get('/:identifier/messages', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const group = await Group.findByIdentifier(identifier, req.user.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    if (!group.userRole) {
      return res.status(403).json({ error: 'Must be a group member to view messages' });
    }
    
    const messages = await Group.getMessages(group.id, limit, offset);
    // Normalize shape
    const normalized = messages.map(m => ({
      id: m.id,
      content: m.message,
      authorId: m.user_id,
      authorName: m.user_name || m.userName || m.authorName || 'Unknown',
      authorPictureUrl: m.user_picture || m.userPicture || m.authorPictureUrl || null,
      createdAt: m.created_at
    }));
    res.json(normalized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unread chat status for the current user. Returns { hasUnread } so the
// group view can show a red dot on the Chat tab when there are messages the
// caller has not read yet.
router.get('/:identifier/messages/unread', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;

    const group = await Group.findByIdentifier(identifier, req.user.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.userRole) {
      return res.status(403).json({ error: 'Must be a group member to view messages' });
    }

    const hasUnread = await Group.getUnreadStatus(group.id, req.user.id);
    res.json({ hasUnread });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark the group chat as read for the current user. Called when the member opens
// the Chat tab so the unread indicator clears.
router.post('/:identifier/messages/read', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;

    const group = await Group.findByIdentifier(identifier, req.user.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.userRole) {
      return res.status(403).json({ error: 'Must be a group member to mark messages read' });
    }

    const lastReadAt = await Group.markMessagesRead(group.id, req.user.id);
    res.json({ lastReadAt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Post message to group
router.post('/:identifier/messages', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    const group = await Group.findByIdentifier(identifier, req.user.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    if (!group.userRole) {
      return res.status(403).json({ error: 'Must be a group member to post messages' });
    }
    
    const newMessage = await Group.postMessage(group.id, req.user.id, message.trim());
    // Fetch user for picture/name consistency (could be optimized with join in postMessage)
    res.status(201).json({
      id: newMessage.id,
      content: newMessage.message,
      authorId: req.user.id,
      authorName: req.user.name,
      authorPictureUrl: req.user.pictureUrl,
      createdAt: newMessage.created_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update group settings
router.put('/:identifier', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    const updates = { ...req.body };
    // Disallow identifier changes explicitly (immutable slug)
    if (Object.prototype.hasOwnProperty.call(updates, 'identifier')) {
      delete updates.identifier;
    }
    
    const duesError = validateDuesUpdates(updates);
    if (duesError) {
      return res.status(400).json({ error: duesError });
    }

    const group = await Group.findByIdentifier(identifier, req.user.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    if (Object.prototype.hasOwnProperty.call(updates, 'duesCollectorUserId')) {
      const collectorId = updates.duesCollectorUserId;
      if (collectorId === null || collectorId === '') {
        updates.duesCollectorUserId = null;
      } else {
        const members = await Group.getMembers(group.id);
        if (!members.some((m) => String(m.id) === String(collectorId))) {
          return res.status(400).json({ error: 'The dues collector must be a member of this group' });
        }
        updates.duesCollectorUserId = Number(collectorId);
      }
    }

  const updatedGroup = await Group.update(group.id, updates, req.user.id);
    res.json(updatedGroup);
  } catch (error) {
    if (error.message.includes('Only group admins')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete group
router.delete('/:identifier', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    const group = await Group.findByIdentifier(identifier, req.user.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    await Group.delete(group.id, req.user.id);
    res.status(204).send();
  } catch (error) {
    if (error.message.includes('Only group admins')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
