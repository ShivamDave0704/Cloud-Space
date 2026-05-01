# 👥 Friend System & 💰 Cloud Coins - Quick Reference

## 🚀 NEW FEATURES ADDED

### 1. **Friend Request System** 📨
- **Send Friend Request**: Users can send friend requests to other users by email
- **View Pending Requests**: See incoming friend requests
- **Accept/Reject**: Accept or reject pending requests
- **Remove Friend**: Remove existing friendships

**API Endpoints:**
```
POST /api/friends/request/send
GET /api/friends/requests/pending
POST /api/friends/request/accept
POST /api/friends/request/reject
GET /api/friends/list
POST /api/friends/remove
```

### 2. **Cloud Coin System** 💰
- **View Balance**: Check your cloud coin wallet
- **Send Coins**: Transfer coins to friends (only works if you're friends)
- **View Transactions**: See all incoming/outgoing coin transfers
- **Earn/Spend**: Track your coin history

**API Endpoints:**
```
GET /api/coins/balance
POST /api/coins/send
GET /api/coins/transactions
```

### 3. **Friend File Sharing** 📤
- **Share Files with Friends**: Share any file with friends
- **View Shared Files**: See files shared with you
- **Manage Permissions**: Control what friends can do (view, download)
- **Revoke Access**: Stop sharing files anytime

**API Endpoints:**
```
POST /api/friends/share
GET /api/friends/shared-files
POST /api/friends/share/revoke
```

### 4. **Admin Monitoring System** 🛡️
Admins and Super Admins can monitor all friend system activities:

**Admin Dashboard Features:**
- 📊 System Overview (summary statistics)
- 📨 Manage Friend Requests (cancel requests)
- 👥 Manage Friendships (revoke friendships)
- 💰 Cloud Coins Management (adjust balances)
- 📤 File Sharing Monitoring
- 🔍 User Activity Search

**Admin API Endpoints:**
```
GET /api/admin/friends/requests/all
GET /api/admin/friends/all
GET /api/admin/coins/stats
GET /api/admin/friends/shares/stats
POST /api/admin/friends/request/cancel
POST /api/admin/friends/revoke
POST /api/admin/coins/adjust
GET /api/admin/friends/user/:userUID/activity
GET /api/admin/friends/system-overview
```

---

## 📁 File Structure

### New Backend Files:
```
server-friends.js          # Core friend system routes
server-admin-friends.js    # Admin monitoring routes
```

### New Data Files:
```
support/friends/requests.json    # Friend requests storage
support/friends/friends.json     # Friendship relationships
support/friends/shares.json      # File sharing records
support/coins/cloud-coins.json   # User coin balances & transactions
```

### New UI Components:
```
public/friends.html                      # User friend system interface
public/admin-friends-monitoring.html      # Admin monitoring dashboard
```

---

## 🎯 How to Use

### For Users:

**1. Access Friend System**
- Navigate to: `http://localhost:5000/friends.html`

**2. Send Friend Request**
- Click "Add New Friend" tab
- Enter friend's email
- Click "Send Friend Request"

**3. Manage Requests**
- Go to "Requests" tab
- Accept or Reject pending requests

**4. View Friends**
- Go to "Friends" tab
- See all your friends
- Share files with them

**5. Use Cloud Coins**
- Go to "Cloud Coins" tab
- View your balance
- Select a friend and send coins
- Check transaction history

**6. Share Files**
- Go to "Shared Files" tab
- View files shared with you

### For Admins:

**1. Access Admin Dashboard**
- Navigate to: `http://localhost:5000/admin-friends-monitoring.html`
- *(Must be logged in as admin or superadmin)*

**2. Monitor System**
- Overview: See system-wide statistics
- Manage Requests: Cancel specific requests
- Manage Friendships: Revoke friendships
- Manage Coins: Adjust user balances
- View Shares: Monitor file sharing

**3. Search User Activity**
- Use "User Activity" tab
- Enter User UID
- View complete activity log

---

## 🔐 Security Features

✅ **Token-based Authentication**: All routes require valid JWT/Reference tokens
✅ **Admin-Only Routes**: Protected with admin/superadmin role check
✅ **Friend Verification**: Can only share coins/files with actual friends
✅ **Request Validation**: Prevents duplicate requests, self-requests
✅ **Data Isolation**: Users only see their own data

---

## 💡 Business Logic

### Friend Requests:
- Users can send requests to any email
- Receiving user must accept to become friends
- Can't send request to yourself
- Duplicate requests blocked

### Cloud Coins:
- Each user starts with 0 coins (admin can adjust)
- Can only send coins to confirmed friends
- All transactions logged
- Admin can adjust balances with reason

### File Sharing:
- Only works with confirmed friends
- Can revoke access anytime
- Permissions: view, download
- Share records are logged

### Admin Monitoring:
- Full visibility of all requests/friendships
- Can take action on inappropriate activity
- Coin adjustments are tracked
- Complete audit trail

---

## 📊 Data Models

### Friend Request:
```json
{
  "id": "FR-XXXXXX",
  "senderUID": "USR-XXX",
  "senderEmail": "user@example.com",
  "senderUsername": "John Doe",
  "receiverEmail": "friend@example.com",
  "status": "pending|accepted|rejected",
  "cloudCoinsOffered": 0,
  "createdAt": "2026-01-30T10:00:00Z"
}
```

### Friendship:
```json
{
  "id": "FR-XXXXXX",
  "user1UID": "USR-XXX",
  "user1Email": "user1@example.com",
  "user1Username": "John",
  "user2UID": "USR-YYY",
  "user2Email": "user2@example.com",
  "user2Username": "Jane",
  "status": "active|removed",
  "createdAt": "2026-01-30T10:00:00Z"
}
```

### Cloud Coin:
```json
{
  "userUID": "USR-XXX",
  "email": "user@example.com",
  "username": "John Doe",
  "balance": 100,
  "createdAt": "2026-01-30T10:00:00Z",
  "transactions": [
    {
      "id": "TXN-XXXXX",
      "from": "USR-XXX",
      "to": "USR-YYY",
      "amount": 50,
      "type": "sent|received",
      "timestamp": "2026-01-30T10:30:00Z"
    }
  ]
}
```

### File Share:
```json
{
  "id": "SHR-XXXXXX",
  "fileId": "FILE-XXX",
  "senderUID": "USR-XXX",
  "recipientUID": "USR-YYY",
  "status": "active|revoked",
  "sharedAt": "2026-01-30T10:00:00Z",
  "permissions": ["view", "download"]
}
```

---

## 🛠️ API Examples

### Send Friend Request:
```bash
curl -X POST http://localhost:5000/api/friends/request/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"targetEmail": "friend@example.com"}'
```

### Get My Friends:
```bash
curl http://localhost:5000/api/friends/list \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Send Cloud Coins:
```bash
curl -X POST http://localhost:5000/api/coins/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"friendUID": "USR-XXX", "amount": 50}'
```

### Admin: Get All Requests:
```bash
curl http://localhost:5000/api/admin/friends/requests/all \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Admin: Adjust User Coins:
```bash
curl -X POST http://localhost:5000/api/admin/coins/adjust \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"userUID": "USR-XXX", "amount": 100, "reason": "Welcome bonus"}'
```

---

## ✅ Testing Checklist

- [ ] Send friend request
- [ ] Accept friend request
- [ ] Reject friend request
- [ ] View friends list
- [ ] Remove friend
- [ ] Check coin balance
- [ ] Send coins to friend
- [ ] View transaction history
- [ ] Share file with friend
- [ ] Revoke file share
- [ ] Admin: View system overview
- [ ] Admin: Cancel request
- [ ] Admin: Revoke friendship
- [ ] Admin: Adjust coins
- [ ] Admin: Search user activity

---

## 🎉 You're All Set!

Your cloud storage app now has a complete social networking system with friend management, cloud coins economy, and file sharing - all monitored by admins!

**Access Points:**
- Users: http://localhost:5000/friends.html
- Admins: http://localhost:5000/admin-friends-monitoring.html

Enjoy! 🚀
