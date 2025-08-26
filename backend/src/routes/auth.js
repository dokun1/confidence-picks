import express from 'express';
import passport, { isAppleConfigured } from '../config/passport.js';
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
        ? 'https://www.confidence-picks.com'
        : 'http://localhost:5173';
      
      res.redirect(`${frontendURL}/auth/callback?token=${accessToken}&refresh=${refreshToken}`);
    } catch (error) {
      const frontendURL = process.env.NODE_ENV === 'production' 
        ? 'https://www.confidence-picks.com'
        : 'http://localhost:5173';
      res.redirect(`${frontendURL}/auth/error?message=${encodeURIComponent(error.message)}`);
    }
  }
);

// Apple OAuth routes
router.get('/apple', (req, res, next) => {
  if (!isAppleConfigured()) {
    const frontendURL = process.env.NODE_ENV === 'production' 
      ? 'https://www.confidence-picks.com'
      : 'http://localhost:5173';
    return res.redirect(`${frontendURL}/login?error=apple_not_configured`);
  }
  passport.authenticate('apple', { scope: ['email', 'name'] })(req, res, next);
});

router.post('/apple/callback', (req, res, next) => {
  console.log('🍎 Apple callback route hit - body:', JSON.stringify(req.body, null, 2));
  console.log('🍎 Apple callback route hit - headers:', JSON.stringify(req.headers, null, 2));
  
  const appleConfigured = isAppleConfigured();
  console.log('🍎 Apple configured status:', appleConfigured);
  
  if (!appleConfigured) {
    console.log('❌ Apple not configured');
    const frontendURL = process.env.NODE_ENV === 'production' 
      ? 'https://www.confidence-picks.com'
      : 'http://localhost:5173';
    return res.redirect(`${frontendURL}/login?error=apple_not_configured`);
  }
  
  console.log('🍎 About to call passport.authenticate');
  passport.authenticate('apple', { 
    session: false,
    failureRedirect: process.env.NODE_ENV === 'production' 
      ? 'https://www.confidence-picks.com/login?error=apple_auth_failed'
      : 'http://localhost:5173/login?error=apple_auth_failed'
  })(req, res, next);
}, async (req, res) => {
  try {
    console.log('🍎 Apple callback handler reached - req.user:', req.user);
    
    if (!req.user) {
      console.error('❌ No user found in Apple callback');
      const frontendURL = process.env.NODE_ENV === 'production' 
        ? 'https://www.confidence-picks.com'
        : 'http://localhost:5173';
      return res.redirect(`${frontendURL}/login?error=apple_user_creation_failed`);
    }
    
    const { accessToken, refreshToken } = await AuthService.createTokens(req.user);
    
    const frontendURL = process.env.NODE_ENV === 'production' 
      ? 'https://www.confidence-picks.com'
      : 'http://localhost:5173';
    
    res.redirect(`${frontendURL}/auth/callback?token=${accessToken}&refresh=${refreshToken}`);
  } catch (error) {
    console.error('❌ Apple callback error:', error);
    const frontendURL = process.env.NODE_ENV === 'production' 
      ? 'https://www.confidence-picks.com'
      : 'http://localhost:5173';
    res.redirect(`${frontendURL}/login?error=apple_callback_failed`);
  }
});

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