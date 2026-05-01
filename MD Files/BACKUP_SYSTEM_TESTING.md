# Backup System - Testing Guide

## 🧪 How to Test the Backup System

This guide shows you how to verify the backup system works correctly.

## Test 1: Verify Backup File Creation

### Objective
Confirm that the backup file was created with the correct structure.

### Steps
1. **Open backup file**
   ```
   File: support/backup-Plan,payment,user.json
   ```

2. **Verify structure**
   ```json
   {
     "version": "1.0",
     "createdAt": "2026-01-03T...",
     "lastUpdated": "2026-01-03T...",
     "expiredPlans": [],
     "archivedPayments": [],
     "archivedUsers": [],
     "metadata": {
       "totalBackupedPlans": 0,
       "totalBackupedPayments": 0,
       "totalBackupedUsers": 0,
       "totalBackupSize": 0
     }
   }
   ```

3. **Success Criteria**
   - ✅ File exists at `support/backup-Plan,payment,user.json`
   - ✅ Contains all required fields
   - ✅ All counts are 0 initially

---

## Test 2: Verify Startup Cleanup

### Objective
Confirm that expired plans are cleaned up on server startup.

### Steps
1. **Prepare test data**
   ```javascript
   // In support/purchases.json, modify the expiresAt of one plan:
   // Change from: "2026-07-02T05:58:21.076Z" (future)
   // Change to:   "2026-01-01T05:58:21.076Z" (past)
   ```

2. **Start the server**
   ```bash
   node server.js
   ```

3. **Check console output**
   Look for:
   ```
   🔍 Scanning for expired plans to backup...
   ✅ Startup cleanup: moved 1 expired plans to backup (0 remaining)
   📦 Archived expired plan: PURCHASE-xxx (plan-type) for user USR-xxx
   ✅ Backup saved: { plans: 1, payments: 0, users: 1 }
   ```

4. **Verify database state**
   - Check `purchases.json` - plan should be removed
   - Check `backup-Plan,payment,user.json` - plan should be added

5. **Success Criteria**
   - ✅ Console shows "Scanning for expired plans"
   - ✅ Startup cleanup message appears
   - ✅ Plan moved from purchases to backup
   - ✅ Backup metadata updated

---

## Test 3: Verify Runtime Expiry Detection

### Objective
Confirm that plans expiring during runtime are handled correctly.

### Prerequisites
- Have access to `support/purchases.json`
- Know how to wait or modify timestamps

### Steps

#### Option A: Using Flash40 Test Plan (Quickest - 6 minutes)
```
1. Ensure you have access to purchase a plan
2. Purchase the "Flash 40TB (6m)" test plan
   - This plan automatically expires in 6 minutes
3. Note the plan ID from purchases.json
4. Wait for expiry to occur
5. Monitor server console for expiry messages
```

#### Option B: Manually Modify Expiry Date (Fastest - immediate)
```javascript
// Edit support/purchases.json
// Find any plan and change expiresAt to past date:
"expiresAt": "2026-01-03T10:00:00.000Z"  // Past = test expiry

// Save file
// Server will detect expiry within 30 seconds
```

### What to Monitor

**Console Output (every 30 seconds):**
```
📦 Archived expired plan: PURCHASE-1767419901076 (platinum) for user USR-QAD1DLKW
✅ Backup saved: { plans: 1, payments: 0, users: 1 }
```

**Email Received:**
- Subject: 🚀 Reactivate your Cloud Space plan
- Content: "Your plan has expired..."
- Button: "🔄 Renew Now" (links to upgrade form)

**File Changes:**
- `purchases.json` - plan removed (count decreased)
- `backup-Plan,payment,user.json` - plan added (count increased)

### Success Criteria
- ✅ Console shows archived plan message
- ✅ Email sent to user
- ✅ Plan removed from purchases.json
- ✅ Plan added to backup-Plan,payment,user.json
- ✅ Backup metadata updated correctly
- ✅ Related user archived (if not already archived)

---

## Test 4: Verify User Email Notification

### Objective
Confirm that users receive the "plan expired" email.

### Steps
1. **Set up email logging**
   - Check `server-plans.js` line 277-287
   - Ensure `sendStyledMail()` is called

2. **Trigger plan expiry**
   - Use Test 3 method to expire a plan
   - Note the user's email address

