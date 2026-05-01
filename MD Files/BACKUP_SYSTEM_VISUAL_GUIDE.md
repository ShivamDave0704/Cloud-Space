# Backup System - Visual Guide

## 🎯 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SERVER STARTUP                           │
└────────────┬────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────┐
│         registerPlanRoutes() initializes                     │
│   • Loads config, paths, helpers                           │
│   • Sets up reminder scheduler                             │
└────────────┬────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────┐
│    cleanupExpiredPlansOnStartup() runs                       │
│  • Scans purchases.json for expired plans                  │
│  • Moves expired to backup-Plan,payment,user.json         │
│  • Removes from active purchases.json                      │
│  • Logs summary (e.g., "moved 0 expired plans")            │
└────────────┬────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────┐
│   scheduleTokenExpiryReminders() runs every 30s            │
│                                                              │
│   ┌──────────────────────────────────────────────────┐     │
│   │ Loop through purchases                           │     │
│   │ Check each plan's expiresAt time                 │     │
│   └──────────────────────────────────────────────────┘     │
│                      ↓                                       │
│   ┌──────────────────────────────────────────────────┐     │
│   │ Is msLeft > 0?                                    │     │
│   │ • YES: Send reminder email (T-3d/2d/1d/10m/3m)   │     │
│   │ • NO:  Continue to expiry check                  │     │
│   └──────────────────────────────────────────────────┘     │
│                      ↓                                       │
│   ┌──────────────────────────────────────────────────┐     │
│   │ Is msLeft < 0?                                    │     │
│   │ • YES: PLAN EXPIRED!                             │     │
│   │ • NO:  Move to next plan                         │     │
│   └──────────────────────────────────────────────────┘     │
└────────────┬────────────────────────────────────────────────┘
             │
             ↓
```

## 📊 Plan Expiry Sequence

```
┌────────────────────────────────────────────────────────────┐
│            PLAN DETECTED AS EXPIRED                         │
│         (expiresAt timestamp in the past)                   │
└────────────┬────────────────────────────────────────────────┘
             │
             ↓
      ┌──────────────────┐
      │  Send Email      │
      │  to User:        │
      │  "Plan has       │
      │   expired"       │
      │  with Renew link │
      └────────┬─────────┘
               │
               ↓
      ┌──────────────────────────────────────┐
      │  moveExpiredPlanToBackup()           │
      │  ├─ Load backup file                │
      │  ├─ Add plan to expiredPlans[]      │
      │  ├─ Add user to archivedUsers[]     │
      │  ├─ Update metadata counts          │
      │  └─ Save backup to disk             │
      └────────┬─────────────────────────────┘
               │
               ↓
      ┌──────────────────────────────────────┐
      │  Update purchases.json               │
      │  ├─ Remove plan via splice()         │
      │  └─ Save updated array               │
      └────────┬─────────────────────────────┘
               │
               ↓
      ┌──────────────────────────────────────┐
      │  Log Action                          │
      │  📦 Archived expired plan: PURCH-123 │
      │  ✅ Backup saved: 1 plan, 1 user    │
      └──────────────────────────────────────┘
```

## 💾 Database State Changes

### purchases.json - Before Expiry
```json
[
  {
    "_id": "PURCHASE-1767419901076",
    "uid": "USR-QAD1DLKW",
    "plan": "platinum",
    "expiresAt": "2026-01-10T05:58:21.076Z",
    "isActive": true,
    "isBlocked": false,
    ... (20+ other fields)
  }
]
```

### purchases.json - After Expiry
```json
[
  // Plan has been removed!
]
```

### backup-Plan,payment,user.json - After Expiry
```json
{
  "version": "1.0",
  "createdAt": "2026-01-03T00:00:00.000Z",
  "lastUpdated": "2026-01-10T05:58:50.000Z",
  
  "expiredPlans": [
    {
      "_id": "PURCHASE-1767419901076",
      "uid": "USR-QAD1DLKW",
      "plan": "platinum",
      "expiresAt": "2026-01-10T05:58:21.076Z",
      "archivedAt": "2026-01-10T05:58:50.000Z",    ← Added timestamp
      ... (all original plan fields)
    }
  ],
  
  "archivedUsers": [
    {
      "uid": "USR-QAD1DLKW",
      "username": "John Doe",
      "email": "john@example.com",
      "archivedAt": "2026-01-10T05:58:50.000Z",    ← Added timestamp
      ... (other user fields)
    }
  ],
  
  "metadata": {
    "totalBackupedPlans": 1,           ← Incremented
    "totalBackupedPayments": 0,
    "totalBackupedUsers": 1,           ← Incremented
    "totalBackupSize": 2847
  }
}
```

## 📧 Email Notification Flow

```
┌─────────────────────────────────────┐
│  Plan Expiry Detected               │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────┐
│  Build Email                                                 │
│  ├─ Subject: 🚀 Reactivate your Cloud Space plan           │
│  ├─ Username: John Doe                                     │
│  ├─ Plan: platinum                                         │
│  ├─ Message: "Your plan has expired..."                    │
│  ├─ Button: "🔄 Renew Now" →                              │
│  │          /upgrade-form.html?uid=USR-123&plan=platinum   │
│  └─ Footer: "If you already renewed, ignore this"         │
└────────────┬────────────────────────────────────────────────┘
             │
             ↓
