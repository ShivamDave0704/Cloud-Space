// Test script to demonstrate user purchase summary endpoints
// This shows how to get payment count and active plan count for any user ID

const fs = require('fs');
const path = require('path');

const purchasesFile = path.join(__dirname, 'support', 'payments', 'purchases.json');

// Function to get user summary
function getUserPurchaseSummary(uid) {
    try {
        let purchases = JSON.parse(fs.readFileSync(purchasesFile, 'utf8') || '[]');
        const userPurchases = purchases.filter(p => p.uid === uid);

        // Calculate stats
        const totalPayments = userPurchases.length;
        const activePlans = userPurchases.filter(p => p.isActive && !p.isBlocked).length;
        const completedPayments = userPurchases.filter(p => p.status === 'completed').length;
        const pendingPayments = userPurchases.filter(p => p.status === 'pending_verification').length;
        const blockedPlans = userPurchases.filter(p => p.isBlocked).length;
        const totalSpent = userPurchases.reduce((sum, p) => sum + (p.finalAmount || 0), 0);
        const totalDiscount = userPurchases.reduce((sum, p) => sum + (p.amountDiscount || 0), 0);

        // Plan breakdown
        const planBreakdown = {};
        userPurchases.forEach(p => {
            if (!planBreakdown[p.plan]) {
                planBreakdown[p.plan] = {
                    count: 0,
                    active: 0,
                    totalSpent: 0,
                    lastExpiry: null
                };
            }
            planBreakdown[p.plan].count++;
            if (p.isActive && !p.isBlocked) planBreakdown[p.plan].active++;
            planBreakdown[p.plan].totalSpent += p.finalAmount || 0;
            if (!planBreakdown[p.plan].lastExpiry || new Date(p.expiresAt) > new Date(planBreakdown[p.plan].lastExpiry)) {
                planBreakdown[p.plan].lastExpiry = p.expiresAt;
            }
        });

        return {
            success: true,
            uid,
            totalPayments,
            activePlans,
            completedPayments,
            pendingPayments,
            blockedPlans,
            totalSpent,
            totalDiscount,
            planBreakdown
        };
    } catch (err) {
        console.error('❌ Error:', err.message);
        return { success: false, error: err.message };
    }
}

// Function to get all users summary
function getAllUsersSummary() {
    try {
        let purchases = JSON.parse(fs.readFileSync(purchasesFile, 'utf8') || '[]');
        
        const usersSummary = {};
        
        purchases.forEach(p => {
            if (!usersSummary[p.uid]) {
                usersSummary[p.uid] = {
                    email: p.email,
                    username: p.username,
                    totalPayments: 0,
                    activePlans: 0,
                    totalSpent: 0,
                    plans: []
                };
            }
            
            usersSummary[p.uid].totalPayments++;
            if (p.isActive && !p.isBlocked) usersSummary[p.uid].activePlans++;
            usersSummary[p.uid].totalSpent += p.finalAmount || 0;
            
            if (!usersSummary[p.uid].plans.includes(p.plan)) {
                usersSummary[p.uid].plans.push(p.plan);
            }
        });

        return {
            success: true,
            totalUsers: Object.keys(usersSummary).length,
            users: usersSummary
        };
    } catch (err) {
        console.error('❌ Error:', err.message);
        return { success: false, error: err.message };
    }
}

// Demo
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║           USER PURCHASE SUMMARY SYSTEM - TEST DEMO             ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Get all users summary first
console.log('📊 ALL USERS SUMMARY');
console.log('─'.repeat(70));
const allUsersSummary = getAllUsersSummary();
if (allUsersSummary.success) {
    console.log(`\n✅ Total Users with Purchases: ${allUsersSummary.totalUsers}\n`);
    
    Object.keys(allUsersSummary.users).forEach(uid => {
        const user = allUsersSummary.users[uid];
        console.log(`👤 User ID: ${uid}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Name: ${user.username}`);
        console.log(`   💳 Total Payments Done: ${user.totalPayments}`);
        console.log(`   ✅ Active Plans: ${user.activePlans}`);
        console.log(`   💰 Total Spent: ₹${user.totalSpent.toFixed(2)}`);
        console.log(`   📋 Plans Purchased: ${user.plans.join(', ')}`);
        console.log('');
    });
} else {
    console.log('❌ Error:', allUsersSummary.error);
}

