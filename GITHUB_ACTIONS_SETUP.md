# GitHub Actions Setup Guide

This guide will help you set up the NFL Player Stats Pipeline to run automatically on GitHub Actions.

## Prerequisites

1. **GitHub Repository**: Your code should be in a GitHub repository
2. **Firebase Project**: You need a Firebase project with Firestore enabled
3. **Firebase Service Account**: You need service account credentials

## Step 1: Create Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file
6. **Keep this file secure** - it contains sensitive credentials

## Step 2: Set Up GitHub Secrets

In your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add these three secrets:

### Required Secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `FIREBASE_PROJECT_ID` | `your-project-id` | Your Firebase project ID |
| `FIREBASE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...` | The private key from your service account JSON |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com` | The client email from your service account JSON |

### How to Extract Values from Service Account JSON:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",           // ← FIREBASE_PROJECT_ID
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",  // ← FIREBASE_PRIVATE_KEY
  "client_email": "firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com",  // ← FIREBASE_CLIENT_EMAIL
  "client_id": "...",
  "auth_uri": "...",
  "token_uri": "...",
  "auth_provider_x509_cert_url": "...",
  "client_x509_cert_url": "..."
}
```

**Important**: For the private key, copy the entire value including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines.

## Step 3: Workflow Files

The repository includes two workflow files:

### 1. `nfl-player-stats-pipeline.yml` - Full Historical Data
- **Purpose**: Fetch ALL player stats since 1999 (one-time or manual runs)
- **Trigger**: Manual via GitHub Actions UI
- **Data Volume**: ~1.8 million documents
- **Runtime**: ~2-4 hours

### 2. `nfl-weekly-update.yml` - Current Season Updates
- **Purpose**: Update current season data weekly
- **Trigger**: Every Monday at 2 AM UTC (automatic)
- **Data Volume**: ~50,000 documents (current season only)
- **Runtime**: ~30-60 minutes

## Step 4: Running the Workflows

### Manual Full Pipeline Run:

1. Go to your repository on GitHub
2. Click **Actions** tab
3. Select **NFL Player Stats Pipeline**
4. Click **Run workflow**
5. Optionally customize:
   - **Seasons**: Year range (e.g., "2020:2024")
   - **Season Type**: "REG" or "REG+POST"
6. Click **Run workflow**

### Automatic Weekly Updates:

The weekly update runs automatically every Monday at 2 AM UTC. You can also trigger it manually:

1. Go to **Actions** → **NFL Weekly Update**
2. Click **Run workflow**
3. Optionally specify a different season year
4. Click **Run workflow**

## Step 5: Monitoring Runs

### Viewing Progress:

1. Go to **Actions** tab in your repository
2. Click on a workflow run to see progress
3. Click on individual jobs to see detailed logs
4. Each step shows real-time progress

### Artifacts:

After each run, you can download:
- **Pipeline logs**: Detailed logs from R and Node.js scripts
- **CSV files**: The actual data files (for full pipeline runs)
- **Error logs**: Any errors that occurred during upload

### Log Files:

- `nfl_player_stats_log.txt`: R script execution log
- `upload_errors.json`: Firebase upload errors (if any)
- `upload_checkpoint.json`: Resume checkpoint (if upload was interrupted)

## Step 6: Troubleshooting

### Common Issues:

1. **Firebase Authentication Errors**:
   - Check that all three secrets are set correctly
   - Verify the private key includes newlines (`\n`)
   - Ensure the service account has Firestore permissions

2. **Memory Issues**:
   - The full pipeline uses ~4GB RAM
   - GitHub Actions provides 7GB, so this should be sufficient
   - If issues persist, try smaller season ranges

3. **Timeout Issues**:
   - Full pipeline can take 2-4 hours
   - GitHub Actions has a 6-hour limit
   - If it times out, the checkpoint system will allow resuming

4. **Rate Limiting**:
   - Firebase has rate limits
   - The script includes delays between batches
   - If you hit limits, increase `BATCH_DELAY` in the Node.js script

### Resuming Failed Uploads:

If a workflow fails during upload:
1. The checkpoint system automatically saves progress
2. Simply re-run the workflow
3. It will resume from where it left off

### Checking Firebase:

After a successful run:
1. Go to your Firebase Console
2. Navigate to **Firestore Database**
3. You should see two collections:
   - `season_stats` (~50,000 documents)
   - `weekly_stats` (~850,000 documents for full run)

## Step 7: Customization

### Modifying Schedules:

Edit `.github/workflows/nfl-weekly-update.yml`:
```yaml
schedule:
  - cron: '0 2 * * 1'  # Every Monday at 2 AM UTC
```

Cron format: `minute hour day month day-of-week`
- `0 2 * * 1` = Every Monday at 2 AM UTC
- `0 6 * * 0` = Every Sunday at 6 AM UTC
- `0 0 1 * *` = First day of every month at midnight UTC

### Modifying Batch Settings:

Edit `upload_player_stats_to_firebase.js`:
```javascript
const BATCH_SIZE = 500;     // Documents per batch
const BATCH_DELAY = 750;    // Delay between batches (ms)
```

### Adding Notifications:

Add to workflow files:
```yaml
- name: Notify on success
  if: success()
  run: |
    # Add your notification logic here
    # e.g., send email, Slack message, etc.
```

## Security Best Practices

1. **Never commit secrets**: All sensitive data should be in GitHub Secrets
2. **Rotate credentials**: Regularly rotate your Firebase service account keys
3. **Limit permissions**: Give the service account only necessary Firestore permissions
4. **Monitor usage**: Check Firebase usage and billing regularly

## Cost Considerations

### GitHub Actions:
- **Free tier**: 2,000 minutes/month for private repos
- **Full pipeline**: ~240 minutes (4 hours)
- **Weekly updates**: ~60 minutes
- **Monthly cost**: ~300 minutes for weekly updates

### Firebase:
- **Firestore writes**: $0.18 per 100,000 writes
- **Full pipeline**: ~1.8M writes = ~$3.24
- **Weekly updates**: ~50K writes = ~$0.09
- **Monthly cost**: ~$0.36 for weekly updates

**Total estimated monthly cost**: ~$0.36 (Firebase) + GitHub Actions usage
