// upload_data.js
// This script uploads NFL data files to MongoDB Atlas
// with batch processing and error handling
//
// Usage: node upload_data.js <data_type>
// Data types: season, weekly, roster
// Example: node upload_data.js season

require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Configuration
const BATCH_SIZE = 100; // MongoDB can handle larger batches than Firestore
const BATCH_DELAY = parseInt(process.env.BATCH_DELAY_SECONDS || '1') * 1000; // 1 second delay
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3'); // Maximum retry attempts for failed batches
const RETRY_DELAY = 3000; // Delay before retrying failed batches (3 seconds)

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
    console.log('Error: No data type specified');
    console.log('');
    console.log('Usage: node upload_data.js <data_type>');
    console.log('');
    console.log('Valid data types:');
    console.log('  season  - Upload season statistics data');
    console.log('  weekly  - Upload weekly statistics data');
    console.log('  roster  - Upload roster data');
    console.log('');
    console.log('Examples:');
    console.log('  node upload_data.js season');
    console.log('  node upload_data.js weekly');
    console.log('  node upload_data.js roster');
    process.exit(1);
  }
  
  const dataType = args[0].toLowerCase();
  
  if (!VALID_DATA_TYPES.includes(dataType)) {
    console.log(`Error: Invalid data type "${dataType}"`);
    console.log('');
    console.log('Valid data types are: ' + VALID_DATA_TYPES.join(', '));
    process.exit(1);
  }
  
  return dataType;
}

// Check if environment variables are loaded
if (!process.env.MONGODB_URI || !process.env.MONGODB_DATABASE) {
    console.error('Missing MongoDB environment variables!');
    console.error('Please ensure .env file exists with MONGODB_URI and MONGODB_DATABASE');
    process.exit(1);
}

let client;
let db;

// Initialize MongoDB connection
async function initializeMongoDB() {
    try {
        log('Connecting to MongoDB...');
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        db = client.db(process.env.MONGODB_DATABASE);
        
        // Test connection
        await db.admin().ping();
        log('MongoDB connection successful');
        return true;
    } catch (error) {
        log(`MongoDB connection failed: ${error.message}`);
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
            
            const delay = baseDelay * Math.pow(2, attempt - 1);
            log(`Attempt ${attempt} failed, retrying in ${delay}ms: ${error.message}`);
            await sleep(delay);
        }
    }
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

// Convert CSV row to MongoDB document
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

// Process data upload for a specific collection
async function uploadData(data, collectionName, docIdFunction, dataType) {
    log(`Starting ${dataType} upload...`);
    
    const totalRecords = data.length;
    const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);
    
    log(`${dataType}: ${totalRecords} records, uploading in ${totalBatches} batches`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIdx = batchIndex * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, totalRecords);
        const batch = data.slice(startIdx, endIdx);
        
        try {
            await retryWithBackoff(async () => {
                // Convert batch to MongoDB documents
                const documents = batch.map(row => {
                    const docId = docIdFunction(row);
                    const docData = convertRowToDocument(row);
                    return {
                        _id: docId,
                        ...docData
                    };
                });
                
                // Use upsert to handle duplicates
                const collection = db.collection(collectionName);
                const operations = documents.map(doc => ({
                    replaceOne: {
                        filter: { _id: doc._id },
                        replacement: doc,
                        upsert: true
                    }
                }));
                
                await collection.bulkWrite(operations);
            });
            
            successCount += batch.length;
            
            const progress = ((batchIndex + 1) / totalBatches * 100).toFixed(1);
            log(`${dataType}: Batch ${batchIndex + 1}/${totalBatches} complete (${progress}%) - ${successCount} records uploaded`);
            
            // Rate limiting
            if (batchIndex < totalBatches - 1) {
                await sleep(BATCH_DELAY);
            }
            
        } catch (error) {
            errorCount += batch.length;
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
        const count = await db.collection(collectionName).countDocuments();
        
        log(`Verification results:`);
        log(`  - ${dataType} documents: ${count}`);
        
        return {
            [dataType]: count
        };
        
    } catch (error) {
        log(`Error during verification: ${error.message}`);
        return null;
    }
}

// Main upload function
async function uploadAllData(selectedDataType) {
    const startTime = Date.now();
    log(`Starting NFL Data MongoDB upload for ${selectedDataType}...`);
    log(`Configuration: Batch size=${BATCH_SIZE}, Delay=${BATCH_DELAY/1000}s, Max retries=${MAX_RETRIES}`);
    
    // Initialize MongoDB connection first
    const connectionOk = await initializeMongoDB();
    if (!connectionOk) {
        log('Cannot proceed without MongoDB connection');
        process.exit(1);
    }
    
    try {
        // Map data type to directory and collection info
        const dataTypeMap = {
            'season': {
                dir: DATA_DIRS.season_stats,
                pattern: /season_data_.*\.csv$/,
                collection: 'season_stats',
                docIdFunction: createSeasonDocId
            },
            'weekly': {
                dir: DATA_DIRS.weekly_stats,
                pattern: /weekly_data_.*\.csv$/,
                collection: 'weekly_stats',
                docIdFunction: createWeeklyDocId
            },
            'roster': {
                dir: DATA_DIRS.roster_data,
                pattern: /roster_data_.*\.csv$/,
                collection: 'roster_data',
                docIdFunction: createRosterDocId
            }
        };
        
        const dataTypeInfo = dataTypeMap[selectedDataType];
        
        // Find files to upload for the selected data type
        const files = findMostRecentFiles(dataTypeInfo.dir, dataTypeInfo.pattern);
        
        if (files.length === 0) {
            log(`No ${selectedDataType} data files found to upload`);
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
        const result = await uploadData(
            allData, 
            dataTypeInfo.collection, 
            dataTypeInfo.docIdFunction, 
            selectedDataType
        );
        
        // Verify upload
        const verification = await verifyUpload(selectedDataType);
        
        // Final summary
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);
        
        log('=== UPLOAD COMPLETE ===');
        log(`Total time: ${duration} seconds`);
        log(`${selectedDataType}: ${result.successCount} uploaded, ${result.errorCount} errors`);
        
        if (verification) {
            log(`Verification: ${verification[selectedDataType]} ${selectedDataType} documents`);
        }
        
        if (result.errorCount > 0) {
            log(`${result.errorCount} errors occurred during upload`);
        } else {
            log('Upload completed successfully with no errors!');
        }
        
    } catch (error) {
        log(`Fatal error: ${error.message}`);
        process.exit(1);
    } finally {
        // Close MongoDB connection
        if (client) {
            await client.close();
            log('MongoDB connection closed');
        }
    }
}

// Parse command line arguments and run the upload
const selectedDataType = parseArguments();

// Run the upload
uploadAllData(selectedDataType)
    .then(() => {
        log('MongoDB upload process completed!');
        process.exit(0);
    })
    .catch((error) => {
        log(`Fatal error: ${error.message}`);
        process.exit(1);
    });
