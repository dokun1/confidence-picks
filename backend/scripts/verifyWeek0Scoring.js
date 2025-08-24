import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Connect specifically to production database
const prodPool = new Pool({
  connectionString: process.env.PROD_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Comprehensive Week 0 Scoring Verification Report
 * This script verifies that all picks made in Week 0 (preseason week 4) were scored correctly
 */

async function verifyWeek0Scoring() {
  try {
    console.log('🔍 Week 0 (Preseason Week 4) Scoring Verification Report - PRODUCTION DATABASE');
    console.log('=' .repeat(80));
    console.log();

    // First, get all games from Week 0
    const gamesQuery = await prodPool.query(`
      SELECT 
        id,
        espn_id,
        home_team,
        away_team,
        home_score,
        away_score,
        status,
        game_date,
        week,
        season,
        season_type
      FROM games 
      WHERE week = 0 AND season = 2025 AND season_type = 2
      ORDER BY game_date
    `);

    console.log(`📊 Total Week 0 Games Found: ${gamesQuery.rows.length}`);
    console.log();

    if (gamesQuery.rows.length === 0) {
      console.log('❌ No Week 0 games found in database');
      return;
    }

    // Show all games and their results
    console.log('🏈 All Week 0 Games:');
    console.log('-'.repeat(80));
    
    const games = gamesQuery.rows;
    const gameResults = new Map();
    
    games.forEach((game, index) => {
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;
      const homeScore = game.home_score || 0;
      const awayScore = game.away_score || 0;
      
      let result = 'TIE';
      let winningTeamId = null;
      
      if (homeScore > awayScore) {
        result = 'HOME WIN';
        winningTeamId = homeTeam.id;
      } else if (awayScore > homeScore) {
        result = 'AWAY WIN';
        winningTeamId = awayTeam.id;
      }
      
      gameResults.set(game.id, {
        winningTeamId,
        homeScore,
        awayScore,
        result,
        homeTeam,
        awayTeam
      });
      
      console.log(`${index + 1}. Game ${game.id} (ESPN: ${game.espn_id})`);
      console.log(`   ${awayTeam.abbreviation} ${awayTeam.name} @ ${homeTeam.abbreviation} ${homeTeam.name}`);
      console.log(`   Score: ${awayTeam.abbreviation} ${awayScore} - ${homeTeam.abbreviation} ${homeScore}`);
      console.log(`   Result: ${result} | Status: ${game.status}`);
      console.log(`   Date: ${game.game_date}`);
      console.log();
    });

    // Get all picks for Week 0
    const picksQuery = await prodPool.query(`
      SELECT 
        up.id as pick_id,
        up.user_id,
        up.group_id,
        up.game_id,
        up.picked_team_id,
        up.confidence_level,
        up.won,
        up.points,
        up.created_at,
        up.updated_at,
        u.email,
        g.home_team,
        g.away_team,
        g.home_score,
        g.away_score,
        g.status as game_status,
        gr.name as group_name
      FROM user_picks up
      JOIN users u ON up.user_id = u.id
      JOIN games g ON up.game_id = g.id
      LEFT JOIN groups gr ON up.group_id = gr.id
      WHERE up.week = 0 AND up.season = 2025 AND up.season_type = 2
      ORDER BY up.group_id, up.user_id, up.confidence_level DESC
    `);

    console.log(`📝 Total Week 0 Picks Found: ${picksQuery.rows.length}`);
    console.log();

    if (picksQuery.rows.length === 0) {
      console.log('❌ No Week 0 picks found in database');
      return;
    }

    // Group picks by user and group for analysis
    const picksByUserGroup = new Map();
    const scoringErrors = [];
    let totalCorrectPicks = 0;
    let totalIncorrectPicks = 0;
    let totalPoints = 0;

    picksQuery.rows.forEach(pick => {
      const key = `${pick.user_id}-${pick.group_id}`;
      if (!picksByUserGroup.has(key)) {
        picksByUserGroup.set(key, {
          userEmail: pick.email,
          groupName: pick.group_name || `Group ${pick.group_id}`,
          userId: pick.user_id,
          groupId: pick.group_id,
          picks: []
        });
      }
      picksByUserGroup.get(key).picks.push(pick);
    });

    console.log('👥 Picks by User and Group:');
    console.log('='.repeat(80));

    for (const [key, userGroup] of picksByUserGroup) {
      console.log();
      console.log(`📧 User: ${userGroup.userEmail} (ID: ${userGroup.userId})`);
      console.log(`🏷️  Group: ${userGroup.groupName} (ID: ${userGroup.groupId})`);
      console.log(`📊 Total Picks: ${userGroup.picks.length}`);
      console.log();

      let userPoints = 0;
      let userCorrect = 0;
      let userIncorrect = 0;

      userGroup.picks.forEach((pick, index) => {
        const gameResult = gameResults.get(pick.game_id);
        if (!gameResult) {
          console.log(`❌ ERROR: Game ${pick.game_id} not found in games data`);
          return;
        }

        const homeTeam = gameResult.homeTeam;
        const awayTeam = gameResult.awayTeam;
        const pickedTeam = pick.picked_team_id === homeTeam.id ? homeTeam : awayTeam;
        const isCorrect = pick.picked_team_id === gameResult.winningTeamId;
        const shouldHaveWon = gameResult.winningTeamId !== null ? isCorrect : null; // null for ties
        
        // Check if scoring is correct
        // Correct picks get +confidence, incorrect picks get -confidence
        const expectedPoints = isCorrect ? (pick.confidence_level || 0) : -(pick.confidence_level || 0);
        const actualPoints = pick.points || 0;
        const expectedWon = shouldHaveWon;
        const actualWon = pick.won;

        let scoringStatus = '✅';
        if (expectedPoints !== actualPoints || expectedWon !== actualWon) {
          scoringStatus = '❌ SCORING ERROR';
          scoringErrors.push({
            pickId: pick.pick_id,
            userEmail: userGroup.userEmail,
            gameId: pick.game_id,
            expectedPoints,
            actualPoints,
            expectedWon,
            actualWon
          });
        }

        if (isCorrect) {
          userCorrect++;
          totalCorrectPicks++;
        } else {
          userIncorrect++;
          totalIncorrectPicks++;
        }

        userPoints += actualPoints;
        totalPoints += actualPoints;

        console.log(`   ${index + 1}. Game ${pick.game_id}: ${awayTeam.abbreviation} ${gameResult.awayScore} - ${homeTeam.abbreviation} ${gameResult.homeScore}`);
        console.log(`      Pick: ${pickedTeam.abbreviation} ${pickedTeam.name} (Confidence: ${pick.confidence_level || 'N/A'})`);
        console.log(`      Result: ${isCorrect ? 'CORRECT ✅' : 'INCORRECT ❌'} | Points: ${actualPoints} | Won: ${actualWon}`);
        console.log(`      Scoring: ${scoringStatus}`);
        if (scoringStatus.includes('ERROR')) {
          console.log(`      Expected: Points=${expectedPoints}, Won=${expectedWon}`);
        }
        console.log(`      Created: ${pick.created_at} | Updated: ${pick.updated_at}`);
        console.log();
      });

      console.log(`   📊 User Summary: ${userCorrect} correct, ${userIncorrect} incorrect, ${userPoints} total points`);
      console.log('-'.repeat(40));
    }

    // Overall summary
    console.log();
    console.log('📈 OVERALL SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Picks Made: ${picksQuery.rows.length}`);
    console.log(`Correct Picks: ${totalCorrectPicks}`);
    console.log(`Incorrect Picks: ${totalIncorrectPicks}`);
    console.log(`Total Points Awarded: ${totalPoints}`);
    console.log(`Accuracy Rate: ${picksQuery.rows.length > 0 ? ((totalCorrectPicks / picksQuery.rows.length) * 100).toFixed(1) : 0}%`);
    console.log();

    // Scoring errors summary
    if (scoringErrors.length > 0) {
      console.log('🚨 SCORING ERRORS DETECTED');
      console.log('='.repeat(80));
      scoringErrors.forEach((error, index) => {
        console.log(`${index + 1}. Pick ID ${error.pickId} (User: ${error.userEmail}, Game: ${error.gameId})`);
        console.log(`   Expected: Points=${error.expectedPoints}, Won=${error.expectedWon}`);
        console.log(`   Actual: Points=${error.actualPoints}, Won=${error.actualWon}`);
        console.log();
      });
    } else {
      console.log('✅ NO SCORING ERRORS DETECTED - All picks scored correctly!');
    }

    // Check for any games that should have been final but aren't
    console.log();
    console.log('🔍 GAME STATUS VERIFICATION');
    console.log('='.repeat(80));
    
    const nonFinalGames = games.filter(g => g.status !== 'FINAL');
    if (nonFinalGames.length > 0) {
      console.log('⚠️  Games not marked as FINAL:');
      nonFinalGames.forEach(game => {
        console.log(`   Game ${game.id}: ${game.away_team.abbreviation} @ ${game.home_team.abbreviation} - Status: ${game.status}`);
      });
    } else {
      console.log('✅ All Week 0 games are marked as FINAL');
    }

    // Check for any incomplete scoring
    console.log();
    console.log('🔍 INCOMPLETE SCORING CHECK');
    console.log('='.repeat(80));
    
    const incompletePicks = picksQuery.rows.filter(pick => 
      pick.won === null || pick.points === null
    );
    
    if (incompletePicks.length > 0) {
      console.log('⚠️  Picks with incomplete scoring:');
      incompletePicks.forEach(pick => {
        console.log(`   Pick ID ${pick.pick_id}: User ${pick.email}, Game ${pick.game_id} - Won: ${pick.won}, Points: ${pick.points}`);
      });
    } else {
      console.log('✅ All picks have complete scoring (won/points set)');
    }

    console.log();
    console.log('🎯 VERIFICATION COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await prodPool.end();
  }
}

// Run the verification
verifyWeek0Scoring();
