/**
 * Tradle Trading Journal - Main Application
 * Coordinates all components and handles application flow
 */
class TradleApp {
    constructor() {
        // Singleton pattern - prevent multiple instances
        if (TradleApp.instance) {
            console.log('⚠️ TradleApp instance already exists, returning existing instance');
            return TradleApp.instance;
        }
        TradleApp.instance = this;

        this.csvParser = new CSVParser();
        this.tradeCalculator = new TradeCalculator();
        this.uiController = new UIController();

        this.currentData = null;
        this.isInitialized = false;
        this.sampleDataLoaded = false;

        // Trade database for persistent storage
        this.tradeDatabase = {
            trades: [],
            orderIds: new Set(),
            lastUpdated: null
        };

        this.initialize();
        this.bindEvents();
    }

    /**
     * Initialize the application
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('⚠️ App already initialized, skipping...');
            return;
        }

        console.log('🚀 Tradle Trading Journal initialized');
        this.isInitialized = true;

        // Load persistent trade database
        this.loadTradeDatabase();

        // Check for any startup parameters or saved data
        const hasRestoredData = this.checkForSavedData();

        // Check if we're returning from a successful upload refresh
        this.checkPostRefreshState();

        // Always auto-load default data first, then merge with localStorage
        const autoLoaded = await this.autoLoadDefaultCSV();

        if (this.tradeDatabase.trades.length > 0) {
            // Show whatever data we have (default + any stored)
            const summary = this.tradeCalculator.generateSummary(this.tradeDatabase.trades);
            this.uiController.updateDashboard(this.tradeDatabase.trades, summary);
            if (autoLoaded) {
                this.uiController.showToast(`Loaded ${this.tradeDatabase.trades.length} trades — upload a CSV to update`, 'success');
            } else {
                this.uiController.showToast(`Restored ${this.tradeDatabase.trades.length} trades from database`, 'info');
            }
        } else {
            this.uiController.showToast('Welcome to Tradle! Upload your TradingView CSV to update your data.', 'info');
        }
    }

    /**
     * Auto-load the default sample CSV on startup.
     * The committed sample data is always available (even on GitHub Pages)
     * and gets merged with any existing localStorage data.
     * Upload a new CSV to overwrite/update.
     */
    async autoLoadDefaultCSV() {
        const csvPath = 'data/sample-data/sample-tradingview-data.csv';
        try {
            console.log(`📂 Auto-loading default CSV: ${csvPath}`);
            const response = await fetch(csvPath);
            if (!response.ok) {
                console.log(`📂 Default CSV not found (${response.status}), skipping auto-load`);
                return false;
            }

            const csvContent = await response.text();
            if (!csvContent || csvContent.trim().length < 20) {
                console.log('📂 Default CSV is empty, skipping');
                return false;
            }

            console.log(`📂 Default CSV loaded: ${csvContent.length} chars`);

            // Parse
            const parseResult = this.csvParser.parseTradingViewCSV(csvContent);
            if (parseResult.orders.length === 0) {
                console.warn('⚠️ Default CSV contained no valid orders');
                return false;
            }

            // Calculate trades
            const tradeResult = this.tradeCalculator.processOrders(parseResult.orders);
            if (tradeResult.trades.length === 0) {
                console.warn('⚠️ Default CSV contained no matchable trades');
                return false;
            }

            // Merge with database (handles deduplication)
            this.mergeTradesWithDatabase(tradeResult.trades, parseResult.orders);

            // Persist
            this.saveTradeDatabase();

            // Update dashboard
            const summary = this.tradeCalculator.generateSummary(this.tradeDatabase.trades);
            this.uiController.updateDashboard(this.tradeDatabase.trades, summary);
            this.uiController.showToast(`Auto-loaded ${this.tradeDatabase.trades.length} trades from default CSV`, 'success');

            console.log(`✅ Auto-loaded ${this.tradeDatabase.trades.length} trades from ${csvPath}`);
            return true;

        } catch (error) {
            console.log(`📂 Could not auto-load default CSV: ${error.message}`);
            return false;
        }
    }

