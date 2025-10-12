// upload_nfl_data_to_firebase.js
// This script uploads NFL data files to Firestore
// with batch processing, checkpoint recovery, and error handling
//
// Usage: node upload_nfl_data_to_firebase.js <data_type>
// Data types: season, weekly, roster
// Example: node upload_nfl_data_to_firebase.js season

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

// Valid data types
const VALID_DATA_TYPES = ['season', 'weekly', 'roster'];

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('❌ Error: No data type specified');
    console.log('');
    console.log('Usage: node upload_nfl_data_to_firebase.js <data_type>');
    console.log('');
    console.log('Valid data types:');
    console.log('  season  - Upload season statistics data');
    console.log('  weekly  - Upload weekly statistics data');
    console.log('  roster  - Upload roster data');
    console.log('');
    console.log('Examples:');
    console.log('  node upload_nfl_data_to_firebase.js season');
    console.log('  node upload_nfl_data_to_firebase.js weekly');
    console.log('  node upload_nfl_data_to_firebase.js roster');
    process.exit(1);
  }
  
  const dataType = args[0].toLowerCase();
  
  if (!VALID_DATA_TYPES.includes(dataType)) {
    console.log(`❌ Error: Invalid data type "${dataType}"`);
    console.log('');
    console.log('Valid data types are: ' + VALID_DATA_TYPES.join(', '));
    process.exit(1);
  }
  
  return dataType;
}

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
async function verifyUpload(dataType) {
    log(`Verifying ${dataType} upload...`);
    
    try {
        // Map data types to collection names
        const collectionMap = {
            'season': 'season_stats',
            'weekly': 'weekly_stats', 
            'roster': 'roster_data'
        };
        
        const collectionName = collectionMap[dataType];
        const snapshot = await db.collection(collectionName).get();
        
        log(`Verification results:`);
        log(`  - ${dataType} documents: ${snapshot.size}`);
        
        return {
            [dataType]: snapshot.size
        };
        
    } catch (error) {
        log(`Error during verification: ${error.message}`);
        return null;
    }
}

// Main upload function
async function uploadAllData(selectedDataType) {
    const startTime = Date.now();
    log(`🚀 Starting NFL Data Firebase upload for ${selectedDataType}...`);
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
        
        // Map data type to directory and collection info
        const dataTypeMap = {
            'season': {
                dir: DATA_DIRS.season_stats,
                pattern: /season_data_.*\.csv$/,
                collection: 'season_stats',
                docIdFunction: createSeasonDocId,
                checkpointKey: 'season_stats'
            },
            'weekly': {
                dir: DATA_DIRS.weekly_stats,
                pattern: /weekly_data_.*\.csv$/,
                collection: 'weekly_stats',
                docIdFunction: createWeeklyDocId,
                checkpointKey: 'weekly_stats'
            },
            'roster': {
                dir: DATA_DIRS.roster_data,
                pattern: /roster_data_.*\.csv$/,
                collection: 'roster_data',
                docIdFunction: createRosterDocId,
                checkpointKey: 'roster_data'
            }
        };
        
        const dataTypeInfo = dataTypeMap[selectedDataType];
        
        // Find files to upload for the selected data type
        const files = findMostRecentFiles(dataTypeInfo.dir, dataTypeInfo.pattern);
        
        if (files.length === 0) {
            log(`❌ No ${selectedDataType} data files found to upload`);
            log(`Make sure you have run the R script to generate ${selectedDataType} data files`);
            log(`Expected files in: ${dataTypeInfo.dir}`);
            process.exit(1);
        }
        
        log(`Found ${files.length} ${selectedDataType} data files:`);
        files.forEach(file => log(`  - ${file.name}`));
        
        // Parse CSV files
        log(`Parsing ${selectedDataType} CSV files...`);
        let allData = [];
        
        for (const file of files) {
            log(`  Parsing ${file.name}...`);
            const fileData = await parseCSV(file.path);
            allData.push(...fileData);
        }
        
        log(`Parsed ${allData.length} total ${selectedDataType} records from ${files.length} files`);
        
        // Upload data
        const results = {};
        
        // Check if already complete
        if (checkpoint?.[dataTypeInfo.checkpointKey]?.completed) {
            log(`${selectedDataType} data already complete, skipping...`);
            results[selectedDataType] = { successCount: 0, errorCount: 0 };
        } else {
            results[selectedDataType] = await uploadData(
                allData, 
                dataTypeInfo.collection, 
                dataTypeInfo.docIdFunction, 
                checkpoint, 
                dataTypeInfo.checkpointKey
            );
        }
        
        // Verify upload
        const verification = await verifyUpload(selectedDataType);
        
        // Clean up checkpoint file if upload is complete
        if (checkpoint?.[dataTypeInfo.checkpointKey]?.completed || results[selectedDataType].successCount > 0) {
            const allComplete = Object.keys(dataTypeMap).every(type => 
                checkpoint?.[dataTypeMap[type].checkpointKey]?.completed
            );
            
            if (allComplete && fs.existsSync(CHECKPOINT_FILE)) {
                fs.unlinkSync(CHECKPOINT_FILE);
                log('Checkpoint file deleted (all uploads complete)');
            }
        }
        
        // Final summary
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);
        
        log('=== UPLOAD COMPLETE ===');
        log(`Total time: ${duration} seconds`);
        
        const result = results[selectedDataType];
        log(`${selectedDataType}: ${result.successCount} uploaded, ${result.errorCount} errors`);
        
        if (verification) {
            log(`Verification: ${verification[selectedDataType]} ${selectedDataType} documents`);
        }
        
        if (result.errorCount > 0) {
            log(`⚠️  ${result.errorCount} errors occurred. Check ${ERROR_LOG_FILE} for details.`);
        } else {
            log('✅ Upload completed successfully with no errors!');
        }
        
    } catch (error) {
        log(`❌ Fatal error: ${error.message}`);
        logError(error, 'Main upload function');
        process.exit(1);
    }
}

// Parse command line arguments and run the upload
const selectedDataType = parseArguments();

// Run the upload
uploadAllData(selectedDataType)
    .then(() => {
        log('🎉 Firebase upload process completed!');
        process.exit(0);
    })
    .catch((error) => {
        log(`❌ Fatal error: ${error.message}`);
        process.exit(1);
    });