┌──────────────────────────────────┐
│  Send via Nodemailer             │
│  to: john@example.com            │
└────────────┬─────────────────────┘
             │
             ↓
┌──────────────────────────────────┐
│  Email Delivered                 │
│  User sees notification           │
│  Can click "Renew Now" button     │
└──────────────────────────────────┘
```

## ⏰ Timeline Example

```
Time          Event
────────────────────────────────────────────────────────
Jan 3 10:00   ✅ Plan created, expires in 6 minutes
Jan 3 10:04   ⏳ Reminder email: "Expires in 2 minutes"
Jan 3 10:05   ⏳ Reminder email: "Expires in 1 minute"
Jan 3 10:05:58 🚀 PLAN EXPIRES
Jan 3 10:06   📧 Email: "Plan has expired"
              📦 Archived to backup
              🗑️  Removed from active plans
Jan 3 10:06:30 ✅ Cleanup complete
```

## 🔄 Data Flow Diagram

```
                    ┌──────────────────┐
                    │  purchases.json  │
                    │  (Active Plans)  │
                    └────────┬─────────┘
                             │
                    Check every 30 seconds
                             │
                    ┌────────▼─────────┐
                    │  Is time > expiresAt?
                    └────────┬─────────┘
                    ├─ NO: Stay in active
                    │
                    └─ YES: EXPIRE
                             │
         ┌───────────────────┴────────────────────┐
         │                                        │
         ▼                                        ▼
    Send Email                          Create Backup
         │                                        │
         │                              ┌─────────▼──────────┐
         │                              │  Load old backup   │
         │                              │  (or create new)   │
         │                              └─────────┬──────────┘
         │                                        │
         │                              ┌─────────▼──────────┐
         │                              │ Add plan & user    │
         │                              │ Add archivedAt     │
         │                              │ Update metadata    │
         │                              └─────────┬──────────┘
         │                                        │
         │                              ┌─────────▼──────────┐
         │                              │ Save to disk       │
         │                              └─────────┬──────────┘
         │                                        │
         └────────────────┬─────────────────────┘
                          │
                  ┌───────▼─────────┐
                  │ Remove from     │
                  │ purchases.json  │
                  └────────┬────────┘
                           │
                  ┌────────▼────────────┐
                  │ Save purchases.json │
                  └─────────────────────┘
```

## 🗂️ Directory Structure

```
cloud-storage-app/
│
├── support/
│   ├── purchases.json
│   │   └─ Contains: [ {plan1}, {plan2}, ... ]
│   │   └─ Active plans only (expiresAt in future)
│   │   └─ Size: ~2-10 KB typically
│   │
│   ├── backup-Plan,payment,user.json
│   │   └─ Contains: {expiredPlans, archivedUsers, metadata}
│   │   └─ Grows over time as plans expire
│   │   └─ Preserved forever (historical archive)
│   │
│   ├── users.json
│   │   └─ All users (source for archiving)
│   │
│   └── tokens.json
│       └─ Active tokens
│
├── server-plans.js
│   ├─ Line 82-95:   Variable definitions
│   ├─ Line 97-155:  Backup functions
│   ├─ Line 197-232: Startup cleanup function
│   ├─ Line 265-295: Expiry detection & backup
│   └─ Line 302-350: Reminder email logic
│
└── BACKUP_SYSTEM_*.md
    └─ Documentation files
```

## 🎯 Key Decision Points

```
Is purchase in purchases.json?
└─ YES: Analyze it

Is expiresAt defined?
├─ NO:  Skip it
└─ YES: Continue

Is msLeft > 0?
├─ YES: Check for reminders (3d/2d/1d/10m)
└─ NO:  Move to backup

Is backup already sent for this plan?
├─ YES: Already done, return
└─ NO:  Send now!

Archive complete?
├─ Email sent ✅
├─ Plan backed up ✅
└─ Removed from active ✅
```

## 📈 Backup File Growth

```
Day 1:   ~100 bytes (empty structure)
Day 30:  ~5-10 KB (few expired plans)
Day 90:  ~15-30 KB (many expired plans)
Day 365: ~50-100 KB (annual data)

Note: Growth depends on:
- How many plans users purchase
- How many plans are allowed to expire
- Average plan data size (~500 bytes per plan)
```

## ✅ Verification Checklist

```
□ backup-Plan,payment,user.json exists
□ Contains proper JSON structure
□ metadata.totalBackupedPlans >= 0
□ Server logs "Scanning for expired plans"
□ No plans with past expiresAt in purchases.json
□ All past-dated plans in backup file
□ Email sent when plan expires
□ Plan removed from active database
□ Archived plan has archivedAt timestamp
```

## 🚀 Quick Start

```
1. Server starts
   ↓
2. cleanupExpiredPlansOnStartup() runs
   ↓
3. Every 30s, check for new expirations
   ↓
4. Plan expires → Email + Archive + Remove
   ↓
5. Repeat forever (fully automatic!)
```

That's it! No configuration needed. ✨
