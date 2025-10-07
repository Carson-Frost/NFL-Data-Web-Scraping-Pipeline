// upload_player_stats_to_firebase.js
// This script uploads comprehensive NFL player stats to Firestore
// with batch processing, checkpoint recovery, and error handling

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Configuration
const BATCH_SIZE = 500; // Firebase's batch write limit
const BATCH_DELAY = 750; // Delay between batches in milliseconds
const CHECKPOINT_FILE = './upload_checkpoint.json';
const ERROR_LOG_FILE = './upload_errors.json';
const SEASON_STATS_FILE = './nfl_data_output/season_stats.csv';
const WEEKLY_STATS_FILE = './nfl_data_output/weekly_stats.csv';

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
});

const db = admin.firestore();

// Logging function
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

// Sleep function for rate limiting
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Read checkpoint file
function readCheckpoint() {
    if (fs.existsSync(CHECKPOINT_FILE)) {
        try {
            const data = fs.readFileSync(CHECKPOINT_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            log(`Error reading checkpoint: ${error.message}`);
            return null;
        }
    }
    return null;
}

// Write checkpoint file
function writeCheckpoint(checkpoint) {
    try {
        fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
    } catch (error) {
        log(`Error writing checkpoint: ${error.message}`);
    }
}

// Log error to error file
function logError(error, context) {
    const errorEntry = {
        timestamp: new Date().toISOString(),
        error: error.message,
        context: context
    };
    
    let errors = [];
    if (fs.existsSync(ERROR_LOG_FILE)) {
        try {
            const data = fs.readFileSync(ERROR_LOG_FILE, 'utf8');
            errors = JSON.parse(data);
        } catch (e) {
            // If can't read, start fresh
        }
    }
    
    errors.push(errorEntry);
    fs.writeFileSync(ERROR_LOG_FILE, JSON.stringify(errors, null, 2));
}

// Parse CSV file
function parseCSV(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}

// Convert CSV row to Firestore document
function convertRowToDocument(row) {
    const doc = {};
    
    // Convert all values, handling data types
    for (const [key, value] of Object.entries(row)) {
        if (value === '' || value === 'NA' || value === 'null') {
            doc[key] = null;
        } else if (!isNaN(value) && value !== '') {
            // Convert to number if it's numeric
            doc[key] = parseFloat(value);
        } else {
            doc[key] = value;
        }
    }
    
    return doc;
}

// Create document ID for season stats
function createSeasonDocId(row) {
    return `${row.season}_${row.player_id}`;
}

// Create document ID for weekly stats
function createWeeklyDocId(row) {
    return `${row.season}_${row.week}_${row.player_id}`;
}

// Process season stats upload
async function uploadSeasonStats(seasonData, checkpoint) {
    log('Starting season stats upload...');
    
    const totalRecords = seasonData.length;
    const startIndex = checkpoint?.seasonStats?.lastIndex || 0;
    const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);
    const startBatch = Math.floor(startIndex / BATCH_SIZE);
    
    log(`Season stats: ${totalRecords} records, starting from index ${startIndex}`);
    log(`Total batches: ${totalBatches}, starting from batch ${startBatch + 1}`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let batchIndex = startBatch; batchIndex < totalBatches; batchIndex++) {
        const startIdx = batchIndex * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, totalRecords);
        const batch = seasonData.slice(startIdx, endIdx);
        
        try {
            const writeBatch = db.batch();
            
            for (const row of batch) {
                const docId = createSeasonDocId(row);
                const docData = convertRowToDocument(row);
                const docRef = db.collection('season_stats').doc(docId);
                writeBatch.set(docRef, docData);
            }
            
            await writeBatch.commit();
            successCount += batch.length;
            
            // Update checkpoint
            const newCheckpoint = {
                ...checkpoint,
                seasonStats: {
                    lastIndex: endIdx,
                    completed: endIdx >= totalRecords
                },
                lastUpdate: new Date().toISOString()
            };
            writeCheckpoint(newCheckpoint);
            
            const progress = ((batchIndex + 1) / totalBatches * 100).toFixed(1);
            log(`Season stats: Batch ${batchIndex + 1}/${totalBatches} complete (${progress}%) - ${successCount} records uploaded`);
            
            // Rate limiting
            if (batchIndex < totalBatches - 1) {
                await sleep(BATCH_DELAY);
            }
            
        } catch (error) {
            errorCount += batch.length;
            logError(error, `Season stats batch ${batchIndex + 1} (records ${startIdx}-${endIdx})`);
            log(`Error in season stats batch ${batchIndex + 1}: ${error.message}`);
            
            // Continue with next batch instead of failing completely
            continue;
        }
    }
    
    log(`Season stats upload complete: ${successCount} successful, ${errorCount} errors`);
    return { successCount, errorCount };
}

