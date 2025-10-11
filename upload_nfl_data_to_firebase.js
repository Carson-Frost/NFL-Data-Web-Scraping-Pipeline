// upload_nfl_data_to_firebase.js
// This script uploads NFL data files to Firestore
// with batch processing, checkpoint recovery, and error handling

require('dotenv').config();
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Configuration
const BATCH_SIZE = 50; // Smaller batch size to avoid timeout issues
const BATCH_DELAY = parseInt(process.env.BATCH_DELAY_SECONDS || '2') * 1000; // 2 second delay
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3'); // Maximum retry attempts for failed batches
const RETRY_DELAY = 5000; // Delay before retrying failed batches (5 seconds)
const CHECKPOINT_FILE = './upload_checkpoint.json';
const ERROR_LOG_FILE = './upload_errors.json';

// Data directories
const DATA_DIRS = {
  season_stats: './data_output/season_stats',
  weekly_stats: './data_output/weekly_stats',
  roster_data: './data_output/roster_data'
};

// Check if environment variables are loaded
if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.error('❌ Missing Firebase environment variables!');
    console.error('Please ensure .env file exists with FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL');
    process.exit(1);
}

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
});

const db = admin.firestore();

// Configure Firebase for better performance
db.settings({
    ignoreUndefinedProperties: true
});

// Test Firebase connection
async function testFirebaseConnection() {
    try {
        log('Testing Firebase connection...');
        const testDoc = db.collection('_test').doc('connection_test');
        await testDoc.set({ test: true, timestamp: new Date() });
        log('✓ Firebase connection successful');
        return true;
    } catch (error) {
        log(`✗ Firebase connection failed: ${error.message}`);
        return false;
    }
}

// Logging function
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

// Sleep function for rate limiting
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry function with exponential backoff
async function retryWithBackoff(fn, maxRetries = MAX_RETRIES, baseDelay = RETRY_DELAY) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }
            
            // Handle specific Firebase quota errors
            if (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('Quota exceeded')) {
                const delay = baseDelay * Math.pow(3, attempt - 1); // Longer delays for quota issues
                log(`Quota exceeded on attempt ${attempt}, waiting ${delay}ms before retry...`);
                await sleep(delay);
            } else {
                const delay = baseDelay * Math.pow(2, attempt - 1);
                log(`Attempt ${attempt} failed, retrying in ${delay}ms: ${error.message}`);
                await sleep(delay);
            }
        }
    }
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

// Create document ID for roster data
function createRosterDocId(row) {
    return `${row.season}_${row.gsis_id}`;
}

