import pool from '../config/database.js';

export class User {
  constructor(data) {
    this.id = data.id;
    this.googleId = data.googleId;
    this.appleId = data.appleId;
    this.email = data.email;
    this.name = data.name;
    this.pictureUrl = data.pictureUrl;
    this.provider = data.provider;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.lastLogin = data.lastLogin;
  }

  // Create or update user from OAuth provider
  static async createOrUpdate(providerData) {
  const { provider, id: providerId, email, name, picture } = providerData;
  // Basic guard: ensure picture looks like a URL before persisting
  const safePicture = (typeof picture === 'string' && /^(https?:)?\/\//.test(picture)) ? picture : null;
    
    const query = `
      INSERT INTO users (
        ${provider}_id, email, name, picture_url, provider, updated_at, last_login
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (email) 
      DO UPDATE SET
        ${provider}_id = EXCLUDED.${provider}_id,
        name = EXCLUDED.name,
        picture_url = EXCLUDED.picture_url,
        provider = EXCLUDED.provider,
        updated_at = CURRENT_TIMESTAMP,
        last_login = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
  const values = [providerId, email, name, safePicture, provider];
    const result = await pool.query(query, values);
    
    return new User({
      id: result.rows[0].id,
      googleId: result.rows[0].google_id,
      appleId: result.rows[0].apple_id,
      email: result.rows[0].email,
      name: result.rows[0].name,
      pictureUrl: result.rows[0].picture_url,
      provider: result.rows[0].provider,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at,
      lastLogin: result.rows[0].last_login
    });
  }

  // Find user by ID
  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return new User({
      id: row.id,
      googleId: row.google_id,
      appleId: row.apple_id,
      email: row.email,
      name: row.name,
      pictureUrl: row.picture_url,
      provider: row.provider,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLogin: row.last_login
    });
  }

  // Find user by email
  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return new User({
      id: row.id,
      googleId: row.google_id,
      appleId: row.apple_id,
      email: row.email,
      name: row.name,
      pictureUrl: row.picture_url,
      provider: row.provider,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLogin: row.last_login
    });
  }

  // Find user by Apple ID
  static async findByAppleId(appleId) {
    const query = 'SELECT * FROM users WHERE apple_id = $1';
    const result = await pool.query(query, [appleId]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return new User({
      id: row.id,
      googleId: row.google_id,
      appleId: row.apple_id,
      email: row.email,
      name: row.name,
      pictureUrl: row.picture_url,
      provider: row.provider,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLogin: row.last_login
    });
  }

  // Create or update user from Apple Sign In
  static async createOrUpdateFromApple(appleData) {
    const { appleId, email, firstName, lastName } = appleData;
    const name = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'Apple User';
    
    // If no email provided, generate a fallback email based on Apple ID
    const userEmail = email || `apple_${appleId}@confidence-picks.local`;
    
    // First try to find by Apple ID
    let existingUser = await User.findByAppleId(appleId);
    
    if (existingUser) {
      // Update last login
      const query = `
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE apple_id = $1
        RETURNING *
      `;
      const result = await pool.query(query, [appleId]);
      
      return new User({
        id: result.rows[0].id,
        googleId: result.rows[0].google_id,
        appleId: result.rows[0].apple_id,
        email: result.rows[0].email,
        name: result.rows[0].name,
        pictureUrl: result.rows[0].picture_url,
        provider: result.rows[0].provider,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
        lastLogin: result.rows[0].last_login
      });
    }

    // If email provided, check for existing user by email
    if (email) {
      existingUser = await User.findByEmail(email);
      
      if (existingUser) {
        // Link Apple ID to existing account
        const query = `
          UPDATE users 
          SET apple_id = $1, provider = 'apple', last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE email = $2
          RETURNING *
        `;
        const result = await pool.query(query, [appleId, email]);
        
        return new User({
          id: result.rows[0].id,
          googleId: result.rows[0].google_id,
          appleId: result.rows[0].apple_id,
          email: result.rows[0].email,
          name: result.rows[0].name,
          pictureUrl: result.rows[0].picture_url,
          provider: result.rows[0].provider,
          createdAt: result.rows[0].created_at,
          updatedAt: result.rows[0].updated_at,
          lastLogin: result.rows[0].last_login
        });
      }
    }

    // Create new user
    const query = `
      INSERT INTO users (apple_id, email, name, provider, created_at, updated_at, last_login)
      VALUES ($1, $2, $3, 'apple', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    
    const values = [appleId, userEmail, name];
    const result = await pool.query(query, values);
    
    return new User({
      id: result.rows[0].id,
      googleId: result.rows[0].google_id,
      appleId: result.rows[0].apple_id,
      email: result.rows[0].email,
      name: result.rows[0].name,
      pictureUrl: result.rows[0].picture_url,
      provider: result.rows[0].provider,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at,
      lastLogin: result.rows[0].last_login
    });
  }

  // Save refresh token
  async saveRefreshToken(refreshToken, expiresAt) {
    const query = `
      INSERT INTO user_sessions (user_id, refresh_token, expires_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (refresh_token)
      DO UPDATE SET expires_at = $3
    `;
    
    await pool.query(query, [this.id, refreshToken, expiresAt]);
  }

  // Revoke refresh token
  static async revokeRefreshToken(refreshToken) {
    const query = 'DELETE FROM user_sessions WHERE refresh_token = $1';
    await pool.query(query, [refreshToken]);
  }

  // Get user by refresh token
  static async findByRefreshToken(refreshToken) {
    const query = `
      SELECT u.* FROM users u
      JOIN user_sessions s ON u.id = s.user_id
      WHERE s.refresh_token = $1 AND s.expires_at > CURRENT_TIMESTAMP
    `;
    
    const result = await pool.query(query, [refreshToken]);
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return new User({
      id: row.id,
      googleId: row.google_id,
      appleId: row.apple_id,
      email: row.email,
      name: row.name,
      pictureUrl: row.picture_url,
      provider: row.provider,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLogin: row.last_login
    });
  }

  // Update user name
  static async updateName(userId, name) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Name is required and must be a non-empty string');
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      throw new Error('Name must be 100 characters or less');
    }

    const query = `
      UPDATE users 
      SET name = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2 
      RETURNING *
    `;
    
    const result = await pool.query(query, [trimmedName, userId]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const row = result.rows[0];
    return new User({
      id: row.id,
      googleId: row.google_id,
      appleId: row.apple_id,
      email: row.email,
      name: row.name,
      pictureUrl: row.picture_url,
      provider: row.provider,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLogin: row.last_login
    });
  }
}