// delete_mongodb_collection.js
// This script deletes MongoDB collections
// Similar to the Firebase version but for MongoDB Atlas
//
// Usage: node delete_mongodb_collection.js <collection_name>
// Collection names: season_stats, weekly_stats, roster_data, or 'all'
// Example: node delete_mongodb_collection.js season_stats
// Example: node delete_mongodb_collection.js all

require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Configuration

// Valid collection names
const VALID_COLLECTIONS = ['season_stats', 'weekly_stats', 'roster_data', 'all'];

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('❌ Error: No collection specified');
    console.log('');
    console.log('Usage: node delete_mongodb_collection.js <collection_name>');
    console.log('');
    console.log('Valid collection names:');
    console.log('  season_stats  - Delete season statistics collection');
    console.log('  weekly_stats  - Delete weekly statistics collection');
    console.log('  roster_data   - Delete roster data collection');
    console.log('  all          - Delete all collections');
    console.log('');
    console.log('Examples:');
    console.log('  node delete_mongodb_collection.js season_stats');
    console.log('  node delete_mongodb_collection.js all');
    process.exit(1);
  }
  
  const collectionName = args[0].toLowerCase();
  
  if (!VALID_COLLECTIONS.includes(collectionName)) {
    console.log(`❌ Error: Invalid collection name "${collectionName}"`);
    console.log('');
    console.log('Valid collection names are: ' + VALID_COLLECTIONS.join(', '));
    process.exit(1);
  }
  
  return collectionName;
}

// Check if environment variables are loaded
if (!process.env.MONGODB_URI || !process.env.MONGODB_DATABASE) {
    console.error('❌ Missing MongoDB environment variables!');
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
        log('✓ MongoDB connection successful');
        return true;
    } catch (error) {
        log(`✗ MongoDB connection failed: ${error.message}`);
        return false;
    }
}

// Logging function
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

// Get collection statistics
async function getCollectionStats(collectionName) {
    try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        return count;
    } catch (error) {
        log(`Error getting stats for ${collectionName}: ${error.message}`);
        return 0;
    }
}

// Delete a specific collection
async function deleteCollection(collectionName) {
    try {
        log(`Deleting collection: ${collectionName}`);
        
        // Get document count before deletion
        const count = await getCollectionStats(collectionName);
        log(`Collection ${collectionName} contains ${count} documents`);
        
        if (count === 0) {
            log(`Collection ${collectionName} is already empty`);
        }
        
        // Drop the collection
        await db.collection(collectionName).drop();
        log(`✓ Successfully deleted collection: ${collectionName}`);
        
        return { success: true, deletedCount: count };
        
    } catch (error) {
        if (error.code === 26) {
            // Collection doesn't exist
            log(`Collection ${collectionName} does not exist`);
            return { success: true, deletedCount: 0 };
        } else {
            log(`✗ Error deleting collection ${collectionName}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

// Delete all collections
async function deleteAllCollections() {
    const collections = ['season_stats', 'weekly_stats', 'roster_data'];
    const results = {};
    
    log('Deleting all NFL data collections...');
    
    for (const collectionName of collections) {
        results[collectionName] = await deleteCollection(collectionName);
    }
    
    return results;
}

// Main deletion function
async function deleteMongoDBData(selectedCollection) {
    const startTime = Date.now();
    log(`🗑️  Starting MongoDB collection deletion for: ${selectedCollection}`);
    
    // Initialize MongoDB connection first
    const connectionOk = await initializeMongoDB();
    if (!connectionOk) {
        log('❌ Cannot proceed without MongoDB connection');
        process.exit(1);
    }
    
    try {
        let results = {};
        
        if (selectedCollection === 'all') {
            results = await deleteAllCollections();
        } else {
            results[selectedCollection] = await deleteCollection(selectedCollection);
        }
        
        // Final summary
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);
        
        log('=== DELETION COMPLETE ===');
        log(`Total time: ${duration} seconds`);
        
        let totalDeleted = 0;
        let successCount = 0;
        let errorCount = 0;
        
        for (const [collection, result] of Object.entries(results)) {
            if (result.success) {
                successCount++;
                totalDeleted += result.deletedCount;
                log(`✓ ${collection}: ${result.deletedCount} documents deleted`);
            } else {
                errorCount++;
                log(`✗ ${collection}: Error - ${result.error}`);
            }
        }
        
        log(`Summary: ${successCount} collections processed, ${totalDeleted} total documents deleted`);
        
        if (errorCount > 0) {
            log(`⚠️  ${errorCount} errors occurred during deletion`);
        } else {
            log('✅ All deletions completed successfully!');
        }
        
    } catch (error) {
        log(`❌ Fatal error: ${error.message}`);
        process.exit(1);
    } finally {
        // Close MongoDB connection
        if (client) {
            await client.close();
            log('MongoDB connection closed');
        }
    }
}

// Parse command line arguments and run the deletion
const selectedCollection = parseArguments();

// Run the deletion
deleteMongoDBData(selectedCollection)
    .then(() => {
        log('🎉 MongoDB deletion process completed!');
        process.exit(0);
    })
    .catch((error) => {
        log(`❌ Fatal error: ${error.message}`);
        process.exit(1);
    });
