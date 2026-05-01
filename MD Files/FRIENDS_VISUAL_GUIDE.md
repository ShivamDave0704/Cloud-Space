# 🎨 Friend System - Visual Guide & Flow Diagrams

## 🔄 Friend Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRIEND REQUEST FLOW                        │
└─────────────────────────────────────────────────────────────────┘

USER A                                              USER B
  │                                                   │
  │─ 1. Type friend email ────────────────────────►│
  │                                                   │
  │─ 2. Click "Send Request" ──────────────────────►│
  │     (API: POST /api/friends/request/send)        │
  │                                                   │
  │                                    4. Request appears in
  │                                       "Pending Requests"
  │                                                   │
  │                                    5. User B clicks
  │                                       "Accept" or "Reject"
  │                                                   │
  │◄──── 6. If Accepted: Friendship created ────────┤
  │     (API: POST /api/friends/request/accept)      │
  │                                                   │
  ▼ Both can now:                                    ▼
  • See each other in Friends list
  • Share coins
  • Share files
```

## 💰 Cloud Coin Transfer Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUD COIN TRANSFER FLOW                     │
└─────────────────────────────────────────────────────────────────┘

USER A (Sender)                                  USER B (Receiver)
Balance: 100 coins                              Balance: 50 coins
   │                                                │
   │─ 1. Go to Cloud Coins tab                    │
   │                                               │
   │─ 2. Select Friend B from list                │
   │                                               │
   │─ 3. Enter amount (e.g., 30)                  │
   │                                               │
   │─ 4. Click "Send Cloud Coins" ────────────────►
   │     (API: POST /api/coins/send)               │
   │                                               │
   │     ✓ Check: Is User B my friend?             │
   │     ✓ Check: Do I have 30 coins?              │
   │                                               │
   │◄────── Transaction recorded ─────────────────┤
   │                                               │
   ▼                                              ▼
Balance: 70 coins                              Balance: 80 coins
(30 sent to User B)                            (+30 from User A)

Both users see in transaction history:
- Date/Time
- Amount
- Other user name
- Type (sent/received)
```

## 📤 File Sharing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     FILE SHARING FLOW                           │
└─────────────────────────────────────────────────────────────────┘

USER A (File Owner)                         USER B (Recipient)
File: "project.zip"                              │
   │                                             │
   │─ 1. Go to Friends tab                      │
   │                                             │
   │─ 2. Click "Share File" on Friend B ────────►
   │                                             │
   │─ 3. Select file to share                    │
   │     (API: POST /api/friends/share)          │
   │                                             │
   │─ 4. Set permissions (view, download)       │
   │                                             │
   │◄─── Share created, User B notified ────────┤
   │                                             │
   │                                    5. User B sees file
   │                                       in "Shared Files" tab
   │                                             │
   │                                    6. Can view/download
   │                                       with shared permissions
   │                                             │
   │─ 7. User A can revoke anytime             │
   │     (API: POST /api/friends/share/revoke)  │
   │                                             │
   ▼ Access is immediately revoked             ▼
   User B can no longer access file
```

## 🛡️ Admin Monitoring Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  ADMIN MONITORING FLOW                          │
└─────────────────────────────────────────────────────────────────┘

ADMIN                          SYSTEM                         USERS
  │                              │                            │
  │─ Access dashboard ─────────►│                            │
  │  (admin-friends-monitoring)  │                            │
  │                              │                            │
  │─ View Overview Stats ───────►│                            │
  │  • Total friend requests     │ ◄─── Requests.json       │
  │  • Active friendships        │ ◄─── Friends.json        │
  │  • Coin circulation          │ ◄─── Cloud-coins.json    │
  │  • File shares              │ ◄─── Shares.json         │
  │                              │                            │
  │─ Monitor Requests ──────────►│                            │
  │  • View all requests         │ ◄─── API: /admin/friends │
  │  • Cancel suspicious ones    │        /requests/all      │
  │                              │                            │
  │─ Manage Friendships ────────►│                            │
  │  • View all relationships    │ ◄─── API: /admin/friends │
  │  • Revoke inappropriate ones │        /all              │
  │                              │                            │
  │─ Manage Coins ──────────────►│                            │
  │  • View top holders          │ ◄─── API: /admin/coins   │
  │  • Adjust balances           │        /stats            │
  │  • Grant/penalize coins      │ ──► Update user balance  │
  │                              │                            │
  │─ Search User Activity ──────►│                            │
  │  • View all their requests   │ ◄─── User UID lookup    │
  │  • Friendships              │ ◄─── Complete audit trail│
  │  • Coin transactions        │                            │
  │  • Files shared             │                            │
  │                              │                            │
  │─ Generate Reports ─────────►│                            │
  │  • System health summary     │                            │
  │  • Usage statistics          │                            │
  │  • Anomaly detection         │                            │
  │                              │                            │
  ▼ All admin actions logged                                 ▼
  for audit trail                                    System operates
                                                     with transparency
```

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     ARCHITECTURE DIAGRAM                        │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                      EXPRESS SERVER                          │
│  (server.js - Main entry point)                             │
└──────────────────────────────────────────────────────────────┘
         │                          │                    │
         ▼                          ▼                    ▼
