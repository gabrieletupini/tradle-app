/**
 * FINAL DEBUG TEST - Comprehensive Tab Navigation Fix Validation
 * 
 * This script tests the complete user workflow and validates that the persistent storage fix works:
 * 1. Load sample data → Verify data is saved to persistent database
 * 2. Navigate to Import tab → Verify persistent data still exists
 * 3. Navigate back to Dashboard → Verify data is displayed correctly
 * 4. Refresh browser → Verify data persists across page reloads
 */

console.log('🧪 FINAL DEBUG TEST: Comprehensive Tab Navigation Fix Validation');

// Enhanced debugging functions
function debugState(context, showDetails = false) {
    const app = window.app;
    const ui = app?.uiController;

    if (!app || !ui) {
        console.error('❌ App not available');
        return null;
    }

    // Get localStorage data
    const localStorageData = localStorage.getItem('tradle_trade_database');
    let localStorageTrades = 0;
    if (localStorageData) {
        try {
            const parsed = JSON.parse(localStorageData);
            localStorageTrades = parsed.trades ? parsed.trades.length : 0;
        } catch (e) {
            console.warn('❌ localStorage parse error:', e);
        }
    }

    // Get dashboard display state
    const dashboardTable = document.querySelector('#tradeTableBody');
    const visibleRows = dashboardTable ? dashboardTable.querySelectorAll('tr:not(.no-data)').length : 0;
    const activeTab = document.querySelector('.nav-tab.active')?.dataset?.tab || 'unknown';

    const state = {
        context: context,
        persistentTrades: app.tradeDatabase.trades.length,
        uiTrades: ui.currentTrades.length,
        localStorageTrades: localStorageTrades,
        dashboardRows: visibleRows,
        activeTab: activeTab,
        localStorageExists: !!localStorageData,
        dashboardShowing: visibleRows > 0 ? 'DATA' : 'EMPTY ($0)'
    };

    console.log(`\n🔍 ${context}:`);
    console.log(`  📊 Persistent Database: ${state.persistentTrades} trades`);
    console.log(`  🎯 UI Current Trades: ${state.uiTrades} trades`);
    console.log(`  💾 localStorage: ${state.localStorageTrades} trades`);
    console.log(`  📋 Dashboard Rows: ${state.dashboardRows} rows`);
    console.log(`  👁️ Active Tab: ${state.activeTab}`);
    console.log(`  💰 Dashboard Shows: ${state.dashboardShowing}`);

    if (showDetails && app.tradeDatabase.trades.length > 0) {
        console.log(`  📋 Sample Trade:`, app.tradeDatabase.trades[0]);
    }

    return state;
}

