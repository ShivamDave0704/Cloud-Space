# Backup System Documentation

## Overview
The Backup System automatically archives expired plans, payments, and user data to maintain clean production databases while preserving historical records.

## Files Involved

### 1. **backup-Plan,payment,user.json**
Main backup archive file stored in `support/` directory.

**Structure:**
```json
{
  "version": "1.0",
  "createdAt": "ISO-8601-timestamp",
  "lastUpdated": "ISO-8601-timestamp",
  "expiredPlans": [
    {
      "_id": "PURCHASE-xxx",
      "uid": "USR-xxx",
      "plan": "platinum",
      "email": "user@example.com",
      "username": "User Name",
      "amount": 25000,
      "expiresAt": "2026-01-10T00:00:00.000Z",
      "archivedAt": "2026-01-10T00:05:23.456Z",
      "...otherPlanFields": "..."
    }
  ],
  "archivedPayments": [],
  "archivedUsers": [
    {
      "uid": "USR-xxx",
      "username": "User Name",
      "email": "user@example.com",
      "archivedAt": "2026-01-10T00:05:23.456Z",
      "...otherUserFields": "..."
    }
  ],
  "metadata": {
    "totalBackupedPlans": 5,
    "totalBackupedPayments": 0,
    "totalBackupedUsers": 3,
    "totalBackupSize": 45678
  }
}
```

## How It Works

### Automatic Backup on Plan Expiry

When a plan expires (`expiresAt` time has passed):

1. **Expiry Detection**: Every 30 seconds, the reminder scheduler checks if `msLeft < 0`
2. **Send Notification**: "Plan has expired" email is sent to the user
3. **Archive**: Plan details are moved to `backup-Plan,payment,user.json`
4. **Cleanup**: Plan is removed from `purchases.json`
5. **Update Metadata**: Backup counts are updated

**Code Flow:**
```
server-plans.js → scheduleTokenExpiryReminders() 
  → Every 30 seconds, loop through purchases
  → if (msLeft < 0 && !p.expiryEmailSent)
    → sendStyledMail() - "Plan has expired" email
    → moveExpiredPlanToBackup(p, users)
      → loadBackup()
      → Add plan to expiredPlans[]
      → Add related user to archivedUsers[]
      → Update metadata
      → saveBackup()
    → Remove from purchases.json via splice()
```

### Automatic Cleanup on Server Startup

When the server starts:

1. **Scan Purchases**: `cleanupExpiredPlansOnStartup()` is called
2. **Identify Expired**: Checks each purchase for `expiresAt < now`
3. **Archive & Remove**: Any expired plans are moved to backup
4. **Log Summary**: Shows count of archived plans

**Console Output Example:**
```
✅ Startup cleanup: moved 2 expired plans to backup (8 remaining)
📦 Archived expired plan: PURCHASE-1234 (platinum) for user USR-5678
```

## Key Functions

### `loadBackup()`
Loads backup file from disk, returns empty structure if file doesn't exist.

```javascript
const backup = loadBackup();
// Returns: { version, createdAt, lastUpdated, expiredPlans, archivedPayments, archivedUsers, metadata }
```

### `saveBackup(backup)`
Saves backup to disk with updated timestamp and metadata.

```javascript
saveBackup(backup);
// Updates lastUpdated timestamp and saves to file
```

### `moveExpiredPlanToBackup(plan, users)`
Archives a single expired plan and related user data.

```javascript
moveExpiredPlanToBackup(purchaseRecord, usersArray);
// Adds to backup, logs action, updates metadata
```

### `cleanupExpiredPlansOnStartup()`
Scans all purchases on server startup and moves any already-expired plans to backup.

```javascript
cleanupExpiredPlansOnStartup();
// Called automatically when scheduleTokenExpiryReminders() starts
```

## Data Flow Examples

### Example 1: Plan Expires and Gets Backed Up

**Timeline:**
- **Jan 3, 2026 10:00 AM** - Plan expires (expiresAt timestamp reached)
- **Jan 3, 2026 10:00:30 AM** - Scheduler detects expiry, sends email
- **Jan 3, 2026 10:00:31 AM** - Backup system archives plan
- **Result**: Plan removed from `purchases.json`, added to `backup-Plan,payment,user.json`

**purchases.json Before:**
```json
[
  { "_id": "PURCHASE-1", "uid": "USR-123", "plan": "platinum", "expiresAt": "2026-01-03T10:00:00Z" }
]
```