    /**
     * Bind events after UI is initialized
     */
    bindEvents() {
        // Bind sample data loader
        const loadSampleBtn = document.getElementById('loadSampleBtn');
        if (loadSampleBtn) {
            loadSampleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.loadSampleDataMethod();
            });
        }

        // Bind clear database button
        const clearDatabaseBtn = document.getElementById('clearDatabaseBtn');
        if (clearDatabaseBtn) {
            clearDatabaseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleClearDatabase();
            });
        }
    }

    /**
     * Handle clear database button click with confirmation
     */
    handleClearDatabase() {
        // Show confirmation dialog
        const confirmed = confirm(
            `Are you sure you want to clear all trade data?\n\n` +
            `This will permanently delete:\n` +
            `• ${this.tradeDatabase.trades.length} stored trades\n` +
            `• ${this.tradeDatabase.orderIds.size} tracked Order IDs\n` +
            `• All persistent data\n\n` +
            `This action cannot be undone.`
        );

        if (confirmed) {
            console.log('🗑️ User confirmed database clear');
            this.clearTradeDatabase();
        } else {
            console.log('❌ User cancelled database clear');
        }
    }

    /**
     * Process uploaded file
     */
    async processFile(file, format = 'tradingview') {
        const startTime = Date.now();
        console.log('🚀 Starting file processing...');
        console.log(`📁 Processing file: ${file.name} (${format})`);
        console.log(`📏 File size: ${file.size} bytes`);

        try {
            // Step 1: File Validation
            console.log('🔍 Step 1: Validating file...');
            const validation = this.csvParser.validateFile(file);
            if (!validation.valid) {
                console.error('❌ File validation failed:', validation.errors);
                throw new Error(validation.errors.join(', '));
            }
            console.log('✅ File validation completed');

            this.uiController.showLoading();
            this.uiController.showUploadStatus('Reading file...');

            // Step 2: File Reading with timeout protection
            console.log('📖 Step 2: Reading file content...');
            console.log('⏱️ Starting FileReader operation...');

            const csvContent = await Promise.race([
                this.csvParser.readFileContent(file),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('File reading timeout (30s)')), 30000)
                )
            ]);

            console.log('✅ File content read successfully');
            console.log(`📝 Content length: ${csvContent.length} characters`);
            console.log(`📋 First 200 chars: ${csvContent.substring(0, 200)}...`);

            this.uiController.showUploadStatus('Parsing CSV data...');

            // Step 3: CSV Parsing with timeout protection
            console.log('🔍 Step 3: Parsing CSV data...');
            console.log('⏱️ Starting CSV parsing operation...');

            const parseResult = await Promise.race([
                this.csvParser.parseCSV(csvContent, format),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('CSV parsing timeout (30s)')), 30000)
                )
            ]);

            if (parseResult.orders.length === 0) {
                console.error('❌ No valid orders found in CSV');
                throw new Error('No valid trading orders found in the CSV file');
            }

            console.log('✅ CSV parsing completed');
            console.log(`📊 Parsed ${parseResult.orders.length} orders`);
            console.log(`📈 Parse stats:`, parseResult.stats);

            this.uiController.showUploadStatus('Calculating trades...');

            // Step 4: Trade Calculation with timeout protection
            console.log('🧮 Step 4: Calculating trades...');
            console.log('⏱️ Starting trade calculation operation...');

            const tradeResult = await Promise.race([
                Promise.resolve(this.tradeCalculator.processOrders(parseResult.orders)),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Trade calculation timeout (30s)')), 30000)
                )
            ]);

            if (tradeResult.trades.length === 0) {
                console.error('❌ No valid trades could be matched');
                throw new Error('No valid trades could be matched from the orders');
            }

            console.log('✅ Trade calculation completed');
            console.log(`🔢 Calculated ${tradeResult.trades.length} trades`);
            console.log(`💰 Total P&L: $${tradeResult.summary.totalProfit.toFixed(2)}`);
            console.log(`📈 Win Rate: ${tradeResult.summary.winRate.toFixed(1)}%`);

            // Step 5: Order ID-based Deduplication and Merge with Database
            console.log('🔍 Step 5: Checking for duplicate trades...');
            this.uiController.showUploadStatus('Checking for duplicates...');

            const deduplicationResult = this.mergeTradesWithDatabase(tradeResult.trades, parseResult.orders);
            console.log(`✅ Deduplication completed: ${deduplicationResult.newTrades} new, ${deduplicationResult.duplicates} duplicates`);

            // Step 6: Data Storage
            console.log('💾 Step 6: Storing current data...');
            this.currentData = {
                file: file.name,
                format,
                parseResult,
                tradeResult: {
                    trades: this.tradeDatabase.trades, // Use complete database
                    summary: this.tradeCalculator.generateSummary(this.tradeDatabase.trades)
                },
                timestamp: new Date(),
                uploadStats: deduplicationResult
            };
            console.log('✅ Data storage completed');

            // Step 6b: Persist to localStorage BEFORE any UI update
            // This ensures the new data is safe even if the UI update encounters errors
            console.log('💾 Step 6b: Saving to localStorage (early persist)...');
            this.saveTradeDatabase();
            this.saveCurrentData();
            console.log('✅ Early localStorage save completed');

            // Step 7: UI Update with timeout protection
            console.log('📊 Step 7: Updating dashboard...');
            console.log('⏱️ Starting dashboard update operation...');

            const finalSummary = this.currentData.tradeResult.summary;
            const finalTrades = this.currentData.tradeResult.trades;

            try {
                if (!finalSummary || !finalTrades) {
                    throw new Error('Invalid trade result data structure');
                }

                await Promise.race([
                    Promise.resolve(this.uiController.updateDashboard(finalTrades, finalSummary)),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Dashboard update timeout (30s)')), 30000)
                    )
                ]);

                console.log('✅ Dashboard update completed');

            } catch (dashboardError) {
                console.error('❌ Dashboard update error:', dashboardError);

                // Always ensure UI is cleaned up, even if dashboard update fails
                console.log('🧹 Cleaning up UI state after dashboard error...');
                this.uiController.hideLoading();
                this.uiController.hideUploadStatus();

                // Try individual component updates with safety checks
                console.log('🔄 Attempting individual component updates...');
                try {
                    if (finalSummary) {
                        console.log('📊 Updating summary cards...');
                        this.uiController.updateSummaryCards(finalSummary);
                    }
                    if (finalTrades && finalTrades.length > 0) {
                        console.log('📋 Updating tables...');
                        this.uiController.updateDashboardTable(finalTrades);
                        this.uiController.updateTradesTable();
                    }
                    console.log('🎯 Showing dashboard...');
                    this.uiController.showDashboard();
                    console.log('✅ Individual component updates completed');

                    // Show success message with deduplication stats
                    const statsMessage = this.formatUploadStatsMessage(deduplicationResult, finalTrades.length);
                    this.uiController.showToast(statsMessage, 'success');

                } catch (componentError) {
                    console.error('❌ Component update error:', componentError);

                    // Still cleanup UI and show partial success
                    this.uiController.hideLoading();
                    this.uiController.hideUploadStatus();
                    this.uiController.showToast('Data processed successfully, but dashboard display may be incomplete.', 'warning');
                }
            }

            // Step 8: Data already saved in Step 6b (before UI update)
            console.log('💾 Step 8: Data already persisted to localStorage ✅');

            // Step 9: No page reload needed — dashboard is already showing the new data

            const totalTime = Date.now() - startTime;
            console.log(`🎉 Processing completed successfully in ${totalTime}ms`);
            console.log('✅ All processing steps completed!');

            return this.currentData.tradeResult;

        } catch (error) {
            const totalTime = Date.now() - startTime;
            console.error(`❌ File processing error after ${totalTime}ms:`, error);
            console.error('📍 Error stack:', error.stack);

            this.uiController.hideLoading();
            this.uiController.hideUploadStatus();
            throw error;
        }
    }

    /**
     * Load sample data for demonstration
     */
    async loadSampleDataMethod() {
        if (this.sampleDataLoaded) {
            console.log('⚠️ Sample data already loaded, skipping...');
            return;
        }

        try {
            console.log('📦 Loading sample data...');
            this.sampleDataLoaded = true;

            this.uiController.showLoading();
            this.uiController.showUploadStatus('Loading sample TradingView data...');

            // Get sample CSV data
            const sampleCSV = this.csvParser.getSampleCSVData();

            // Create a mock file object
            const mockFile = new File([sampleCSV], 'sample-tradingview-data.csv', {
                type: 'text/csv'
            });

            this.uiController.showUploadStatus('Processing sample data...');

            // Process the sample data
            await this.processFile(mockFile, 'tradingview');

            this.uiController.showToast('Sample data loaded successfully! This represents real TradingView paper trading data.', 'success');

        } catch (error) {
            console.error('❌ Sample data loading error:', error);
            this.sampleDataLoaded = false; // Reset flag on error
            this.uiController.hideLoading();
            this.uiController.hideUploadStatus();
            this.uiController.showToast(`Failed to load sample data: ${error.message}`, 'error');
        }
    }

    /**
     * Save current data to localStorage
     */
    saveCurrentData() {
        try {
            if (this.currentData) {
                // Create a simplified version for storage (avoid circular references)
                const dataToSave = {
                    file: this.currentData.file,
                    format: this.currentData.format,
                    trades: this.currentData.tradeResult.trades,
                    summary: this.currentData.tradeResult.summary,
                    timestamp: this.currentData.timestamp
                };

                localStorage.setItem('tradle_current_data', JSON.stringify(dataToSave));
                console.log('💾 Data saved to localStorage');
            }
        } catch (error) {
            console.warn('⚠️ Failed to save data to localStorage:', error);
        }
    }

    /**
     * Check for saved data on startup
     */
    checkForSavedData() {
        try {
            const savedData = localStorage.getItem('tradle_current_data');
            if (savedData) {
                const data = JSON.parse(savedData);

                // Check if data is recent (within 24 hours)
                const dataAge = new Date() - new Date(data.timestamp);
                const maxAge = 24 * 60 * 60 * 1000; // 24 hours

                if (dataAge < maxAge && data.trades && data.trades.length > 0) {
                    console.log('📂 Found recent saved data, restoring...');

                    // Restore the data
                    this.currentData = data;

                    // Update UI safely
                    try {
                        this.uiController.updateDashboard(data.trades, data.summary);
                        this.uiController.showToast(`Restored previous session data (${data.trades.length} trades from ${data.file})`, 'info');
                        return true; // Data was restored
                    } catch (restoreError) {
                        console.error('❌ Failed to restore UI with saved data:', restoreError);
                        // Don't delete the saved data — the data itself is fine,
                        // only the UI rendering failed. It will be retried on next load.
                    }
                } else {
                    // Clear old data
                    localStorage.removeItem('tradle_current_data');
                }
            }
            return false; // No data was restored
        } catch (error) {
            console.warn('⚠️ Failed to restore saved data:', error);
            localStorage.removeItem('tradle_current_data');
            return false;
        }
    }

    /**
     * Prepare automatic page refresh after successful upload
     */
    prepareAutoRefresh() {
        try {
            // Set flag in localStorage to indicate successful upload
            localStorage.setItem('tradle_upload_success', JSON.stringify({
                timestamp: new Date().toISOString(),
                shouldRefresh: true
            }));

            // Show success message with refresh notification
            this.uiController.showToast('CSV uploaded successfully! Refreshing dashboard...', 'success');

            // Short delay to show success message, then refresh
            setTimeout(() => {
                console.log('🔄 Triggering automatic page refresh...');
                window.location.reload();
            }, 2000); // 2-second delay for user to see success message

        } catch (error) {
            console.warn('⚠️ Failed to prepare auto refresh:', error);
            // Fallback: just show regular success message
            this.uiController.showToast('CSV uploaded successfully!', 'success');
        }
    }

    /**
     * Check if we're returning from a successful upload refresh
     */
    checkPostRefreshState() {
        try {
            const uploadSuccess = localStorage.getItem('tradle_upload_success');
            if (uploadSuccess) {
                const successData = JSON.parse(uploadSuccess);

                // Check if the refresh flag is recent (within 30 seconds to avoid stale flags)
                const flagAge = new Date() - new Date(successData.timestamp);
                const maxAge = 30 * 1000; // 30 seconds

                if (successData.shouldRefresh && flagAge < maxAge) {
                    console.log('📝 Detected post-refresh state from successful upload');

                    // Clear the flag to prevent repeated notifications
                    localStorage.removeItem('tradle_upload_success');

                    // Ensure Dashboard tab is active
                    setTimeout(() => {
                        this.uiController.showDashboard();

                        // Show brief confirmation that data was loaded successfully
                        this.uiController.showToast('Dashboard updated with your uploaded data!', 'success');
                    }, 500); // Small delay to ensure UI is ready

                    return true; // Indicates we handled post-refresh state
                } else {
                    // Clear old flag
                    localStorage.removeItem('tradle_upload_success');
                }
            }
            return false; // No post-refresh state
        } catch (error) {
            console.warn('⚠️ Failed to check post-refresh state:', error);
            // Clean up potentially corrupted flag
            localStorage.removeItem('tradle_upload_success');
            return false;
        }
    }

    /**
     * Clear current data
     */
    clearData() {
        this.currentData = null;
        localStorage.removeItem('tradle_current_data');
        this.uiController.hideDashboard();
        this.uiController.showToast('Data cleared successfully', 'info');
    }

    /**
     * Load trade database from localStorage
     */
    loadTradeDatabase() {
        try {
            const savedDatabase = localStorage.getItem('tradle_trade_database');
            console.log('🔍 DEBUG: loadTradeDatabase called');
            console.log('🔍 DEBUG: localStorage key exists:', !!savedDatabase);

            if (savedDatabase) {
                console.log('🔍 DEBUG: localStorage content length:', savedDatabase.length);
                const database = JSON.parse(savedDatabase);
                console.log('🔍 DEBUG: Parsed database:', database);

                // Validate database structure
                if (database.trades && Array.isArray(database.trades)) {
                    // Fix side detection for all stored trades using order type
                    // In old code, entryOrder was always Buy, exitOrder was always Sell
                    // For SHORT trades the Sell (exitOrder) was actually the entry
                    const isEntryType = (type) => {
                        const t = (type || '').toLowerCase().trim();
                        if (t === 'stop loss' || t === 'take profit') return false;
                        if (t === 'limit' || t === 'stop') return true;
                        return false;
                    };

                    database.trades.forEach(trade => {
                        const order1 = trade.entryOrder;
                        const order2 = trade.exitOrder;
                        if (!order1 || !order2) return;

                        const o1IsEntry = isEntryType(order1.type);
                        const o2IsEntry = isEntryType(order2.type);

                        if (o2IsEntry && !o1IsEntry) {
                            // exitOrder (Sell) was Limit/Stop → it was the actual entry → SHORT
                            trade.side = 'SHORT';
                            // Swap so entryOrder = the Sell (actual entry), exitOrder = the Buy (actual exit)
                            trade.entryOrder = order2;
                            trade.exitOrder = order1;
                            const tmpPrice = trade.entryPrice;
                            trade.entryPrice = trade.exitPrice;
                            trade.exitPrice = tmpPrice;
                            trade.entry = trade.entryPrice;
                            trade.exit = trade.exitPrice;
                            const tmpTime = trade.entryTime;
                            trade.entryTime = trade.exitTime;
                            trade.exitTime = tmpTime;
                        } else if (o1IsEntry && !o2IsEntry) {
                            // entryOrder was Limit/Stop → correct: it IS the entry
                            trade.side = (order1.side || '').toLowerCase() === 'sell' ? 'SHORT' : 'LONG';
                        } else {
                            // Both same type → keep existing side or default
                            trade.side = trade.side || 'LONG';
                        }
                    });

                    this.tradeDatabase.trades = [...database.trades]; // Create fresh array
                    this.tradeDatabase.lastUpdated = database.lastUpdated || null;

                    // Rebuild Order ID set from existing trades
                    this.tradeDatabase.orderIds = new Set();
                    database.trades.forEach(trade => {
                        if (trade.entryOrderId) this.tradeDatabase.orderIds.add(trade.entryOrderId);
                        if (trade.exitOrderId) this.tradeDatabase.orderIds.add(trade.exitOrderId);
                        // Also check for allOrderIds array
                        if (trade.allOrderIds && Array.isArray(trade.allOrderIds)) {
                            trade.allOrderIds.forEach(orderId => {
                                if (orderId) this.tradeDatabase.orderIds.add(orderId);
                            });
                        }
                    });

                    console.log(`📂 ✅ LOADED ${this.tradeDatabase.trades.length} trades from database`);
                    console.log(`🔐 ✅ TRACKING ${this.tradeDatabase.orderIds.size} unique Order IDs`);
                    console.log('🔍 DEBUG: Sample trade:', this.tradeDatabase.trades[0]);
                    return true;
                } else {
                    console.warn('⚠️ Invalid database structure:', database);
                }
            }

            console.log('📂 No existing trade database found, starting fresh');
            return false;
        } catch (error) {
            console.error('❌ Failed to load trade database:', error);
            console.error('❌ localStorage content:', localStorage.getItem('tradle_trade_database'));
            this.tradeDatabase = {
                trades: [],
                orderIds: new Set(),
                lastUpdated: null
            };
            return false;
        }
    }

    /**
     * Save trade database to localStorage
     */
    saveTradeDatabase() {
        try {
            console.log('🔍 DEBUG: saveTradeDatabase called');
            console.log('🔍 DEBUG: Current trades to save:', this.tradeDatabase.trades.length);

            const databaseToSave = {
                trades: this.tradeDatabase.trades,
                lastUpdated: new Date().toISOString(),
                version: '1.0',
                totalTrades: this.tradeDatabase.trades.length
            };

            const serialized = JSON.stringify(databaseToSave);
            console.log('🔍 DEBUG: Serialized data length:', serialized.length);
            console.log('🔍 DEBUG: Sample trade being saved:', this.tradeDatabase.trades[0]);

            localStorage.setItem('tradle_trade_database', serialized);
            this.tradeDatabase.lastUpdated = databaseToSave.lastUpdated;

            // Verify save worked
            const verification = localStorage.getItem('tradle_trade_database');
            if (verification) {
                const verified = JSON.parse(verification);
                console.log(`💾 ✅ SAVED ${verified.trades.length} trades to database`);
                console.log('💾 ✅ localStorage verification successful');
            } else {
                console.error('❌ localStorage save verification FAILED');
            }

        } catch (error) {
            console.error('❌ Failed to save trade database:', error);
            console.error('❌ Trades data:', this.tradeDatabase.trades);
        }
    }

    /**
     * Merge new trades with existing database using Order ID deduplication
     */
    mergeTradesWithDatabase(newTrades, newOrders) {
        console.log('🔍 Starting Order ID-based deduplication...');
        console.log(`📥 Input: ${newTrades.length} new trades, ${newOrders.length} orders`);
        console.log(`📊 Existing database: ${this.tradeDatabase.trades.length} trades, ${this.tradeDatabase.orderIds.size} Order IDs`);

        let newTradeCount = 0;
        let duplicateCount = 0;
        const addedTrades = [];

        // Create Order ID map from new orders
        const orderIdMap = new Map();
        newOrders.forEach(order => {
            if (order.orderId) {
                orderIdMap.set(order.orderId, order);
            }
        });

        console.log(`🔗 Built Order ID map with ${orderIdMap.size} orders`);

        // Process each new trade
        newTrades.forEach((trade, index) => {
            // Try to find associated Order IDs for this trade
            const tradeOrderIds = this.extractTradeOrderIds(trade, newOrders);

            if (tradeOrderIds.length === 0) {
                console.warn(`⚠️ Trade ${index + 1}: No Order IDs found, skipping deduplication check`);
                // Add trade without Order ID tracking (fallback behavior)
                const enhancedTrade = { ...trade, id: this.generateTradeId() };
                this.tradeDatabase.trades.push(enhancedTrade);
                addedTrades.push(enhancedTrade);
                newTradeCount++;
                return;
            }

            // Check if any Order ID already exists
            const hasExistingOrderId = tradeOrderIds.some(orderId =>
                this.tradeDatabase.orderIds.has(orderId)
            );

            if (hasExistingOrderId) {
                duplicateCount++;
                if (duplicateCount <= 3) {
                    console.log(`🔄 Trade ${index + 1}: Duplicate found (Order IDs: ${tradeOrderIds.join(', ')})`);
                }
            } else {
                // New trade - add to database
                const enhancedTrade = {
                    ...trade,
                    id: this.generateTradeId(),
                    entryOrderId: tradeOrderIds[0] || null,
                    exitOrderId: tradeOrderIds[1] || null,
                    allOrderIds: tradeOrderIds
                };

                this.tradeDatabase.trades.push(enhancedTrade);
                addedTrades.push(enhancedTrade);

                // Track all Order IDs
                tradeOrderIds.forEach(orderId => {
                    this.tradeDatabase.orderIds.add(orderId);
                });

                newTradeCount++;

                if (newTradeCount <= 3) {
                    console.log(`✅ Trade ${index + 1}: Added (Order IDs: ${tradeOrderIds.join(', ')})`);
                }
            }
        });

        console.log(`✅ Deduplication completed:`);
        console.log(`  📈 New trades added: ${newTradeCount}`);
        console.log(`  🔄 Duplicates found: ${duplicateCount}`);
        console.log(`  📊 Total database size: ${this.tradeDatabase.trades.length} trades`);
        console.log(`  🔐 Total Order IDs tracked: ${this.tradeDatabase.orderIds.size}`);

        return {
            newTrades: newTradeCount,
            duplicates: duplicateCount,
            totalTrades: this.tradeDatabase.trades.length,
            addedTrades
        };
    }

    /**
     * Extract Order IDs associated with a trade.
     * Reads them directly from the trade object (set by tradeCalculator from the CSV).
     * Falls back to fuzzy time+price matching only if direct IDs are missing.
     */
    extractTradeOrderIds(trade, orders) {
        const orderIds = [];

        // Priority 1: Use Order IDs already on the trade (set by tradeCalculator)
        if (trade.entryOrderId) orderIds.push(trade.entryOrderId);
        if (trade.exitOrderId) orderIds.push(trade.exitOrderId);

        // Priority 2: Try from nested order objects (set by createTradeObject)
        if (orderIds.length === 0) {
            if (trade.entryOrder?.orderId) orderIds.push(trade.entryOrder.orderId);
            if (trade.exitOrder?.orderId) orderIds.push(trade.exitOrder.orderId);
        }

        // Priority 3: Try from trade.id format "trade_{entryOrderId}_{exitOrderId}"
        if (orderIds.length === 0 && trade.id && trade.id.startsWith('trade_')) {
            const parts = trade.id.replace('trade_', '').split('_');
            parts.forEach(part => {
                if (part && part !== 'undefined' && part !== 'null') {
                    orderIds.push(part);
                }
            });
        }

        // Priority 4 (last resort): Fuzzy match by time and price
        if (orderIds.length === 0) {
            console.warn('⚠️ No direct Order IDs on trade, falling back to time+price matching');
            const tradeEntryTime = trade.entryTime;
            const tradeExitTime = trade.exitTime;
            const entryPrice = trade.entryPrice;
            const exitPrice = trade.exitPrice;

            orders.forEach(order => {
                if (!order.orderId || !order.placingTime || !order.fillPrice) return;

                const orderTime = order.placingTime;
                const orderPrice = order.fillPrice;

                if (Math.abs(orderTime - tradeEntryTime) < 60000 &&
                    Math.abs(orderPrice - entryPrice) < 0.01) {
                    orderIds.push(order.orderId);
                } else if (Math.abs(orderTime - tradeExitTime) < 60000 &&
                    Math.abs(orderPrice - exitPrice) < 0.01) {
                    orderIds.push(order.orderId);
                }
            });
        }

        return [...new Set(orderIds)]; // Remove duplicates
    }

    /**
     * Generate unique trade ID
     */
    generateTradeId() {
        return 'trade_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Format upload statistics message
     */
    formatUploadStatsMessage(stats, totalTrades) {
        if (stats.newTrades === 0 && stats.duplicates > 0) {
            return `Upload complete: ${stats.duplicates} duplicate trades found, no new trades added. Total: ${totalTrades} trades.`;
        } else if (stats.newTrades > 0 && stats.duplicates === 0) {
            return `Upload complete: ${stats.newTrades} new trades added. Total: ${totalTrades} trades.`;
        } else if (stats.newTrades > 0 && stats.duplicates > 0) {
            return `Upload complete: ${stats.newTrades} new trades added, ${stats.duplicates} duplicates found. Total: ${totalTrades} trades.`;
        } else {
            return `Upload complete: ${totalTrades} trades processed.`;
        }
    }

    /**
     * Clear all trade database data
     */
    clearTradeDatabase() {
        this.tradeDatabase = {
            trades: [],
            orderIds: new Set(),
            lastUpdated: null
        };
        localStorage.removeItem('tradle_trade_database');
        this.currentData = null;
        localStorage.removeItem('tradle_current_data');

        this.uiController.hideDashboard();
        this.uiController.showToast('All trade data cleared successfully!', 'info');
        console.log('🗑️ Trade database cleared');
    }

    /**
     * Get application statistics
     */
    getAppStats() {
        return {
            version: '1.0.0',
            hasData: !!this.currentData,
            dataAge: this.currentData ? new Date() - new Date(this.currentData.timestamp) : null,
            tradeCount: this.currentData ? this.currentData.tradeResult.trades.length : 0,
            totalProfit: this.currentData ? this.currentData.tradeResult.summary.totalProfit : 0
        };
    }

    /**
     * Export current data in various formats
     */
    exportData(format = 'csv') {
        if (!this.currentData || !this.currentData.tradeResult.trades.length) {
            throw new Error('No data to export');
        }

        switch (format.toLowerCase()) {
            case 'csv':
                return this.tradeCalculator.exportToCSV(this.currentData.tradeResult.trades);

            case 'json':
                return JSON.stringify({
                    metadata: {
                        file: this.currentData.file,
                        format: this.currentData.format,
                        exported: new Date().toISOString(),
                        version: '1.0.0'
                    },
                    summary: this.currentData.tradeResult.summary,
                    trades: this.currentData.tradeResult.trades
                }, null, 2);

            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    /**
     * Get performance analytics
     */
    getAnalytics() {
        if (!this.currentData) return null;

        const trades = this.currentData.tradeResult.trades;
        const summary = this.currentData.tradeResult.summary;

        return {
            performance: {
                totalTrades: summary.totalTrades,
                winRate: summary.winRate,
                totalProfit: summary.totalProfit,
                profitFactor: summary.profitFactor,
                sharpeRatio: summary.sharpeRatio,
                maxDrawdown: summary.maxDrawdown
            },
            streaks: {
                longestWinStreak: summary.consecutiveWins,
                longestLossStreak: summary.consecutiveLosses
            },
            timing: {
                dateRange: summary.dateRange,
                avgTradeDuration: this.calculateAvgTradeDuration(trades)
            },
            distribution: {
                wins: summary.winCount,
                losses: summary.lossCount,
                avgWin: summary.averageWin,
                avgLoss: summary.averageLoss
            }
        };
    }

    /**
     * Calculate average trade duration
     */
    calculateAvgTradeDuration(trades) {
        if (trades.length === 0) return 0;

        const totalDuration = trades.reduce((sum, trade) => {
            return sum + (trade.exitTime - trade.entryTime);
        }, 0);

        return totalDuration / trades.length;
    }

    /**
     * Handle application errors
     */
    handleError(error, context = 'general') {
        console.error(`❌ Error in ${context}:`, error);

        // Log error for debugging
        const errorLog = {
            error: error.message,
            context,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        console.log('Error details:', errorLog);

        // Show user-friendly error message
        let userMessage = 'An unexpected error occurred.';

        if (error.message.includes('CSV')) {
            userMessage = 'There was an issue processing your CSV file. Please check the format and try again.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            userMessage = 'Network error occurred. Please check your connection and try again.';
        } else if (error.message.includes('memory') || error.message.includes('storage')) {
            userMessage = 'Not enough memory to process this file. Try a smaller file.';
        }

        this.uiController.showToast(userMessage, 'error');
    }
}

/**
 * Initialize application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Global error handling
        window.addEventListener('error', (e) => {
            console.error('Global error:', e.error);
        });

        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
        });

        // Initialize the main application
        window.tradleApp = new TradleApp();

        // Make app available globally for debugging
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            window.debug = {
                app: window.tradleApp,
                parser: window.tradleApp.csvParser,
                calculator: window.tradleApp.tradeCalculator,
                ui: window.tradleApp.uiController
            };
            console.log('🔧 Debug tools available at window.debug');
        }

    } catch (error) {
        console.error('❌ Failed to initialize Tradle app:', error);

        // Show fallback error message
        document.body.innerHTML = `
            <div style="
                display: flex; 
                align-items: center; 
                justify-content: center; 
                height: 100vh; 
                text-align: center; 
                font-family: Arial, sans-serif;
                color: #dc2626;
            ">
                <div>
                    <h1>⚠️ Tradle Failed to Load</h1>
                    <p>Please refresh the page and try again.</p>
                    <p><small>Error: ${error.message}</small></p>
                </div>
            </div>
        `;
    }
});

// Service worker registration for potential future offline support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Skip service worker for now - could be added later for offline functionality
        console.log('💡 Service worker support detected (not implemented yet)');
    });
}