3. **Check email**
   - **Subject**: 🚀 Reactivate your Cloud Space plan
   - **From**: Your configured SUPER_ADMIN_EMAIL
   - **To**: User's email address

4. **Verify email content**
   ```
   ✅ Greeting with username
   ✅ Message: "Your plan has expired"
   ✅ Plan type mentioned (platinum, gold, etc)
   ✅ "Renew Now" button with correct URL
   ✅ Footer text about ignoring if already renewed
   ✅ Styled HTML with dark theme
   ```

5. **Test email link**
   - Click "Renew Now" button
   - Should navigate to upgrade form
   - URL should include: `uid=` and `plan=`

### Success Criteria
- ✅ Email received immediately after expiry
- ✅ Correct recipient email
- ✅ Proper subject and content
- ✅ "Renew Now" button works
- ✅ Styled properly in email client

---

## Test 5: Verify Metadata Updates

### Objective
Confirm that backup metadata is updated correctly.

### Steps
1. **Check initial metadata**
   ```bash
   # Look at support/backup-Plan,payment,user.json
   # Metadata should show:
   {
     "totalBackupedPlans": 0,
     "totalBackupedUsers": 0,
     "totalBackupSize": 0
   }
   ```

2. **Expire 3 plans** (use Test 3 method)
   - Expire plan 1
   - Wait for backup
   - Expire plan 2
   - Wait for backup
   - Expire plan 3
   - Wait for backup

3. **Check updated metadata**
   ```bash
   # After 3 plans expired, should show:
   {
     "totalBackupedPlans": 3,
     "totalBackupedUsers": 3,  # (or less if same user)
     "totalBackupSize": XXX    # Should increase
   }
   ```

4. **Verify lastUpdated**
   ```bash
   # "lastUpdated" should be recent timestamp
   # Should match when last plan was archived
   ```

### Success Criteria
- ✅ totalBackupedPlans increments correctly
- ✅ totalBackupedUsers increments (or stays same if duplicate)
- ✅ totalBackupSize increases
- ✅ lastUpdated timestamp changes
- ✅ All counts match actual data in arrays

---

## Test 6: Verify No Duplicate Backups

### Objective
Confirm that the same plan is never backed up twice.

### Steps
1. **Create a plan and let it expire**
   - Follow Test 3 to expire a plan
   - Note the plan ID

2. **Restart the server**
   ```bash
   node server.js
   ```

3. **Check backup file**
   ```bash
   # Search for the plan ID
   # Should appear exactly ONCE in expiredPlans[]
   ```

4. **Verify metadata**
   ```bash
   # totalBackupedPlans should not have increased
   # (plan was not duplicated)
   ```

5. **Check console**
   - Startup cleanup should NOT mention this plan again
   - Should say "moved 0 expired plans" (or same count as before)

### Success Criteria
- ✅ Plan appears only once in backup
- ✅ No duplicate entries
- ✅ Metadata didn't change on restart
- ✅ Console confirms no additional backups

---

## Test 7: Verify Database Consistency

### Objective
Confirm data consistency between purchases and backup files.

### Steps
1. **Count plans in purchases.json**
   ```bash
   # Count entries where expiresAt is in FUTURE
   count_active_plans = X
   ```

2. **Count plans in backup-Plan,payment,user.json**
   ```bash
   # Count expiredPlans array length
   count_archived_plans = Y
   ```

3. **Verify formula**
   ```
   original_plans = count_active_plans + count_archived_plans
   
   Should match with:
   • Initial purchase count
   • New purchases minus expired plans
   ```

4. **Check no overlap**
   ```bash
   # No plan should exist in BOTH files
   # Plans either in purchases.json OR backup, never both
   ```

### Success Criteria
- ✅ Total plans add up correctly
- ✅ No plan appears in both files
- ✅ All removed plans are in backup
- ✅ No missing plans

---

## Test 8: Verify Server Restart Idempotency

### Objective
Confirm that restarting the server doesn't cause issues.

### Steps
1. **Run startup cleanup test** (Test 2)
   - Verify plans moved to backup
   - Check backup count: X plans

2. **Restart server multiple times**
   ```bash
   # Stop and start 3 times
   ```

3. **Check backup count each time**
   ```bash
   # Should remain at X plans
   # Should NOT increase
   ```

4. **Check console**
   ```bash
   # Each startup should show same message
   # Should indicate "moved 0 expired plans" after first cleanup
   ```

