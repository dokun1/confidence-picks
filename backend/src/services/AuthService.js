import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export class AuthService {
  static JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';
  static JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
  static ACCESS_TOKEN_EXPIRES = '15m';
  static REFRESH_TOKEN_EXPIRES = '30d';

  // Generate access token
  static generateAccessToken(user) {
    return jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        name: user.name 
      },
      this.JWT_SECRET,
      { expiresIn: this.ACCESS_TOKEN_EXPIRES }
    );
  }

  // Generate refresh token
  static generateRefreshToken(user) {
    return jwt.sign(
      { userId: user.id },
      this.JWT_REFRESH_SECRET,
      { expiresIn: this.REFRESH_TOKEN_EXPIRES }
    );
  }

  // Verify access token
  static verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  // Verify refresh token
  static verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.JWT_REFRESH_SECRET);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  // Create authentication tokens for user
  static async createTokens(user) {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    
    // Save refresh token to database
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await user.saveRefreshToken(refreshToken, expiresAt);
    
    return { accessToken, refreshToken };
  }

  // Refresh access token
  static async refreshAccessToken(refreshToken) {
    // Verify refresh token
    const decoded = this.verifyRefreshToken(refreshToken);
    
    // Get user from database using refresh token
    const user = await User.findByRefreshToken(refreshToken);
    if (!user) {
      throw new Error('User not found or refresh token expired');
    }
    
    // Generate new access token
    const accessToken = this.generateAccessToken(user);
    
    return { accessToken };
  }

  // Logout user
  static async logout(refreshToken) {
    await User.revokeRefreshToken(refreshToken);
  }
}