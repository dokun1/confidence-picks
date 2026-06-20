class AuthService {
  // Get the correct API base URL based on environment
  static getApiBaseUrl() {
    // Use environment variable first, then fallback logic
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
    
    if (typeof window !== 'undefined') {
      // Check if we're running locally
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3001';
      }
    }
    
    // Production API URL
    return 'https://api.confidence-picks.com';
  }

  // ... rest of your existing methods stay exactly the same
  static getToken() {
    return localStorage.getItem('accessToken');
  }
  
  static getRefreshToken() {
    return localStorage.getItem('refreshToken');
  }
  
  static setTokens(accessToken, refreshToken) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }
  
  static clearTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }
  
  static setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  }
  
  // Decode the access token payload, or null if missing/malformed.
  static decodeToken() {
    const token = this.getToken();
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  }

  // True only while the access token is present and unexpired. Used to decide
  // whether a silent refresh is needed before the UI can trust API calls.
  static isAccessTokenValid() {
    const payload = this.decodeToken();
    if (!payload) return false;
    if (payload.exp && Date.now() / 1000 >= payload.exp) return false;
    return true;
  }

  // The last full profile we fetched from /auth/me, persisted across reloads.
  // Unlike getUser(), this does NOT depend on the access token still being
  // valid — it lets the app paint a returning user's identity immediately on
  // load while a refresh happens in the background. Returns null if no cached
  // profile exists.
  static getCachedUser() {
    try {
      const stored = localStorage.getItem('user');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return parsed && parsed.id ? parsed : null;
    } catch {
      return null;
    }
  }

  static getUser() {
    // Prefer enriched cached user (may include pictureUrl) if available and token valid
    const token = this.getToken();
    if (!token) return null;

    const payload = this.decodeToken();
    if (!payload) return null;

    if (payload.exp && Date.now() / 1000 >= payload.exp) {
      return null; // caller should attempt refresh
    }

    // If we previously fetched the full profile (/auth/me) use that (ensures pictureUrl present)
    const cached = this.getCachedUser();
    if (cached && cached.id === payload.userId) {
      return cached;
    }

    // Fallback to basic token-derived user (without pictureUrl)
    return {
      id: payload.userId,
      email: payload.email,
      name: payload.name,
      pictureUrl: payload.pictureUrl
    };
  }
  
  static isAuthenticated() {
    return !!this.getToken();
  }
  
  static login() {
    const apiBase = this.getApiBaseUrl();
    window.location.href = `${apiBase}/auth/google`;
  }
  
  static async logout() {
    const apiBase = this.getApiBaseUrl();
    const refreshToken = this.getRefreshToken();
    
    if (refreshToken) {
      try {
        await fetch(`${apiBase}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    
    this.clearTokens();
    window.location.href = '/';
  }
  
  static async makeAuthenticatedRequest(url, options = {}) {
    const token = this.getToken();
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
    
    // If token expired, try to refresh
    if (response.status === 401 || response.status === 403) {
      try {
        await this.refreshToken();
        const newToken = this.getToken();
        
        // Retry request with new token
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`
          }
        });
      } catch (error) {
        // Refresh failed, redirect to login
        this.clearTokens();
        window.location.href = '/login';
        throw error;
      }
    }
    
    return response;
  }
  
  static async refreshToken() {
    // De-duplicate concurrent refreshes. On a returning visit the silent
    // restore in AuthContext and the first protected API calls can all notice
    // the expired token at once; without this they would each POST /auth/refresh
    // and stampede the endpoint (and the DB lookup behind it). Share one
    // in-flight request so every caller awaits the same new token.
    if (this._refreshPromise) return this._refreshPromise;

    this._refreshPromise = this._performRefresh().finally(() => {
      this._refreshPromise = null;
    });
    return this._refreshPromise;
  }

  static async _performRefresh() {
    const apiBase = this.getApiBaseUrl();
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');

    const response = await fetch(`${apiBase}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
    }

    return data.accessToken;
  }
  
  static async getCurrentUser() {
    const apiBase = this.getApiBaseUrl();
    try {
      const response = await this.makeAuthenticatedRequest(`${apiBase}/auth/me`);
      
      if (response.ok) {
        const user = await response.json();
        this.setUser(user);
        return user;
      }
    } catch (error) {
      console.error('Failed to get current user:', error);
    }
    
    return null;
  }

  static async updateUserName(name) {
    const apiBase = this.getApiBaseUrl();
    try {
      const response = await this.makeAuthenticatedRequest(`${apiBase}/auth/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      
      if (response.ok) {
        const user = await response.json();
        this.setUser(user);
        return user;
      } else {
        const error = await response.json().catch(() => ({ error: 'Failed to update name' }));
        throw new Error(error.error || 'Failed to update name');
      }
    } catch (error) {
      console.error('Failed to update user name:', error);
      throw error;
    }
  }
}

export default AuthService;