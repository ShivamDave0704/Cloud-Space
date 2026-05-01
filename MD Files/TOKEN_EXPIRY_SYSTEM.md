# 🔐 Token Expiry Detection System

**Status**: ✅ **ACTIVE AND RUNNING**

## What It Does

The system automatically monitors all tokens every **30 seconds** and:

1. ✅ **Detects expired tokens** - Checks if `expiresAt` timestamp has passed
2. ✅ **Sends email notification** - Informs user their access has expired
3. ✅ **Marks token inactive** - Sets `active: false`
4. ✅ **Records expiry time** - Stores `expiredAt` timestamp
5. ✅ **Logs to console** - Shows which tokens expired

---

## How It Works

### Automatic Detection (Every 30 seconds)

```
Scheduler runs:
  ↓
Load tokens from tokens.json
  ↓
Check each token:
  ├─ Is it active? (active = true)
  ├─ Has expiresAt date? (not lifetime)
  ├─ Is expiresAt in the past? (daysLeft <= 0)
  │
  └─ YES → TOKEN EXPIRED!
      ├─ Mark as inactive (active = false)
      ├─ Set expiredAt timestamp
      ├─ Send email notification
      └─ Log to console
```

### Timeline Example

```
Token created: 2026-01-03 10:00 AM
Token expires: 2026-01-03 10:06 AM (6 minutes later - Flash40)

10:05:30 AM → Scheduler checks token
            → Token still active (30 seconds remaining)

10:06:00 AM → Token reaches expiry time
            → (Next scheduler check is ~30 seconds later)

10:06:30 AM → Scheduler detects expiry
            → Token marked as inactive
            → Email sent to user
            → Console logs: "🔴 Token expired: USR-xxx (flash40)"
```

---

## Console Output

When a token expires, you'll see:

```
🔴 Token expired: USR-ZZUJCVLK (flash40) - Email: sdgaminggaming05@gmail.com
```

Breaking down:
- 🔴 = Token expired (red indicator)
- `USR-ZZUJCVLK` = User ID
- `flash40` = Plan type
- `sdgaming...@gmail.com` = Email where notification was sent

---

## Email Notification

**Subject**: 🚀 Reactivate your Cloud Space plan

**Content**:
```
Hi [User Name],

Your [plan-type] access just expired.

Jump back in with a quick renewal below.

[🔄 Renew Now Button]

If you already renewed, you can ignore this message.
```

**Button Links To**: `upgrade-form.html` with `uid` and `plan` parameters

---

## Token States

### Active Token (Before Expiry)
```json
{
  "uid": "USR-123",
  "token": "TOK-...",
  "plan": "platinum",
  "email": "user@example.com",
  "expiresAt": "2026-01-10T10:00:00Z",
  "active": true,
  "expiredAt": null,
  "expiredNotified": false
}
```

### Expired Token (After Expiry)
```json
{
  "uid": "USR-123",
  "token": "TOK-...",
  "plan": "platinum",
  "email": "user@example.com",
  "expiresAt": "2026-01-03T10:06:00Z",
  "active": false,            ← Changed to false
  "expiredAt": "2026-01-03T10:06:30Z",    ← Set to current time
  "expiredNotified": true     ← Email sent
}
```

---

## How Often Does It Check?

**Every 30 seconds**

```
Scheduler cycle: Every 30,000 milliseconds (30 seconds)

Runs:
1. On server startup (immediately)
2. Then repeats every 30 seconds forever
```

---

## What Tokens Get Checked?

✅ **Checked**:
- Tokens with `active: true`
- Tokens with `expiresAt` date (not lifetime)
- All user tokens

❌ **Skipped**:
- Tokens with `active: false` (already inactive)
- Tokens without `expiresAt` (lifetime tokens, like Ultra plan)

---

## Key Features

| Feature | Details |
|---------|---------|
| **Frequency** | Every 30 seconds |
| **Check Point** | Is `expiresAt < now`? |
| **Action** | Mark as inactive + Email |
| **Notification** | To token's email address |
| **Logging** | Console output for monitoring |
| **Idempotent** | Won't send duplicate emails (expiredNotified flag) |
| **Performance** | Negligible overhead |

---

## Integration with Other Systems

### Token System (`TOKEN_SYSTEM.js`)
- `validateToken()` - Checks if token is valid/expired
- `createPlatinumToken()` - Creates new tokens
- `getTokenByUID()` - Retrieves user's token

### Plan System
- When plan expires → Token expires too
- When plan renews → Token is reactivated

### Email System
- Nodemailer sends notifications
- Styled HTML emails
- Personalized for each user

---

## Testing Token Expiry

### Method 1: Use Flash40 Test Plan (6 minutes)
1. Purchase "Flash 40TB (6m)" plan
2. Token created with 6-minute expiry
3. Wait 6+ minutes
4. Watch console for "🔴 Token expired" message
5. Check email for notification

### Method 2: Manual Timestamp Modification
1. Edit `tokens.json`
2. Change `expiresAt` to past date
3. Wait ~30 seconds for scheduler
4. See token marked as expired

### Method 3: Monitor Console
```bash
# Start server and watch for messages:
🔴 Token expired: USR-xxx (plan) - Email: user@example.com
```

---

## Verification

✅ **System is working if**:
1. Server shows "Server running at http://localhost:5000"
2. No errors in console
3. When token expires, console shows "🔴 Token expired" message
4. User receives email notification
5. `tokens.json` shows `active: false` for expired token

---

## What Happens to Expired Tokens?

| Action | When | Result |
|--------|------|--------|
| **Marked Inactive** | On expiry | `active: false` |
| **Email Sent** | On expiry | User notified |
| **Logged** | On expiry | Console output |
| **Not Deleted** | Ever | Preserved in file |
| **Can't Access** | After expiry | API rejects token |

---

## API Check for Expired Token

**Endpoint**: `/token-status?token=TOK-xxx`

**Response if expired**:
```json
{
  "success": true,
  "valid": false,
  "expired": true,
  "expiresAt": "2026-01-03T10:06:00Z"
}
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Token not detected as expired | Wait 30 seconds for next scheduler cycle |
| Email not received | Check email config, verify recipient email in token |
| Console shows no message | Token might already be marked as expired |
| Token still "active"? | Check if expiresAt is actually in the past |

---

## Code Location

**File**: `server-plans.js`

**Lines**: 208-296 (Token expiry detection)

**Function**: `scheduleTokenExpiryReminders()` runs every 30 seconds

**Key Variables**:
- `tokens` - Array of all tokens
- `expiresAt` - When token expires
- `daysLeft` - How many days until expiry
- `active` - Is token usable? (false = expired)

---

## Summary

✨ **Your token system now**:
- ✅ Automatically detects expired tokens
- ✅ Sends email notifications
- ✅ Marks tokens as inactive
- ✅ Logs all actions
- ✅ Runs every 30 seconds
- ✅ Requires zero manual work

🎯 **Just start the server and it works!**

---

**Last Updated**: January 3, 2026
**Status**: ✅ Production Ready
**Automation**: 100% Automatic