// Process weekly stats upload
async function uploadWeeklyStats(weeklyData, checkpoint) {
    log('Starting weekly stats upload...');
    
    const totalRecords = weeklyData.length;
    const startIndex = checkpoint?.weeklyStats?.lastIndex || 0;
    const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);
    const startBatch = Math.floor(startIndex / BATCH_SIZE);
    
    log(`Weekly stats: ${totalRecords} records, starting from index ${startIndex}`);
    log(`Total batches: ${totalBatches}, starting from batch ${startBatch + 1}`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let batchIndex = startBatch; batchIndex < totalBatches; batchIndex++) {
        const startIdx = batchIndex * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, totalRecords);
        const batch = weeklyData.slice(startIdx, endIdx);
        
        try {
            const writeBatch = db.batch();
            
            for (const row of batch) {
                const docId = createWeeklyDocId(row);
                const docData = convertRowToDocument(row);
                const docRef = db.collection('weekly_stats').doc(docId);
                writeBatch.set(docRef, docData);
            }
            
            await writeBatch.commit();
            successCount += batch.length;
            
            // Update checkpoint
            const newCheckpoint = {
                ...checkpoint,
                weeklyStats: {
                    lastIndex: endIdx,
                    completed: endIdx >= totalRecords
                },
                lastUpdate: new Date().toISOString()
            };
            writeCheckpoint(newCheckpoint);
            
            const progress = ((batchIndex + 1) / totalBatches * 100).toFixed(1);
            log(`Weekly stats: Batch ${batchIndex + 1}/${totalBatches} complete (${progress}%) - ${successCount} records uploaded`);
            
            // Rate limiting
            if (batchIndex < totalBatches - 1) {
                await sleep(BATCH_DELAY);
            }
            
        } catch (error) {
            errorCount += batch.length;
            logError(error, `Weekly stats batch ${batchIndex + 1} (records ${startIdx}-${endIdx})`);
            log(`Error in weekly stats batch ${batchIndex + 1}: ${error.message}`);
            
            // Continue with next batch instead of failing completely
            continue;
        }
    }
    
    log(`Weekly stats upload complete: ${successCount} successful, ${errorCount} errors`);
    return { successCount, errorCount };
}

// Verify upload by counting documents
async function verifyUpload() {
    log('Verifying upload...');
    
    try {
        const seasonStatsSnapshot = await db.collection('season_stats').get();
        const weeklyStatsSnapshot = await db.collection('weekly_stats').get();
        
        log(`Verification results:`);
        log(`  - Season stats documents: ${seasonStatsSnapshot.size}`);
        log(`  - Weekly stats documents: ${weeklyStatsSnapshot.size}`);
        
        // Sample a few documents to verify structure
        if (seasonStatsSnapshot.size > 0) {
            const sampleSeason = seasonStatsSnapshot.docs[0].data();
            log(`  - Sample season doc ID: ${seasonStatsSnapshot.docs[0].id}`);
            log(`  - Sample season player: ${sampleSeason.player_name} (${sampleSeason.season})`);
        }
        
        if (weeklyStatsSnapshot.size > 0) {
            const sampleWeekly = weeklyStatsSnapshot.docs[0].data();
            log(`  - Sample weekly doc ID: ${weeklyStatsSnapshot.docs[0].id}`);
            log(`  - Sample weekly player: ${sampleWeekly.player_name} (${sampleWeekly.season} week ${sampleWeekly.week})`);
        }
        
        return {
            seasonStatsCount: seasonStatsSnapshot.size,
            weeklyStatsCount: weeklyStatsSnapshot.size
        };
        
    } catch (error) {
        log(`Error during verification: ${error.message}`);
        return null;
    }
}