// Get detailed summary for first user
console.log('\n' + '═'.repeat(70));
console.log('📋 DETAILED USER SUMMARY\n');

const allUsers = getAllUsersSummary();
if (allUsers.success && Object.keys(allUsers.users).length > 0) {
    const firstUid = Object.keys(allUsers.users)[0];
    const summary = getUserPurchaseSummary(firstUid);
    
    if (summary.success) {
        console.log(`🔍 Detailed Summary for User: ${summary.uid}\n`);
        console.log(`📊 PAYMENT STATISTICS:`);
        console.log(`   💳 Total Payments Done: ${summary.totalPayments}`);
        console.log(`   ✅ Completed Payments: ${summary.completedPayments}`);
        console.log(`   ⏳ Pending Payments: ${summary.pendingPayments}`);
        console.log(`   🚫 Blocked Plans: ${summary.blockedPlans}`);
        console.log(`   💰 Total Spent: ₹${summary.totalSpent.toFixed(2)}`);
        console.log(`   🎁 Total Discount: ₹${summary.totalDiscount.toFixed(2)}`);
        
        console.log(`\n📋 PLAN BREAKDOWN:`);
        Object.keys(summary.planBreakdown).forEach(plan => {
            const breakdown = summary.planBreakdown[plan];
            console.log(`   ${plan.toUpperCase()}`);
            console.log(`      • Purchased: ${breakdown.count} time(s)`);
            console.log(`      • Active: ${breakdown.active}`);
            console.log(`      • Total Spent: ₹${breakdown.totalSpent.toFixed(2)}`);
            if (breakdown.lastExpiry) {
                const expiryDate = new Date(breakdown.lastExpiry);
                const today = new Date();
                const isExpired = expiryDate < today;
                const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                console.log(`      • Last Expiry: ${expiryDate.toISOString().split('T')[0]} (${isExpired ? 'Expired' : daysLeft + ' days left'})`);
            }
        });
    } else {
        console.log('❌ Error:', summary.error);
    }
}

console.log('\n' + '═'.repeat(70));
console.log('\n✨ API ENDPOINTS AVAILABLE:\n');
console.log('1️⃣  GET /purchases/:uid');
console.log('   Returns: User\'s all purchases + summary (totalPayments, activePlans, totalSpent)');
console.log('');
console.log('2️⃣  GET /purchases/:uid/summary');
console.log('   Returns: Detailed summary including plan breakdown and statistics');
console.log('');
console.log('📝 EXAMPLE USAGE:\n');
console.log('   // Get user purchases with summary');
console.log('   GET http://localhost:5000/purchases/USR-G5ZX1E2Q');
console.log('   Response: {');
console.log('     "success": true,');
console.log('     "summary": {');
console.log('       "totalPayments": 2,  ← HOW MANY PAYMENTS DONE');
console.log('       "activePlans": 2,    ← HOW MANY PLANS ACTIVE');
console.log('       "totalSpent": 1499.4');
console.log('     },');
console.log('     "purchases": [...]');
console.log('   }');
console.log('');
console.log('   // Get detailed user summary');
console.log('   GET http://localhost:5000/purchases/USR-G5ZX1E2Q/summary');
console.log('   Response: {');
console.log('     "success": true,');
console.log('     "uid": "USR-G5ZX1E2Q",');
console.log('     "totalPayments": 2,    ← HOW MANY PAYMENTS');
console.log('     "activePlans": 2,      ← HOW MANY PLANS ACTIVE');
console.log('     "completedPayments": 2,');
console.log('     "pendingPayments": 0,');
console.log('     "blockedPlans": 0,');
console.log('     "totalSpent": 1499.4,');
console.log('     "totalDiscount": 999.6,');
console.log('     "planBreakdown": {');
console.log('       "silver": { "count": 1, "active": 1, "totalSpent": 300 },');
console.log('       "gold": { "count": 1, "active": 1, "totalSpent": 1199.4 }');
console.log('     },');
console.log('     "purchases": [...]');
console.log('   }');
console.log('');
console.log('═'.repeat(70));