// Find all files matching pattern in a directory
function findMostRecentFiles(directory, pattern) {
    if (!fs.existsSync(directory)) {
        return [];
    }
    
    const files = fs.readdirSync(directory)
        .filter(file => file.match(pattern))
        .map(file => ({
            name: file,
            path: path.join(directory, file),
            mtime: fs.statSync(path.join(directory, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);
    
    return files;
}

// Find the most recent file in a directory
function findMostRecentFile(directory, pattern) {
    if (!fs.existsSync(directory)) {
        return null;
    }
    
    const files = fs.readdirSync(directory)
        .filter(file => file.match(pattern))
        .map(file => ({
            name: file,
            path: path.join(directory, file),
            mtime: fs.statSync(path.join(directory, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);
    
    return files.length > 0 ? files[0] : null;
}

// Process data upload for a specific collection
async function uploadData(data, collectionName, docIdFunction, checkpoint, dataType) {
    log(`Starting ${dataType} upload...`);
    
    const totalRecords = data.length;
    const startIndex = checkpoint?.[dataType]?.lastIndex || 0;
    const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);
    const startBatch = Math.floor(startIndex / BATCH_SIZE);
    
    log(`${dataType}: ${totalRecords} records, starting from index ${startIndex}`);
    log(`Total batches: ${totalBatches}, starting from batch ${startBatch + 1}`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let batchIndex = startBatch; batchIndex < totalBatches; batchIndex++) {
        const startIdx = batchIndex * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, totalRecords);
        const batch = data.slice(startIdx, endIdx);
        
        try {
            await retryWithBackoff(async () => {
                const writeBatch = db.batch();
                
                for (const row of batch) {
                    const docId = docIdFunction(row);
                    const docData = convertRowToDocument(row);
                    const docRef = db.collection(collectionName).doc(docId);
                    writeBatch.set(docRef, docData);
                }
                
                await writeBatch.commit();
            });
            
            successCount += batch.length;
            
            // Update checkpoint
            const newCheckpoint = {
                ...checkpoint,
                [dataType]: {
                    lastIndex: endIdx,
                    completed: endIdx >= totalRecords
                },
                lastUpdate: new Date().toISOString()
            };
            writeCheckpoint(newCheckpoint);
            
            const progress = ((batchIndex + 1) / totalBatches * 100).toFixed(1);
            log(`${dataType}: Batch ${batchIndex + 1}/${totalBatches} complete (${progress}%) - ${successCount} records uploaded`);
            
            // Rate limiting
            if (batchIndex < totalBatches - 1) {
                await sleep(BATCH_DELAY);
            }
            
        } catch (error) {
            errorCount += batch.length;
            logError(error, `${dataType} batch ${batchIndex + 1} (records ${startIdx}-${endIdx})`);
            log(`Error in ${dataType} batch ${batchIndex + 1}: ${error.message}`);
            
            // Continue with next batch instead of failing completely
            continue;
        }
    }
    
    log(`${dataType} upload complete: ${successCount} successful, ${errorCount} errors`);
    return { successCount, errorCount };
}

// Verify upload by counting documents
async function verifyUpload() {
    log('Verifying upload...');
    
    try {
        const seasonStatsSnapshot = await db.collection('season_stats').get();
        const weeklyStatsSnapshot = await db.collection('weekly_stats').get();
        const rosterDataSnapshot = await db.collection('roster_data').get();
        
        log(`Verification results:`);
        log(`  - Season stats documents: ${seasonStatsSnapshot.size}`);
        log(`  - Weekly stats documents: ${weeklyStatsSnapshot.size}`);
        log(`  - Roster data documents: ${rosterDataSnapshot.size}`);
        
        return {
            seasonStatsCount: seasonStatsSnapshot.size,
            weeklyStatsCount: weeklyStatsSnapshot.size,
            rosterDataCount: rosterDataSnapshot.size
        };
        
    } catch (error) {
        log(`Error during verification: ${error.message}`);
        return null;
    }
}

// Main upload function
async function uploadAllData() {
    const startTime = Date.now();
    log('🚀 Starting NFL Data Firebase upload...');
    log(`Configuration: Batch size=${BATCH_SIZE}, Delay=${BATCH_DELAY/1000}s, Max retries=${MAX_RETRIES}`);
    
    // Test Firebase connection first
    const connectionOk = await testFirebaseConnection();
    if (!connectionOk) {
        log('❌ Cannot proceed without Firebase connection');
        process.exit(1);
    }
    
    try {
        // Read checkpoint
        const checkpoint = readCheckpoint();
        if (checkpoint) {
            log(`Resuming from checkpoint: ${checkpoint.lastUpdate}`);
        } else {
            log('No checkpoint found, starting fresh upload');
        }
        
        // Find files to upload
        const filesToUpload = {};
        
        // Check for season data files (now supports multiple files per year)
        const seasonFiles = findMostRecentFiles(DATA_DIRS.season_stats, /season_data_.*\.csv$/);
        if (seasonFiles.length > 0) {
            filesToUpload.season_stats = seasonFiles;
            log(`Found ${seasonFiles.length} season data files:`);
            seasonFiles.forEach(file => log(`  - ${file.name}`));
        }
        
        // Check for weekly data files
        const weeklyFile = findMostRecentFile(DATA_DIRS.weekly_stats, /weekly_data_.*\.csv$/);
        if (weeklyFile) {
            filesToUpload.weekly_stats = weeklyFile;
            log(`Found weekly data file: ${weeklyFile.name}`);
        }
        
        // Check for roster data files
        const rosterFile = findMostRecentFile(DATA_DIRS.roster_data, /roster_data_.*\.csv$/);
        if (rosterFile) {
            filesToUpload.roster_data = rosterFile;
            log(`Found roster data file: ${rosterFile.name}`);
        }
        
        if (Object.keys(filesToUpload).length === 0) {
            log('❌ No data files found to upload');
            log('Make sure you have run one of the R scripts first to generate data files');
            process.exit(1);
        }
        
        // Parse CSV files
        log('Parsing CSV files...');
        const dataSets = {};
        
        for (const [dataType, fileInfo] of Object.entries(filesToUpload)) {
            if (Array.isArray(fileInfo)) {
                // Multiple files (like season data)
                log(`Parsing ${dataType} from ${fileInfo.length} files...`);
                const allData = [];
                for (const file of fileInfo) {
                    log(`  Parsing ${file.name}...`);
                    const fileData = await parseCSV(file.path);
                    allData.push(...fileData);
                }
                dataSets[dataType] = allData;
                log(`Parsed ${dataSets[dataType].length} total ${dataType} records from ${fileInfo.length} files`);
            } else {
                // Single file
                log(`Parsing ${dataType} from ${fileInfo.name}...`);
                dataSets[dataType] = await parseCSV(fileInfo.path);
                log(`Parsed ${dataSets[dataType].length} ${dataType} records`);
            }
        }
        
        // Upload data
        const results = {};
        
        // Upload season stats (if not already complete and file exists)
        if (filesToUpload.season_stats && !checkpoint?.season_stats?.completed) {
            results.season_stats = await uploadData(
                dataSets.season_stats, 
                'season_stats', 
                createSeasonDocId, 
                checkpoint, 
                'season_stats'
            );
        } else if (filesToUpload.season_stats) {
            log('Season stats already complete, skipping...');
            results.season_stats = { successCount: 0, errorCount: 0 };
        }
        
        // Upload weekly stats (if not already complete and file exists)
        if (filesToUpload.weekly_stats && !checkpoint?.weekly_stats?.completed) {
            results.weekly_stats = await uploadData(
                dataSets.weekly_stats, 
                'weekly_stats', 
                createWeeklyDocId, 
                checkpoint, 
                'weekly_stats'
            );
        } else if (filesToUpload.weekly_stats) {
            log('Weekly stats already complete, skipping...');
            results.weekly_stats = { successCount: 0, errorCount: 0 };
        }
        
        // Upload roster data (if not already complete and file exists)
        if (filesToUpload.roster_data && !checkpoint?.roster_data?.completed) {
            results.roster_data = await uploadData(
                dataSets.roster_data, 
                'roster_data', 
                createRosterDocId, 
                checkpoint, 
                'roster_data'
            );
        } else if (filesToUpload.roster_data) {
            log('Roster data already complete, skipping...');
            results.roster_data = { successCount: 0, errorCount: 0 };
        }
        
        // Verify upload
        const verification = await verifyUpload();
        
        // Clean up checkpoint file if everything is complete
        const seasonComplete = !filesToUpload.season_stats || checkpoint?.season_stats?.completed;
        const weeklyComplete = !filesToUpload.weekly_stats || checkpoint?.weekly_stats?.completed;
        const rosterComplete = !filesToUpload.roster_data || checkpoint?.roster_data?.completed;
        
        if (seasonComplete && weeklyComplete && rosterComplete) {
            if (fs.existsSync(CHECKPOINT_FILE)) {
                fs.unlinkSync(CHECKPOINT_FILE);
                log('Checkpoint file deleted (upload complete)');
            }
        }
        
        // Final summary
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);
        
        log('=== UPLOAD COMPLETE ===');
        log(`Total time: ${duration} seconds`);
        
        for (const [dataType, result] of Object.entries(results)) {
            log(`${dataType}: ${result.successCount} uploaded, ${result.errorCount} errors`);
        }
        
        if (verification) {
            log(`Verification: ${verification.seasonStatsCount} season docs, ${verification.weeklyStatsCount} weekly docs, ${verification.rosterDataCount} roster docs`);
        }
        
        const totalErrors = Object.values(results).reduce((sum, result) => sum + result.errorCount, 0);
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
