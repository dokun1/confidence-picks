import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getCurrentNFLSeason } from '../src/utils/nflSeasonUtils.js';

describe('NFL Season Utils', () => {
  it('should return previous year for January', () => {
    // Mock Date to be January 4, 2026
    const originalDate = global.Date;
    global.Date = class extends originalDate {
      constructor() {
        super();
        return new originalDate('2026-01-04T12:00:00Z');
      }
      static now() {
        return new originalDate('2026-01-04T12:00:00Z').getTime();
      }
    };
    
    const season = getCurrentNFLSeason();
    assert.strictEqual(season, 2025, 'January 2026 should return 2025 season');
    
    global.Date = originalDate;
  });
  
  it('should return previous year for February', () => {
    const originalDate = global.Date;
    global.Date = class extends originalDate {
      constructor() {
        super();
        return new originalDate('2026-02-14T12:00:00Z');
      }
      static now() {
        return new originalDate('2026-02-14T12:00:00Z').getTime();
      }
    };
    
    const season = getCurrentNFLSeason();
    assert.strictEqual(season, 2025, 'February 2026 should return 2025 season');
    
    global.Date = originalDate;
  });
  
  it('should return current year for September', () => {
    const originalDate = global.Date;
    global.Date = class extends originalDate {
      constructor() {
        super();
        return new originalDate('2025-09-01T12:00:00Z');
      }
      static now() {
        return new originalDate('2025-09-01T12:00:00Z').getTime();
      }
    };
    
    const season = getCurrentNFLSeason();
    assert.strictEqual(season, 2025, 'September 2025 should return 2025 season');
    
    global.Date = originalDate;
  });
  
  it('should return current year for March (offseason)', () => {
    const originalDate = global.Date;
    global.Date = class extends originalDate {
      constructor() {
        super();
        return new originalDate('2026-03-15T12:00:00Z');
      }
      static now() {
        return new originalDate('2026-03-15T12:00:00Z').getTime();
      }
    };
    
    const season = getCurrentNFLSeason();
    assert.strictEqual(season, 2026, 'March 2026 should return 2026 season');
    
    global.Date = originalDate;
  });
});