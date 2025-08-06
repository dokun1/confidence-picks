import express from 'express';
import passport from '../config/passport.js';
import { AuthService } from '../services/AuthService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Google OAuth routes
router.get('/google', 
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  async (req, res) => {
    try {
      const { accessToken, refreshToken } = await AuthService.createTokens(req.user);
      
      // Fix: Add the correct GitHub Pages path
      const frontendURL = process.env.NODE_ENV === 'production' 
        ? 'https://dokun1.github.io/confidence-picks'  // Added /confidence-picks
        : 'http://localhost:5173';
      
      res.redirect(`${frontendURL}/auth/callback?token=${accessToken}&refresh=${refreshToken}`);
    } catch (error) {
      const frontendURL = process.env.NODE_ENV === 'production' 
        ? 'https://dokun1.github.io/confidence-picks'  // Added /confidence-picks
        : 'http://localhost:5173';
      res.redirect(`${frontendURL}/auth/error?message=${encodeURIComponent(error.message)}`);
    }
  }
);

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }
    
    const { accessToken } = await AuthService.refreshAccessToken(refreshToken);
    
    res.json({ accessToken });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      await AuthService.logout(refreshToken);
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    pictureUrl: req.user.pictureUrl,
    provider: req.user.provider
  });
});

export default router;