**purchases.json After:**
```json
[]
```

**backup-Plan,payment,user.json After:**
```json
{
  "expiredPlans": [
    { "_id": "PURCHASE-1", "uid": "USR-123", "plan": "platinum", "expiresAt": "2026-01-03T10:00:00Z", "archivedAt": "2026-01-03T10:00:31Z" }
  ],
  "archivedUsers": [
    { "uid": "USR-123", "username": "John Doe", "email": "john@example.com", "archivedAt": "2026-01-03T10:00:31Z" }
  ],
  "metadata": { "totalBackupedPlans": 1, "totalBackupedUsers": 1, "totalBackupSize": 567 }
}
```

### Example 2: Server Restart with Expired Plans

**Scenario**: Server was down, plan expired in the meantime

1. Server starts → `registerPlanRoutes()` called
2. `scheduleTokenExpiryReminders()` is called
3. `cleanupExpiredPlansOnStartup()` runs
4. Detects 2 plans with `expiresAt < now`
5. Archives both to backup
6. Removes both from `purchases.json`

**Console Output:**
```
🔍 Scanning for expired plans to backup...
✅ Startup cleanup: moved 2 expired plans to backup (6 remaining)
```

## Storage Structure

```
cloud-storage-app/
├── support/
│   ├── purchases.json (active plans only)
│   ├── users.json (all users)
│   ├── tokens.json (active tokens)
│   └── backup-Plan,payment,user.json (archived plans & users)
└── server-plans.js (contains backup logic)
```

## Monitoring & Verification

### Check Backup Status
```javascript
// Load backup and check metadata
const backup = loadBackup();
console.log(`Archived Plans: ${backup.metadata.totalBackupedPlans}`);
console.log(`Archived Users: ${backup.metadata.totalBackupedUsers}`);
console.log(`Last Updated: ${backup.lastUpdated}`);
```

### Verify Cleanup
1. Check `purchases.json` - should only contain active plans (expiresAt in future)
2. Check `backup-Plan,payment,user.json` - should contain all expired plans
3. Check server console - should see "Startup cleanup" message on restart

### Sample Verification Query
```bash
# Count active plans
grep -c '"expiresAt"' support/purchases.json

# Count archived plans
grep -c '"archivedAt"' support/backup-Plan,payment,user.json
```

## Email Notification

When a plan expires:

**Email Subject**: 🚀 Reactivate your Cloud Space plan

**Email Content**:
- Notification that plan has expired
- User downgraded to normal upload experience
- "Renew Now" button links to upgrade form
- Option to ignore if already renewed

**Features**:
- Sends only once per plan (tracked by `expiryEmailSent` flag)
- Includes user name and plan type
- Styled HTML email with dark theme
- Gradient "Renew Now" button

## API Endpoints

No new API endpoints are added. The backup system works entirely in the background via the scheduler.

## Configuration

No special configuration needed. The system:
- Runs on server startup automatically
- Checks every 30 seconds for expired plans
- Uses the same `support/` directory structure
- Creates backup file automatically if it doesn't exist

## Troubleshooting

### Backup File Not Found
**Solution**: The file will be created automatically on first expiry or server start.

### Plans Not Being Archived
**Check**:
1. Is `expiresAt` timestamp in the past? 
2. Is `expiryEmailSent` flag already set to true?
3. Check server console for error messages

### Backup File Corrupted
**Solution**: 
1. Restore from backup (if available)
2. Delete the corrupted file - it will be recreated on next expiry
3. Check file permissions in `support/` directory

## Future Enhancements

Possible improvements:
- [ ] Export backup as CSV/PDF for reporting
- [ ] Archive old backups by date (monthly/yearly)
- [ ] Add restore endpoint to move plans back to active
- [ ] Backup payment proofs along with plans
- [ ] Schedule automated backup downloads
- [ ] Add dashboard to view archived plans
- [ ] Retention policy (auto-delete backups after X days)

## Related Files

- `server-plans.js` - Contains all backup logic (lines 82-155)
- `purchases.json` - Source of active plans
- `users.json` - Source of user data for archiving
- `public/test-ui-page.html` - Tests plan expiry flow

## Summary

The backup system ensures:
✅ Expired plans don't clutter the database
✅ Historical records are preserved for auditing
✅ Users are notified when plans expire
✅ Clean data on server restarts
✅ Automatic archiving with minimal configuration
