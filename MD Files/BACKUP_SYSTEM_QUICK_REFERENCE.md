# Backup System - Quick Reference

## What Does It Do?

When a plan expires, the system automatically:
1. ✅ Sends "Plan expired" email to user
2. ✅ Saves plan details to `backup-Plan,payment,user.json`
3. ✅ Removes plan from `purchases.json`
4. ✅ Archives related user info

## Key Files

| File | Purpose |
|------|---------|
| `backup-Plan,payment,user.json` | Archive for expired plans & users |
| `purchases.json` | Only active (non-expired) plans |
| `server-plans.js` | Contains backup logic (lines 82-155) |

## How Often Does It Run?

- Every **30 seconds** (checks for newly expired plans)
- On **server startup** (cleans up any that expired while offline)

## What Gets Backed Up?

```
✅ Expired Plan Data:
  - Plan ID, user ID, plan type
  - Amount, storage, duration
  - Purchased date, expiry date
  - Payment method, transaction ID
  - And 20+ other plan fields

✅ Related User Data:
  - User ID, username, email
  - Role, registration date
  - Profile info
```

## Example: What Happens When a Plan Expires

```
Timeline:
10:00:00 AM → Plan expires (expiresAt timestamp reached)
10:00:30 AM → Scheduler detects expiry
10:00:31 AM → Email sent: "Plan has expired"
10:00:32 AM → Plan moved to backup
10:00:33 AM → Plan removed from purchases.json

Database Changes:
BEFORE: purchases.json has 10 active plans
AFTER:  purchases.json has 9 active plans
        backup.json now has that 1 archived plan
```

## Backup File Structure

```json
{
  "version": "1.0",
  "createdAt": "timestamp",
  "lastUpdated": "timestamp",
  "expiredPlans": [...],      // Archived plans
  "archivedUsers": [...],      // Related users
  "metadata": {
    "totalBackupedPlans": 5,
    "totalBackupedUsers": 3,
    "totalBackupSize": 45678
  }
}
```

## Console Messages You'll See

### On Server Start
```
🔍 Scanning for expired plans to backup...
✅ Startup cleanup: moved 0 expired plans to backup (9 remaining)
```

### When Plan Expires (Every 30s)
```
📦 Archived expired plan: PURCHASE-1767419901076 (platinum) for user USR-QAD1DLKW
✅ Backup saved: { plans: 1, payments: 0, users: 1 }
```

## User Experience

**User Email When Plan Expires:**
- Subject: 🚀 Reactivate your Cloud Space plan
- Message: "Your platinum access just expired"
- Downgraded to normal upload experience
- Button: "Renew Now" (links to upgrade form)
- Footer: "If you already renewed, ignore this message"

## How to Verify It's Working

### Check Backup File
```javascript
// View backup file in VS Code
// File: support/backup-Plan,payment,user.json
// Should show archived plans and users
```

### Check Active Plans
```javascript
// View active plans
// File: support/purchases.json
// Should only contain plans where expiresAt > now
```

### Monitor Server Console
```
// Look for these messages:
✅ Startup cleanup: moved X expired plans
📦 Archived expired plan: ...
✅ Backup saved: ...
```

## Common Scenarios

### Scenario 1: Plan Expires During Business Hours
```
✅ Plan expires
✅ Email sent to user
✅ Plan moved to backup
✅ Removed from active database
```

### Scenario 2: Server Was Down When Plan Expired
```
✅ Server restarts
✅ cleanupExpiredPlansOnStartup() runs
✅ Finds plans that expired while offline
✅ Archives them
✅ Server now has clean database
```

### Scenario 3: User Renews Expired Plan
```
✅ User clicks "Renew Now" in email
✅ Creates new purchase record
✅ New plan added to purchases.json
✅ Old plan stays in backup.json
✅ User gets fresh token
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Backup file missing | Will be created automatically on first expiry |
| Plans not being archived | Check if expiresAt is actually in the past |
| Server errors | Check backup file permissions in support/ folder |
| Backup file too large | Normal - contains all historical data |

## What NOT to Do

❌ Don't manually delete `backup-Plan,payment,user.json` (archive lost forever)
❌ Don't edit archived plans in backup (read-only archive)
❌ Don't move plans between backup and purchases manually (will cause sync issues)

## What You CAN Do

✅ Read backup file to audit expired plans
✅ Export backup for reporting/compliance
✅ Query backup to find user history
✅ Use for analytics on plan retention

## Related Documentation

- Full Details: See `BACKUP_SYSTEM_DOCUMENTATION.md`
- Plan Reminders: See `server-plans.js` lines 245-310
- Token System: See `TOKEN_SYSTEM.js`
- Email System: See `server-plans.js` lines 276-287

## Functions Reference

```javascript
// Load backup data
const backup = loadBackup();

// Save backup data
saveBackup(backup);

// Archive a plan
moveExpiredPlanToBackup(planObject, usersArray);

// Run cleanup on startup
cleanupExpiredPlansOnStartup();

// All called automatically - no action needed!
```

## Summary

✨ **The backup system is fully automatic:**
- Runs every 30 seconds
- Archives when plans expire
- Cleans up on restart
- Sends notification emails
- Requires ZERO manual configuration

🎉 **Just start the server and it works!**