// Main upload function
async function uploadAllData() {
    const startTime = Date.now();
    log('🚀 Starting NFL Player Stats Firebase upload...');
    
    try {
        // Read checkpoint
        const checkpoint = readCheckpoint();
        if (checkpoint) {
            log(`Resuming from checkpoint: ${checkpoint.lastUpdate}`);
            log(`  - Season stats: ${checkpoint.seasonStats?.completed ? 'Complete' : `Index ${checkpoint.seasonStats?.lastIndex || 0}`}`);
            log(`  - Weekly stats: ${checkpoint.weeklyStats?.completed ? 'Complete' : `Index ${checkpoint.weeklyStats?.lastIndex || 0}`}`);
        } else {
            log('No checkpoint found, starting fresh upload');
        }
        
        // Check if CSV files exist
        if (!fs.existsSync(SEASON_STATS_FILE)) {
            throw new Error(`Season stats file not found: ${SEASON_STATS_FILE}`);
        }
        if (!fs.existsSync(WEEKLY_STATS_FILE)) {
            throw new Error(`Weekly stats file not found: ${WEEKLY_STATS_FILE}`);
        }
        
        // Parse CSV files
        log('Parsing CSV files...');
        const [seasonData, weeklyData] = await Promise.all([
            parseCSV(SEASON_STATS_FILE),
            parseCSV(WEEKLY_STATS_FILE)
        ]);
        
        log(`Parsed ${seasonData.length} season records and ${weeklyData.length} weekly records`);
        
        // Upload season stats (if not already complete)
        let seasonResults = { successCount: 0, errorCount: 0 };
        if (!checkpoint?.seasonStats?.completed) {
            seasonResults = await uploadSeasonStats(seasonData, checkpoint);
        } else {
            log('Season stats already complete, skipping...');
        }
        
        // Upload weekly stats (if not already complete)
        let weeklyResults = { successCount: 0, errorCount: 0 };
        if (!checkpoint?.weeklyStats?.completed) {
            weeklyResults = await uploadWeeklyStats(weeklyData, checkpoint);
        } else {
            log('Weekly stats already complete, skipping...');
        }
        
        // Verify upload
        const verification = await verifyUpload();
        
        // Clean up checkpoint file if everything is complete
        if (checkpoint?.seasonStats?.completed && checkpoint?.weeklyStats?.completed) {
            fs.unlinkSync(CHECKPOINT_FILE);
            log('Checkpoint file deleted (upload complete)');
        }
        
        // Final summary
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);
        
        log('=== UPLOAD COMPLETE ===');
        log(`Total time: ${duration} seconds`);
        log(`Season stats: ${seasonResults.successCount} uploaded, ${seasonResults.errorCount} errors`);
        log(`Weekly stats: ${weeklyResults.successCount} uploaded, ${weeklyResults.errorCount} errors`);
        
        if (verification) {
            log(`Verification: ${verification.seasonStatsCount} season docs, ${verification.weeklyStatsCount} weekly docs`);
        }
        
        const totalErrors = seasonResults.errorCount + weeklyResults.errorCount;
        if (totalErrors > 0) {
            log(`⚠️  ${totalErrors} total errors occurred. Check ${ERROR_LOG_FILE} for details.`);
        } else {
            log('✅ All uploads completed successfully with no errors!');
        }
        
    } catch (error) {
        log(`❌ Fatal error: ${error.message}`);
        logError(error, 'Main upload function');
        process.exit(1);
    }
}

// Run the upload
uploadAllData()
    .then(() => {
        log('🎉 Firebase upload process completed!');
        process.exit(0);
    })
    .catch((error) => {
        log(`❌ Fatal error: ${error.message}`);
        process.exit(1);
    });
