export class ESPNService {
  static BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

  static async fetchGames(year, seasonType, week) {
    const url = `${this.BASE_URL}?dates=${year}&seasontype=${seasonType}&week=${week}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data.events || [];
    } catch (error) {
      console.error('Failed to fetch ESPN data:', error);
      throw error;
    }
  }

  static async fetchGameById(gameId) {
    // ESPN doesn't have a direct game-by-id endpoint for scoreboard
    // You'd need to implement this based on their API structure
    // For now, we'll throw an error
    throw new Error('ESPN API does not support fetching individual games');
  }
}