#!/bin/bash
# Friend System Installation Verification Script

echo "🔍 Checking Friend System Installation..."
echo ""

FILES=(
  "server-friends.js"
  "server-admin-friends.js"
  "support/friends/requests.json"
  "support/friends/friends.json"
  "support/friends/shares.json"
  "support/coins/cloud-coins.json"
  "public/friends.html"
  "public/admin-friends-monitoring.html"
  "FRIENDS_SYSTEM_GUIDE.md"
)

echo "✅ Required Files:"
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file (MISSING)"
  fi
done

echo ""
echo "📊 Checking imports in server.js..."
if grep -q "server-friends.js" server.js; then
  echo "  ✓ server-friends.js imported"
else
  echo "  ✗ server-friends.js NOT imported"
fi

if grep -q "server-admin-friends.js" server.js; then
  echo "  ✓ server-admin-friends.js imported"
else
  echo "  ✗ server-admin-friends.js NOT imported"
fi

echo ""
echo "🎯 API Endpoints Summary:"
echo "  User Endpoints:"
echo "    - POST   /api/friends/request/send"
echo "    - GET    /api/friends/requests/pending"
echo "    - POST   /api/friends/request/accept"
echo "    - POST   /api/friends/request/reject"
echo "    - GET    /api/friends/list"
echo "    - POST   /api/friends/remove"
echo "    - GET    /api/coins/balance"
echo "    - POST   /api/coins/send"
echo "    - GET    /api/coins/transactions"
echo "    - POST   /api/friends/share"
echo "    - GET    /api/friends/shared-files"
echo "    - POST   /api/friends/share/revoke"
echo ""
echo "  Admin Endpoints:"
echo "    - GET    /api/admin/friends/requests/all"
echo "    - GET    /api/admin/friends/all"
echo "    - GET    /api/admin/coins/stats"
echo "    - GET    /api/admin/friends/shares/stats"
echo "    - POST   /api/admin/friends/request/cancel"
echo "    - POST   /api/admin/friends/revoke"
echo "    - POST   /api/admin/coins/adjust"
echo "    - GET    /api/admin/friends/user/:userUID/activity"
echo "    - GET    /api/admin/friends/system-overview"
echo ""
echo "🌐 UI Access Points:"
echo "  - Users:  http://localhost:5000/friends.html"
echo "  - Admins: http://localhost:5000/admin-friends-monitoring.html"
echo ""
echo "✨ Friend System Installation Complete!"