┌─────────────────┐    ┌──────────────────┐   ┌──────────────────┐
│ server-auth.js  │    │ server-friends.js│   │server-admin-     │
│                 │    │                  │   │friends.js        │
│ • Auth routes   │    │ • Friend routes  │   │                  │
│ • Login/Signup  │    │ • Coin routes    │   │ • Admin routes   │
│ • Token mgmt    │    │ • Share routes   │   │ • Monitoring     │
└─────────────────┘    └──────────────────┘   └──────────────────┘
         │                          │                    │
         └──────────────┬───────────┴────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │    DATA STORAGE (JSON)        │
        ├───────────────────────────────┤
        │ support/                      │
        │ ├── users.json                │
        │ ├── files.json                │
        │ ├── friends/                  │
        │ │   ├── requests.json         │
        │ │   ├── friends.json          │
        │ │   └── shares.json           │
        │ └── coins/                    │
        │     └── cloud-coins.json      │
        └───────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
  ┌───────────────┐            ┌──────────────┐
  │ users.html    │            │ admin.html   │
  │ friends.html  │            │ admin-friends│
  │ files.html    │            │ -monitoring  │
  └───────────────┘            └──────────────┘
        │                               │
        ▼                               ▼
  ┌───────────────┐            ┌──────────────┐
  │ USERS ACCESS  │            │ ADMINS VIEW  │
  │ • Friends     │            │ • All data   │
  │ • Coins       │            │ • Manage     │
  │ • Shares      │            │ • Monitor    │
  └───────────────┘            └──────────────┘
```

## 🔐 Security & Auth Flow

```
┌─────────────────────────────────────────────────────────────────┐
│               AUTHENTICATION & AUTHORIZATION                    │
└─────────────────────────────────────────────────────────────────┘

USER REQUEST
    │
    ▼
┌─────────────────────────────────────┐
│ Has Valid Token?                    │
│ (JWT or Reference Token)            │
└──────────┬──────────────────────────┘
           │
    YES ─→ │ ◄── NO → Return 401 Unauthorized
           │
           ▼
┌─────────────────────────────────────┐
│ Is Admin-Only Route?                │
└──────────┬────────────┬─────────────┘
           │            │
     NO ──►│            │◄── YES
           │            │
           ▼            ▼
    ┌──────────┐  ┌─────────────────┐
    │ Continue │  │ Is User Admin?  │
    │ Request  │  │ (role check)    │
    └──────────┘  └────────┬────────┘
                           │
                  YES ────►│◄──── NO
                           │       │
                           ▼       ▼
                    ┌──────────┐ ┌─────────────┐
                    │ Continue │ │Return 403   │
                    │ Request  │ │Forbidden    │
                    └──────────┘ └─────────────┘
