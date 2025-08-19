import express from 'express';
import { Group } from '../models/Group.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Create a new group
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, identifier, description, isPublic = true, maxMembers = 40, avatarUrl } = req.body;
    
    if (!name || !identifier) {
      return res.status(400).json({ error: 'Name and identifier are required' });
    }
    
    if (maxMembers > 40) {
      return res.status(400).json({ error: 'Maximum members cannot exceed 40' });
    }
    
    const group = await Group.create({
      name,
      identifier,
      description,
      isPublic,
      maxMembers,
      avatarUrl
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
    res.json(messages);
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
    res.status(201).json(newMessage);
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
    
    const group = await Group.findByIdentifier(identifier, req.user.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
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
