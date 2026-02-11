/**
 * Debug Tab Navigation Data Loss Issue
 * 
 * This script validates the root cause of data loss during tab navigation:
 * - UIController.currentTrades not being synced with persistent tradeDatabase.trades
 * - Tab switching logic not restoring persistent data to dashboard
 */

console.log('🔍 DEBUG: Tab Navigation Data Loss Analysis');

// Wait for app to be ready
setTimeout(() => {
    if (typeof window.app === 'undefined') {
        console.error('❌ TradleApp not found. Make sure application is loaded.');
        return;
    }

    const app = window.app;
    const ui = app.uiController;

    // Debug function to show current state
    function debugCurrentState(context) {
        console.log(`\n🔍 ${context} - Current State:`);
        console.log(`  📊 tradeDatabase.trades: ${app.tradeDatabase.trades.length} items`);
        console.log(`  🎯 UI.currentTrades: ${ui.currentTrades.length} items`);
        console.log(`  💾 localStorage data:`, localStorage.getItem('tradle_trade_database') ? 'EXISTS' : 'MISSING');

        if (localStorage.getItem('tradle_trade_database')) {
            try {
                const stored = JSON.parse(localStorage.getItem('tradle_trade_database'));
                console.log(`  💾 localStorage trades: ${stored.trades ? stored.trades.length : 0} items`);
            } catch (e) {
                console.log(`  💾 localStorage parse error:`, e);
            }
        }

        console.log(`  👁️ Current active tab:`, document.querySelector('.nav-tab.active')?.dataset?.tab || 'unknown');
    }

    // Test 1: Check initial state
    debugCurrentState('INITIAL STATE');

    // Test 2: Simulate user workflow - upload data if none exists
    if (app.tradeDatabase.trades.length === 0) {
        console.log('\n📤 No existing data. Load some sample data first to test navigation issue.');
        console.log('Use: window.app.loadSampleDataMethod()');
        return;
    }

    // Test 3: Monitor tab switching
    console.log('\n🎯 Testing Tab Navigation...');

    // Override switchTab to add debugging
    const originalSwitchTab = ui.switchTab.bind(ui);
    ui.switchTab = function (tabName) {
        console.log(`\n📱 SWITCHING TO TAB: ${tabName}`);
        debugCurrentState(`BEFORE switching to ${tabName}`);

        // Call original function
        const result = originalSwitchTab(tabName);

        // Debug after
        setTimeout(() => {
            debugCurrentState(`AFTER switching to ${tabName}`);

            // Critical check: Dashboard showing data?
            if (tabName === 'dashboard') {
                const dashboardTable = document.querySelector('#tradeTableBody');
                const rows = dashboardTable ? dashboardTable.querySelectorAll('tr:not(.no-data)').length : 0;
                console.log(`  📋 Dashboard table rows: ${rows}`);
                console.log(`  💰 Dashboard shows: ${rows > 0 ? 'DATA' : '$0 (NO DATA)'}`);

                if (app.tradeDatabase.trades.length > 0 && rows === 0) {
                    console.error(`❌ BUG CONFIRMED: ${app.tradeDatabase.trades.length} trades in database but dashboard shows $0`);
                    console.error(`❌ Root cause: UI.currentTrades (${ui.currentTrades.length}) not synced with tradeDatabase.trades (${app.tradeDatabase.trades.length})`);
                }
            }
        }, 100);

        return result;
    };

    // Test 4: Trigger the bug
    console.log('\n🐛 Reproducing the bug...');
    console.log('1. Switching to Dashboard to see data...');
    ui.switchTab('dashboard');

    setTimeout(() => {
        console.log('2. Switching to Import tab...');
        ui.switchTab('import');

        setTimeout(() => {
            console.log('3. Switching back to Dashboard (should show data loss)...');
            ui.switchTab('dashboard');

            setTimeout(() => {
                console.log('\n📋 ANALYSIS COMPLETE');
                console.log('If dashboard shows $0 but tradeDatabase has data, the bug is confirmed.');
                console.log('Fix: Update switchTab to sync UI.currentTrades with tradeDatabase.trades when switching to dashboard');
            }, 200);
        }, 500);
    }, 500);

}, 1000);

// Test function to manually validate localStorage
window.debugLocalStorage = function () {
    console.log('\n💾 localStorage Debug:');
    const stored = localStorage.getItem('tradle_trade_database');
    if (stored) {
        try {
            const data = JSON.parse(stored);
            console.log('✅ Data exists:', {
                trades: data.trades?.length || 0,
                lastUpdated: data.lastUpdated,
                version: data.version
            });
            console.log('Sample trade:', data.trades?.[0]);
        } catch (e) {
            console.error('❌ Parse error:', e);
        }
    } else {
        console.log('❌ No localStorage data found');
    }
};

// Test function to manually fix the state
window.fixDashboardState = function () {
    if (window.app && window.app.tradeDatabase.trades.length > 0) {
        const summary = window.app.tradeCalculator.generateSummary(window.app.tradeDatabase.trades);
        window.app.uiController.updateDashboard(window.app.tradeDatabase.trades, summary);
        console.log('✅ Manually synced UI with persistent data');
    } else {
        console.log('❌ No persistent data to sync');
    }
};

console.log('\n📚 Available test functions:');
console.log('- window.debugLocalStorage() - Check localStorage data');
console.log('- window.fixDashboardState() - Manually fix dashboard');