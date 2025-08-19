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
  
  static getUser() {
    // Prefer enriched cached user (may include pictureUrl) if available and token valid
    const token = this.getToken();
    if (!token) return null;

    let payload;
    try {
      payload = JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }

    if (payload?.exp && Date.now() / 1000 >= payload.exp) {
      return null; // caller should attempt refresh
    }

    // If we previously fetched the full profile (/auth/me) use that (ensures pictureUrl present)
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id === payload.userId) {
          return parsed;
        }
      }
    } catch {/* ignore */}

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
}

export default AuthService;