function validateState(state, expected) {
    const results = {};

    if (expected.persistentTrades !== undefined) {
        results.persistentTrades = state.persistentTrades >= expected.persistentTrades;
    }
    if (expected.uiTrades !== undefined) {
        results.uiTrades = state.uiTrades >= expected.uiTrades;
    }
    if (expected.localStorageTrades !== undefined) {
        results.localStorageTrades = state.localStorageTrades >= expected.localStorageTrades;
    }
    if (expected.dashboardRows !== undefined) {
        results.dashboardRows = state.dashboardRows >= expected.dashboardRows;
    }
    if (expected.activeTab !== undefined) {
        results.activeTab = state.activeTab === expected.activeTab;
    }
    if (expected.dashboardShowing !== undefined) {
        results.dashboardShowing = state.dashboardShowing === expected.dashboardShowing;
    }

    const allPassed = Object.values(results).every(Boolean);

    console.log(`\n📊 Validation Results:`);
    Object.entries(results).forEach(([test, passed]) => {
        console.log(`  ${test}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    });

    return { results, allPassed };
}

// Main test suite
async function runComprehensiveTest() {
    console.log('\n🚀 Starting Comprehensive Tab Navigation Test...');

    const app = window.app;
    if (!app) {
        console.error('❌ TradleApp not found. Load the application first.');
        return false;
    }

    try {
        // Test 1: Clear any existing data and verify clean state
        console.log('\n🧹 Test 1: Clearing existing data...');
        app.clearTradeDatabase();
        await new Promise(resolve => setTimeout(resolve, 500));

        const cleanState = debugState('After Clear');
        const cleanValidation = validateState(cleanState, {
            persistentTrades: 0,
            localStorageTrades: 0,
            dashboardShowing: 'EMPTY ($0)'
        });

        if (!cleanValidation.allPassed) {
            console.error('❌ Clean state validation failed');
            return false;
        }
        console.log('✅ Clean state verified');

        // Test 2: Load sample data and verify persistence
        console.log('\n📦 Test 2: Loading sample data...');
        await app.loadSampleDataMethod();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for processing

        const afterLoadState = debugState('After Sample Data Load', true);
        const loadValidation = validateState(afterLoadState, {
            persistentTrades: 1, // Should have at least 1 trade
            localStorageTrades: 1, // Should be saved to localStorage
            uiTrades: 1 // Should be in UI
        });

        if (!loadValidation.allPassed) {
            console.error('❌ Sample data load validation failed');
            console.error('❌ This indicates the primary bug: data not being saved to persistent storage');
            return false;
        }
        console.log('✅ Sample data loaded and saved successfully');

        // Test 3: Switch to Import tab and verify data persistence
        console.log('\n📤 Test 3: Switching to Import tab...');
        app.uiController.switchTab('import');
        await new Promise(resolve => setTimeout(resolve, 500));

        const importTabState = debugState('After Import Tab Switch');
        const importValidation = validateState(importTabState, {
            persistentTrades: afterLoadState.persistentTrades, // Should maintain persistent data
            localStorageTrades: afterLoadState.localStorageTrades, // Should maintain localStorage
            activeTab: 'import'
        });

        if (!importValidation.allPassed) {
            console.error('❌ Import tab switch validation failed');
            console.error('❌ Data lost during tab navigation!');
            return false;
        }
        console.log('✅ Import tab switch successful, data preserved');

        // Test 4: CRITICAL - Switch back to Dashboard tab
        console.log('\n🎯 Test 4: CRITICAL - Switching back to Dashboard...');
        console.log('This is where the original bug occurred...');

        app.uiController.switchTab('dashboard');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Extra time for sync

        const dashboardReturnState = debugState('After Dashboard Return');
        const dashboardValidation = validateState(dashboardReturnState, {
            persistentTrades: afterLoadState.persistentTrades, // Should maintain persistent data
            localStorageTrades: afterLoadState.localStorageTrades, // Should maintain localStorage
            uiTrades: 1, // Should sync UI with persistent data
            dashboardRows: 1, // Should show data in dashboard
            activeTab: 'dashboard',
            dashboardShowing: 'DATA'
        });

        if (!dashboardValidation.allPassed) {
            console.error('❌ CRITICAL: Dashboard return validation failed');
            console.error('❌ The tab navigation bug still exists!');

            // Detailed diagnostic
            if (dashboardReturnState.persistentTrades > 0 && dashboardReturnState.dashboardRows === 0) {
                console.error('❌ SPECIFIC ISSUE: Persistent data exists but dashboard not showing it');
                console.error('❌ UI sync issue between persistent database and display');
            }

            return false;
        }
        console.log('✅ CRITICAL: Dashboard return successful - bug is FIXED!');

        // Test 5: Multiple navigation cycles (stress test)
        console.log('\n⚡ Test 5: Multiple navigation cycles...');
        for (let i = 1; i <= 3; i++) {
            console.log(`  🔄 Cycle ${i}/3:`);

            // Dashboard → Import → Dashboard
            app.uiController.switchTab('import');
            await new Promise(resolve => setTimeout(resolve, 200));

            app.uiController.switchTab('dashboard');
            await new Promise(resolve => setTimeout(resolve, 300));

            const cycleState = debugState(`Cycle ${i}`);
            const cycleValid = validateState(cycleState, {
                dashboardShowing: 'DATA'
            });

            if (!cycleValid.allPassed) {
                console.error(`❌ Cycle ${i} failed`);
                return false;
            }
            console.log(`  ✅ Cycle ${i} passed`);
        }
        console.log('✅ Multiple navigation cycles successful');

        // Test 6: Browser refresh simulation (if possible)
        console.log('\n🔄 Test 6: Testing persistence across app reinitialization...');

        // Simulate what happens on page load
        const beforeReinitTrades = app.tradeDatabase.trades.length;

        // Reset app state (simulate page refresh)
        app.tradeDatabase = { trades: [], orderIds: new Set(), lastUpdated: null };
        app.currentData = null;
        app.uiController.currentTrades = [];

        // Reload data (simulate app initialization)
        const loadResult = app.loadTradeDatabase();

        const reinitState = debugState('After Reinitialization');
        const reinitValidation = validateState(reinitState, {
            persistentTrades: beforeReinitTrades
        });

        if (!reinitValidation.allPassed) {
            console.error('❌ Browser refresh simulation failed');
            console.error('❌ Data does not persist across page reloads');
            return false;
        }
        console.log('✅ Data persists across app reinitialization');

        // Final success
        console.log('\n🎉 ALL TESTS PASSED!');
        console.log('✅ Tab navigation bug is completely FIXED');
        console.log('✅ Persistent storage is working correctly');
        console.log('✅ Data survives Import tab navigation');
        console.log('✅ Dashboard shows data after tab switches');
        console.log('✅ Data persists across app reinitialization');

        return true;

    } catch (error) {
        console.error('❌ Test suite error:', error);
        return false;
    }
}

// Export test function
window.runComprehensiveTest = runComprehensiveTest;
window.debugState = debugState;

// Auto-run if requested
if (window.location.hash === '#finaltest') {
    setTimeout(() => {
        runComprehensiveTest().then(success => {
            if (success) {
                console.log('\n🎯 FINAL RESULT: Fix is working perfectly!');
            } else {
                console.log('\n❌ FINAL RESULT: Fix needs more work');
            }
        });
    }, 2000);
}

console.log('\n📚 Available commands:');
console.log('- window.runComprehensiveTest() - Run complete test suite');
console.log('- window.debugState("context") - Debug current state');
console.log('- Add #finaltest to URL for auto-run');