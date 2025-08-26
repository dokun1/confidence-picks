import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as AppleStrategy } from 'passport-apple';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to get Apple private key
function getApplePrivateKey() {
  // Priority 1: Environment variable (for CI/production)
  if (process.env.APPLE_PRIVATE_KEY) {
    // Replace \n with actual newlines
    return process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  }
  
  // Priority 2: File path (for local development)
  if (process.env.APPLE_PRIVATE_KEY_PATH) {
    const keyPath = path.resolve(__dirname, '..', process.env.APPLE_PRIVATE_KEY_PATH.replace('./src/', ''));
    
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath, 'utf8');
    }
  }
  
  // No key found - this is ok during development before keys are set up
  console.warn('⚠️ Apple private key not found. Apple Sign In will not work until keys are configured.');
  return null;
}

// Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.NODE_ENV === 'production' 
    ? 'https://api.confidence-picks.com/auth/google/callback'  // Production callback
    : "http://localhost:3001/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const userData = {
      provider: 'google',
      id: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      picture: profile.photos[0].value
    };
    
    const user = await User.createOrUpdate(userData);
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

// Apple Strategy (only configure if keys are available)
const applePrivateKey = getApplePrivateKey();
const hasAppleConfig = process.env.APPLE_CLIENT_ID && 
                      process.env.APPLE_TEAM_ID && 
                      process.env.APPLE_KEY_ID &&
                      !process.env.APPLE_CLIENT_ID.startsWith('REPLACE_WITH_');

if (hasAppleConfig && applePrivateKey) {
  // Test JWT signing to validate the key
  try {
    const testPayload = { test: 'data', iat: Math.floor(Date.now() / 1000) };
    jwt.sign(testPayload, applePrivateKey, { 
      algorithm: 'ES256',
      keyid: process.env.APPLE_KEY_ID,
      issuer: process.env.APPLE_TEAM_ID,
      audience: 'https://appleid.apple.com'
    });
    console.log('✅ Apple Sign In configured and private key validated');
  } catch (jwtError) {
    console.error('❌ Apple private key validation failed:', jwtError.message);
  }

  passport.use(new AppleStrategy({
    clientID: process.env.APPLE_CLIENT_ID,
    teamID: process.env.APPLE_TEAM_ID,
    keyID: process.env.APPLE_KEY_ID,
    privateKeyString: applePrivateKey, // Use privateKeyString instead of privateKey!
    callbackURL: process.env.NODE_ENV === 'production'
      ? 'https://api.confidence-picks.com/auth/apple/callback'
      : 'http://localhost:3001/auth/apple/callback',
    scope: ['email', 'name'],
    passReqToCallback: true // Enable request to be passed to callback
  }, async (req, accessToken, refreshToken, idToken, profile, done) => {
    try {
      // Decode the ID token to get email and other info
      let decodedToken = null;
      if (idToken) {
        decodedToken = jwt.decode(idToken, { json: true });
      }
      
      // Extract email from ID token or profile
      const email = decodedToken?.email || profile.email;
      const appleId = decodedToken?.sub || profile.id;
      
      // Get name from profile or request (first time only)
      let firstName = profile.name?.firstName;
      let lastName = profile.name?.lastName;
      
      // Check if this is the first auth and user data is in request body or query
      const userData = req.body?.user || req.query?.user;
      if (userData) {
        try {
          const parsedUserData = typeof userData === 'string' ? JSON.parse(userData) : userData;
          firstName = firstName || parsedUserData.name?.firstName;
          lastName = lastName || parsedUserData.name?.lastName;
        } catch (e) {
          console.log('Could not parse user data from request:', e.message);
        }
      }
      
      const appleData = {
        appleId: appleId,
        email: email,
        firstName: firstName,
        lastName: lastName
      };
      
      const user = await User.createOrUpdateFromApple(appleData);
      return done(null, user);
    } catch (error) {
      console.error('Apple authentication error:', error);
      return done(error, null);
    }
  }));
  console.log('✅ Apple Sign In strategy configured');
} else {
  console.log('⚠️ Apple Sign In strategy not configured - missing keys or environment variables');
}

// Export a helper to check if Apple is configured
export const isAppleConfigured = () => hasAppleConfig && applePrivateKey;

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;