```

## 📱 UI Components Breakdown

```
┌─────────────────────────────────────────────────────────────────┐
│              USER FRIENDS PAGE (friends.html)                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Header: "👥 Friends & 💰 Cloud Coins"                         │
├─────────────────────────────────────────────────────────────────┤
│  [👥 Friends] [📨 Requests] [💰 Coins] [📤 Shares]            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FRIENDS TAB:                                                   │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 👥 My Friends                                            │ │
│  │ ┌────────────────────────────────────────────────────┐  │ │
│  │ │ Name: John Smith                                   │  │ │
│  │ │ Email: john@example.com                           │  │ │
│  │ │ Friends since: Jan 15, 2026                       │  │ │
│  │ │ [📤 Share File]  [🗑️ Remove]                      │  │ │
│  │ └────────────────────────────────────────────────────┘  │ │
│  │ ┌────────────────────────────────────────────────────┐  │ │
│  │ │ Name: Sarah Johnson                                │  │ │
│  │ │ Email: sarah@example.com                          │  │ │
│  │ │ Friends since: Dec 20, 2025                       │  │ │
│  │ │ [📤 Share File]  [🗑️ Remove]                      │  │ │
│  │ └────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ ➕ Add New Friend                                        │ │
│  │ Friend's Email: [____________@_____.com]               │ │
│  │ [📤 Send Friend Request]                               │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  REQUESTS TAB:                                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 📨 Pending Requests                                      │ │
│  │ ┌────────────────────────────────────────────────────┐  │ │
│  │ │ From: Mike Davis                                   │  │ │
│  │ │ Email: mike@example.com                           │  │ │
│  │ │ Sent: 3 days ago                                  │  │ │
│  │ │ [✅ Accept]  [❌ Reject]                           │  │ │
│  │ └────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  CLOUD COINS TAB:                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  💰 YOUR BALANCE: 500 🪙                               │ │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ (nice visual)                   │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Select Friend: [Select a friend...]                    │ │
│  │ Amount: [_____]                                        │ │
│  │ [🎁 Send Cloud Coins]                                 │ │
│  │                                                         │ │
│  │ 📊 Transaction History                                │ │
│  │ 📥 Received: 50 coins from John (Jan 28)             │ │
│  │ 📤 Sent: 25 coins to Sarah (Jan 25)                  │ │
│  │ 📥 Received: 100 coins from Mike (Jan 20)            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  SHARED FILES TAB:                                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 📤 Files Shared With Me                                │ │
│  │ ┌────────────────────────────────────────────────────┐  │ │
│  │ │ File ID: FILE-XYZ123                               │  │ │
│  │ │ From: John Smith                                   │  │ │
│  │ │ Shared: Jan 26, 2026                               │  │ │
│  │ │ Permissions: View, Download                        │  │ │
│  │ │ [📥 Download]                                      │  │ │
│  │ └────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🛡️ Admin Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│           ADMIN FRIENDS MONITORING DASHBOARD                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────┐  ┌──────────────────────────────────────────────────┐
│SIDEBAR   │  │  📊 Friends System Monitoring    [🔄 Refresh]    │
│          │  ├──────────────────────────────────────────────────┤
│📊Overv.  │  │                                                  │
│📨Requests│  │  ┌─────────┬──────────┬──────────┬─────────┐  │
│👥Friends │  │  │Requests │Friendsh. │Coins     │Shares   │  │
│💰Coins   │  │  │  256    │  1,240   │  50,000  │  3,890  │  │
│📤Shares  │  │  │ (45 pd) │(1,200 ac)│  In Circ │(3,200 ac)│  │
│🔍Users   │  │  └─────────┴──────────┴──────────┴─────────┘  │
│          │  │                                                  │
└──────────┘  │  OVERVIEW SECTION:                              │
              │  ┌──────────────────────────────────────────┐  │
              │  │ Friend Requests:                         │  │
              │  │  • Pending: 45                           │  │
              │  │  • Accepted: 190                         │  │
              │  │  • Rejected: 21                          │  │
              │  │                                          │  │
              │  │ Friendships: 1,200 active               │  │
              │  │ Cloud Coins: 50,000 in circulation       │  │
              │  │ File Shares: 3,200 active               │  │
              │  │                                          │  │
              │  │ Last Updated: Jan 30, 2026 10:45 AM     │  │
              │  └──────────────────────────────────────────┘  │
              │                                                  │
              │  [Tab Content Switches Below]                   │
              │  ┌──────────────────────────────────────────┐  │
              │  │ USER  │ EMAIL           │STATUS  │ACTIONS│  │
              │  ├──────────────────────────────────────────┤  │
              │  │John   │john@...    │Pending │[Cancel]   │  │
              │  │Sarah  │sarah@...   │Accepted│           │  │
              │  │Mike   │mike@...    │Pending │[Cancel]   │  │
              │  └──────────────────────────────────────────┘  │
              │                                                  │
└─────────────┴──────────────────────────────────────────────────┘
```

---

## 🎯 User Journeys

### Journey 1: New User Making First Friend

```
Step 1: Register account → Redirected to dashboard
Step 2: View friends.html
Step 3: See "Add New Friend" section
Step 4: Enter friend's email
Step 5: Request sent! 
Step 6: Friend receives request
Step 7: Friend accepts
Step 8: Both see each other as friends ✅
```

### Journey 2: Users Exchanging Coins

```
Step 1: User A logs in
Step 2: Navigate to Cloud Coins tab
Step 3: See balance (0 coins - admin can grant)
Step 4: Admin grants 100 coins
Step 5: User A sees 100 coins balance
Step 6: Select friend from list (User B)
Step 7: Enter amount (50)
Step 8: Click "Send"
Step 9: User A balance: 50, User B balance: +50
Step 10: Both see transaction in history ✅
```

### Journey 3: Sharing Files with Friends

```
Step 1: User A has file uploaded
Step 2: Go to Friends tab
Step 3: Click "Share File" on a friend
Step 4: Select which file
Step 5: Set permissions (view, download)
Step 6: File shared!
Step 7: Friend receives notification
Step 8: Friend goes to "Shared Files" tab
Step 9: Friend can download the file
Step 10: User A can revoke access anytime ✅
```

---

This completes the visual guide! All flows, diagrams, and UI layouts have been documented.
