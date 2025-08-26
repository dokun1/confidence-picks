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
    const key = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    console.log('🍎 Using private key from env variable');
    console.log('🍎 Key starts with:', key.substring(0, 50));
    console.log('🍎 Key ends with:', key.substring(key.length - 50));
    console.log('🍎 Key has newlines:', key.includes('\n'));
    return key;
  }
  
  // Priority 2: File path (for local development)
  if (process.env.APPLE_PRIVATE_KEY_PATH) {
    const keyPath = path.resolve(__dirname, '..', process.env.APPLE_PRIVATE_KEY_PATH.replace('./src/', ''));
    
    if (fs.existsSync(keyPath)) {
      const key = fs.readFileSync(keyPath, 'utf8');
      console.log('🍎 Using private key from file');
      console.log('🍎 Key starts with:', key.substring(0, 50));
      console.log('🍎 Key ends with:', key.substring(key.length - 50));
      return key;
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
  console.log('🍎 Configuring Apple Strategy with:');
  console.log('🍎 - clientID:', process.env.APPLE_CLIENT_ID);
  console.log('🍎 - teamID:', process.env.APPLE_TEAM_ID);
  console.log('🍎 - keyID:', process.env.APPLE_KEY_ID);
  console.log('🍎 - callbackURL:', process.env.NODE_ENV === 'production'
    ? 'https://api.confidence-picks.com/auth/apple/callback'
    : 'http://localhost:3001/auth/apple/callback');
  console.log('🍎 - privateKey length:', applePrivateKey.length);
  console.log('🍎 - privateKey type:', typeof applePrivateKey);
  
  // Test JWT signing directly to validate the key
  try {
    const testPayload = { test: 'data', iat: Math.floor(Date.now() / 1000) };
    const testToken = jwt.sign(testPayload, applePrivateKey, { 
      algorithm: 'ES256',
      keyid: process.env.APPLE_KEY_ID,
      issuer: process.env.APPLE_TEAM_ID,
      audience: 'https://appleid.apple.com'
    });
    console.log('🍎 ✅ JWT signing test successful - token length:', testToken.length);
  } catch (jwtError) {
    console.error('🍎 ❌ JWT signing test failed:', jwtError.message);
    console.error('🍎 ❌ This indicates the private key format is invalid');
  }

  passport.use(new AppleStrategy({
    clientID: process.env.APPLE_CLIENT_ID,
    teamID: process.env.APPLE_TEAM_ID,
    keyID: process.env.APPLE_KEY_ID,
    privateKey: applePrivateKey, // Use key exactly as loaded
    callbackURL: process.env.NODE_ENV === 'production'
      ? 'https://api.confidence-picks.com/auth/apple/callback'
      : 'http://localhost:3001/auth/apple/callback',
    scope: ['email', 'name'],
    passReqToCallback: false
  }, async (accessToken, refreshToken, profile, done) => {
    console.log('🍎 APPLE STRATEGY CALLED - Entry Point');
    console.log('🍎 Apple Strategy - accessToken exists:', !!accessToken);
    console.log('🍎 Apple Strategy - refreshToken exists:', !!refreshToken);
    
    try {
      console.log('🍎 Apple Strategy - Raw Profile:', JSON.stringify(profile, null, 2));
      
      // Apple provides user info differently
      const appleData = {
        appleId: profile.id,
        email: profile.email,
        firstName: profile.name?.firstName,
        lastName: profile.name?.lastName
      };
      
      console.log('🍎 Apple Strategy - Processed Data:', JSON.stringify(appleData, null, 2));
      
      const user = await User.createOrUpdateFromApple(appleData);
      console.log('🍎 Apple Strategy - User Created:', JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        appleId: user.appleId
      }, null, 2));
      
      return done(null, user);
    } catch (error) {
      console.error('❌ Apple Strategy Error:', error);
      console.error('❌ Error Stack:', error.stack);
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