### Success Criteria
- ✅ Backup count doesn't increase on restarts
- ✅ No duplicate entries created
- ✅ Idempotent operation confirmed
- ✅ Safe to restart anytime

---

## Test 9: Performance Test

### Objective
Confirm the system works with many expired plans.

### Steps
1. **Create test data** (simulate 50 expired plans)
   ```javascript
   // Add 50 test purchases with past expiresAt dates
   // In support/purchases.json
   ```

2. **Start server**
   ```bash
   node server.js
   ```

3. **Monitor performance**
   - Check startup cleanup time
   - Monitor memory usage
   - Check CPU usage during archival

4. **Verify completion**
   ```bash
   # Should complete within reasonable time
   # Console should show all 50 archived
   # totalBackupedPlans should be 50
   ```

### Success Criteria
- ✅ Completes in <5 seconds
- ✅ No memory leaks
- ✅ All 50 plans archived
- ✅ Backup file remains valid JSON
- ✅ Metadata accurate

---

## Test 10: Error Recovery

### Objective
Verify system gracefully handles errors.

### Steps
1. **Corrupt backup file**
   ```bash
   # Edit backup-Plan,payment,user.json
   # Remove a closing brace to break JSON
   ```

2. **Start server**
   ```bash
   node server.js
   ```

3. **Monitor console**
   - Should show error: "Error loading backup"
   - Should create new backup structure
   - Should continue operating

4. **Expire a plan**
   - Server should still work
   - Plan should be archived to NEW backup
   - Email should be sent

5. **Verify recovery**
   - Backup file should be valid JSON again
   - Plans archived correctly
   - No data loss

### Success Criteria
- ✅ Graceful error handling
- ✅ Doesn't crash
- ✅ Recovers automatically
- ✅ Continues normal operation
- ✅ No data lost after recovery

---

## Quick Test Checklist

Use this for quick validation:

```
□ Test 1: Backup file structure        ✅
□ Test 2: Startup cleanup              ✅
□ Test 3: Runtime expiry detection     ✅
□ Test 4: Email notifications          ✅
□ Test 5: Metadata updates             ✅
□ Test 6: No duplicates                ✅
□ Test 7: Data consistency             ✅
□ Test 8: Restart safety               ✅
□ Test 9: Performance (optional)       ✅
□ Test 10: Error recovery (optional)   ✅
```

---

## Troubleshooting During Testing

### Issue: "Cannot find backup file"
**Solution**: Delete the file from earlier cleanup - it will be recreated on first expiry

### Issue: "Plan not archived after expiry"
**Solution**: 
1. Check that expiresAt is actually in the past
2. Wait 30+ seconds (scheduler runs every 30s)
3. Check server console for error messages

### Issue: "Email not received"
**Solution**:
1. Check email configuration in `server.js` or `.env`
2. Verify `sendStyledMail()` in server-plans.js is working
3. Check spam/junk folder
4. Verify recipient email in purchases.json

### Issue: "Backup file corrupted"
**Solution**:
1. Delete the backup file
2. Restart server
3. File will be recreated on next expiry

### Issue: "Startup cleanup message not showing"
**Solution**:
1. Check that `cleanupExpiredPlansOnStartup()` was called
2. Look in server console output (first 30 lines)
3. Verify there are actually expired plans to process

---

## Expected Test Times

| Test | Duration | Notes |
|------|----------|-------|
| Test 1 | < 1 min | Just file verification |
| Test 2 | 1-2 min | Server restart + verification |
| Test 3 (Flash) | 6-7 min | Waiting for plan expiry |
| Test 3 (Manual) | < 1 min | Instant expiry via timestamp change |
| Test 4 | 2-3 min | Wait for email delivery |
| Test 5 | 5-10 min | Multiple expirations |
| Test 6 | 2-3 min | Restart + verification |
| Test 7 | 2 min | Data counting |
| Test 8 | 2 min | Multiple restarts |
| Test 9 | 5 min | Large dataset |
| Test 10 | 3 min | Error + recovery |

**Total time for all tests**: ~30-40 minutes

---

## Success Indicators

✅ **System is working correctly if:**
1. Backup file created with proper structure
2. Expired plans detected automatically every 30 seconds
3. Plans archived and removed from active database
4. Emails sent to users on expiry
5. Metadata tracked and updated
6. No duplicates created
7. Safe to restart anytime
8. Gracefully handles errors

🎉 **All tests pass = Backup system is production-ready!**
