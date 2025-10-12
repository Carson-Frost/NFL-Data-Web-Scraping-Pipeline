#!/usr/bin/env node

/**
 * Delete Firestore Collection Script
 * 
 * Purpose: Safely deletes all documents in a Firestore collection in batches
 * to avoid Firestore limits and fatal errors.
 * 
 * Usage: node delete_firestore_collection.js [collection_name]
 * 
 * Example: node delete_firestore_collection.js season_stats
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Load environment variables from .env file
require('dotenv').config();

// Configuration
const BATCH_SIZE = 100; // Reduced batch size to avoid quota limits
const BATCH_DELAY = 2000; // 2 second delay between batches
const DEFAULT_COLLECTIONS = ['season_stats', 'weekly_stats', 'roster_data'];

// Initialize Firebase Admin SDK
function initializeFirebase() {
    try {
        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL
        };

        if (!serviceAccount.projectId || !serviceAccount.privateKey || !serviceAccount.clientEmail) {
            throw new Error('Missing Firebase environment variables');
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        console.log('Firebase Admin SDK initialized');
        return admin.firestore();
    } catch (error) {
        console.error('Failed to initialize Firebase:', error.message);
        process.exit(1);
    }
}

// Create readline interface for user input
function createReadlineInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

// Ask user for confirmation
function askConfirmation(collectionName, docCount) {
    return new Promise((resolve) => {
        const rl = createReadlineInterface();
        
        console.log('\nWARNING: This will PERMANENTLY DELETE all documents!');
        console.log(`Collection: ${collectionName}`);
        console.log(`Documents to delete: ${docCount}`);
        console.log('\nThis action cannot be undone!');
        
        rl.question('\nType "DELETE" to confirm (case sensitive): ', (answer) => {
            rl.close();
            resolve(answer === 'DELETE');
        });
    });
}

// Ask user for confirmation without document count
function askConfirmationWithoutCount(collectionName) {
    return new Promise((resolve) => {
        const rl = createReadlineInterface();
        
        console.log('\nWARNING: This will PERMANENTLY DELETE all documents!');
        console.log(`Collection: ${collectionName}`);
        console.log('\nThis action cannot be undone!');
        
        rl.question('\nType "DELETE" to confirm (case sensitive): ', (answer) => {
            rl.close();
            resolve(answer === 'DELETE');
        });
    });
}

// Count documents in collection
async function countDocuments(db, collectionName) {
    try {
        console.log(`Counting documents in collection: ${collectionName}`);
        
        // Use a smaller limit and count in batches to avoid quota issues
        let totalCount = 0;
        let lastDoc = null;
        
        while (true) {
            let query = db.collection(collectionName).limit(1000);
            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }
            
            const snapshot = await query.get();
            
            if (snapshot.empty) {
                break;
            }
            
            totalCount += snapshot.size;
            lastDoc = snapshot.docs[snapshot.docs.length - 1];
            
            console.log(`Counted ${totalCount} documents so far...`);
            
            // Small delay to avoid quota issues
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(`Found ${totalCount} documents in ${collectionName}`);
        return totalCount;
    } catch (error) {
        console.error(`Error counting documents in ${collectionName}:`, error.message);
        throw error;
    }
}

// Delete documents in batches
async function deleteCollectionInBatches(db, collectionName) {
    const startTime = Date.now();
    let totalDeleted = 0;
    let batchCount = 0;
    
    try {
        console.log(`\nStarting batch deletion of ${collectionName}...`);
        
        while (true) {
            // Get batch of documents
            const snapshot = await db.collection(collectionName)
                .limit(BATCH_SIZE)
                .get();
            
            if (snapshot.empty) {
                break; // No more documents
            }
            
            batchCount++;
            console.log(`Processing batch ${batchCount} (${snapshot.size} documents)...`);
            
            // Create batch write
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Commit batch
            await batch.commit();
            
            totalDeleted += snapshot.size;
            console.log(`Deleted ${snapshot.size} documents (Total: ${totalDeleted})`);
            
            // Delay between batches to avoid quota limits
            if (!snapshot.empty) {
                console.log(`Waiting ${BATCH_DELAY/1000} seconds before next batch...`);
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\nCollection deleted successfully!`);
        console.log(`Total documents deleted: ${totalDeleted}`);
        console.log(`Time taken: ${duration} seconds`);
        console.log(`Batches processed: ${batchCount}`);
        
    } catch (error) {
        console.error(`Error deleting collection ${collectionName}:`, error.message);
        throw error;
    }
}

// List available collections
async function listCollections(db) {
    try {
        console.log('\nAvailable collections:');
        const collections = await db.listCollections();
        
        if (collections.length === 0) {
            console.log('   No collections found');
            return [];
        }
        
        const collectionNames = [];
        for (const collection of collections) {
            const count = await countDocuments(db, collection.id);
            console.log(`   • ${collection.id} (${count} documents)`);
            collectionNames.push(collection.id);
        }
        
        return collectionNames;
    } catch (error) {
        console.error('Error listing collections:', error.message);
        return [];
    }
}

// Main function
async function main() {
    console.log('Firestore Collection Deletion Tool');
    console.log('=====================================\n');
    
    // Get collection name from command line or prompt user
    const collectionName = process.argv[2];
    
    // Initialize Firebase
    const db = initializeFirebase();
    
    try {
        let targetCollection = collectionName;
        
        // If no collection specified, show available collections
        if (!targetCollection) {
            console.log('No collection specified. Available collections:');
            const availableCollections = await listCollections(db);
            
            if (availableCollections.length === 0) {
                console.log('\nNo collections found. Nothing to delete.');
                process.exit(0);
            }
            
            // Prompt user to select collection
            const rl = createReadlineInterface();
            rl.question('\nEnter collection name to delete: ', async (input) => {
                rl.close();
                
                if (!input.trim()) {
                    console.log('No collection name provided. Exiting.');
                    process.exit(1);
                }
                
                await deleteCollection(db, input.trim());
            });
            
            return; // Exit early for interactive mode
        }
        
        // Direct mode with collection name provided
        await deleteCollection(db, targetCollection);
        
    } catch (error) {
        console.error('Script failed:', error.message);
        process.exit(1);
    }
}

// Delete collection workflow
async function deleteCollection(db, collectionName) {
    try {
        console.log(`Checking if collection '${collectionName}' exists...`);
        
        // Simple check if collection exists by trying to get one document
        try {
            const snapshot = await db.collection(collectionName).limit(1).get();
            
            if (snapshot.empty) {
                console.log(`Collection '${collectionName}' is already empty or doesn't exist.`);
                return;
            }
            
            console.log(`Collection '${collectionName}' exists. Proceeding with deletion...`);
            
            // Skip counting for now to avoid quota issues - just proceed with deletion
            // Ask for confirmation without exact count
            const confirmed = await askConfirmationWithoutCount(collectionName);
            
            if (!confirmed) {
                console.log('Deletion cancelled by user.');
                return;
            }
            
            // Proceed with deletion
            await deleteCollectionInBatches(db, collectionName);
            
        } catch (quotaError) {
            if (quotaError.code === 8) { // RESOURCE_EXHAUSTED
                console.log('Firebase quota exceeded. Please wait a few minutes and try again.');
                console.log('This usually happens when you have made many requests recently.');
                return;
            }
            throw quotaError;
        }
        
    } catch (error) {
        console.error(`Error processing collection ${collectionName}:`, error.message);
        throw error;
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n\nProcess interrupted by user. Exiting safely...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\nProcess terminated. Exiting safely...');
    process.exit(0);
});

// Run the script
if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = { deleteCollectionInBatches, countDocuments };
