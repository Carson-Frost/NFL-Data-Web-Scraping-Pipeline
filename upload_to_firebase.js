// upload_to_firebase.js
// This script uploads all JSON data to Firestore

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin with environment variables from GitHub Secrets
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
});

const db = admin.firestore();
const DATA_DIR = './nfl_data_output';

// Helper function to read JSON file
function readJsonFile(filename) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${filename}`);
        return null;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
}

// Helper function to upload data with batch writes (more efficient)
async function uploadCollection(collectionName, data, docIdFunc) {
    console.log(`\n📤 Uploading to ${collectionName}...`);

    if (!data || data.length === 0) {
        console.log(`⚠️  No data to upload for ${collectionName}`);
        return;
    }

    const batch = db.batch();
    let count = 0;

    for (const item of data) {
        const docId = docIdFunc(item);
        const docRef = db.collection(collectionName).doc(docId);
        batch.set(docRef, item, { merge: true }); // merge: true updates without overwriting
        count++;

        // Firestore batch limit is 500, so commit and start new batch if needed
        if (count % 500 === 0) {
            await batch.commit();
            console.log(`   ✓ Committed ${count} documents...`);
        }
    }

    // Commit remaining documents
    if (count % 500 !== 0) {
        await batch.commit();
    }

    console.log(`✅ Uploaded ${count} documents to ${collectionName}`);
}

// Main upload function
async function uploadAllData() {
    console.log('🚀 Starting Firebase upload...\n');

    try {
        // ==============================================================================
        // 1. PLAYER PASSING STATS - WEEKLY
        // ==============================================================================
        const passingWeekly = readJsonFile('player_passing_weekly.json');
        if (passingWeekly) {
            await uploadCollection(
                'nfl_players_passing_weekly',
                passingWeekly,
                (item) => `${item.season}_week${item.week}_${item.passer_player_id}`
            );
        }

        // ==============================================================================
        // 2. PLAYER PASSING STATS - SEASON
        // ==============================================================================
        const passingSeason = readJsonFile('player_passing_season.json');
        if (passingSeason) {
            await uploadCollection(
                'nfl_players_passing_season',
                passingSeason,
                (item) => `${item.season}_${item.passer_player_id}`
            );
        }

        // ==============================================================================
        // 3. PLAYER RUSHING STATS - WEEKLY
        // ==============================================================================
        const rushingWeekly = readJsonFile('player_rushing_weekly.json');
        if (rushingWeekly) {
            await uploadCollection(
                'nfl_players_rushing_weekly',
                rushingWeekly,
                (item) => `${item.season}_week${item.week}_${item.rusher_player_id}`
            );
        }

        // ==============================================================================
        // 4. PLAYER RUSHING STATS - SEASON
        // ==============================================================================
        const rushingSeason = readJsonFile('player_rushing_season.json');
        if (rushingSeason) {
            await uploadCollection(
                'nfl_players_rushing_season',
                rushingSeason,
                (item) => `${item.season}_${item.rusher_player_id}`
            );
        }

        // ==============================================================================
        // 5. PLAYER RECEIVING STATS - WEEKLY
        // ==============================================================================
        const receivingWeekly = readJsonFile('player_receiving_weekly.json');
        if (receivingWeekly) {
            await uploadCollection(
                'nfl_players_receiving_weekly',
                receivingWeekly,
                (item) => `${item.season}_week${item.week}_${item.receiver_player_id}`
            );
        }

        // ==============================================================================
        // 6. PLAYER RECEIVING STATS - SEASON
        // ==============================================================================
        const receivingSeason = readJsonFile('player_receiving_season.json');
        if (receivingSeason) {
            await uploadCollection(
                'nfl_players_receiving_season',
                receivingSeason,
                (item) => `${item.season}_${item.receiver_player_id}`
            );
        }

        // ==============================================================================
        // 7. TEAM STATS - SEASON
        // ==============================================================================
        const teamStats = readJsonFile('team_stats_season.json');
        if (teamStats) {
            await uploadCollection(
                'nfl_teams_season',
                teamStats,
                (item) => `${item.season}_${item.posteam}`
            );
        }

        // ==============================================================================
        // 8. STANDINGS
        // ==============================================================================
        const standings = readJsonFile('standings.json');
        if (standings) {
            // Add season to standings (since it's not in the data)
            const standingsWithSeason = standings.map(team => ({
                ...team,
                season: 2024 // You can make this dynamic if needed
            }));

            await uploadCollection(
                'nfl_standings',
                standingsWithSeason,
                (item) => `${item.season}_${item.team}`
            );
        }

        // ==============================================================================
        // 9. GAMES/SCHEDULE
        // ==============================================================================
        const schedule = readJsonFile('games_schedule.json');
        if (schedule) {
            await uploadCollection(
                'nfl_games_schedule',
                schedule,
                (item) => item.game_id
            );
        }

        // ==============================================================================
        // 10. ROSTERS
        // ==============================================================================
        const rosters = readJsonFile('rosters.json');
        if (rosters) {
            await uploadCollection(
                'nfl_rosters',
                rosters,
                (item) => `${item.season}_${item.team}_${item.gsis_id}`
            );
        }

        // ==============================================================================
        // 11. TEAMS INFO
        // ==============================================================================
        const teamsInfo = readJsonFile('teams_info.json');
        if (teamsInfo) {
            await uploadCollection(
                'nfl_teams_info',
                teamsInfo,
                (item) => item.team_abbr
            );
        }

        console.log('\n✅ All data uploaded successfully!');
        console.log('\n📊 Summary:');
        console.log('   - Player stats (weekly & season): passing, rushing, receiving');
        console.log('   - Team stats & standings');
        console.log('   - Games schedule & scores');
        console.log('   - Rosters & team info');

    } catch (error) {
        console.error('❌ Error uploading data:', error);
        process.exit(1);
    }
}

// Run the upload
uploadAllData()
    .then(() => {
        console.log('\n🎉 Firebase upload complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });