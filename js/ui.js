/**
 * UI Controller for Tradle Trading Journal
 * Handles all user interface interactions and updates
 */
class UIController {
    constructor() {
        this.currentTrades = [];
        this.filteredTrades = [];
        this.currentSort = { column: 'date', direction: 'desc' };
        this.currentPage = 1;
        this.tradesPerPage = 10;
        this.charts = {};
        this.chartsInitialized = false;

        this.initializeElements();
        this.bindEvents();
        this.initLiquidity();
        this.initCalendar();
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        // Navigation tabs
        this.navTabs = document.querySelectorAll('.nav-tab');

        // Sections
        this.dashboardSection = document.getElementById('dashboardSection');
        this.importSection = document.getElementById('importSection');
        this.exportSection = document.getElementById('exportSection');

        // Keep legacy reference for backward compatibility
        this.uploadSection = this.importSection;

        // Two-step import elements
        this.formatSelectionContainer = document.getElementById('formatSelectionContainer');
        this.tradingviewUploadContainer = document.getElementById('tradingviewUploadContainer');
        this.selectTradingViewBtn = document.getElementById('selectTradingViewBtn');
        this.backToFormatSelection = document.getElementById('backToFormatSelection');

        // Upload elements
        this.uploadArea = document.getElementById('uploadArea');
        this.csvFileInput = document.getElementById('csvFileInput');
        this.uploadStatus = document.getElementById('uploadStatus');
        this.formatOptions = document.querySelectorAll('input[name="csvFormat"]');

        // Dashboard elements
        this.totalPnL = document.getElementById('totalPnL');
        this.pnlChange = document.getElementById('pnlChange');
        this.winRate = document.getElementById('winRate');
        this.winRateText = document.getElementById('winRateText');
        this.totalTrades = document.getElementById('totalTrades');
        this.avgProfit = document.getElementById('avgProfit');
        this.bestTrade = document.getElementById('bestTrade');
        this.worstTrade = document.getElementById('worstTrade');

        // Table elements
        this.tradesTable = document.getElementById('tradesTable');
        this.tradesTableBody = document.getElementById('tradesTableBody');
        this.tradeSearch = document.getElementById('tradeSearch');
        this.statusFilter = document.getElementById('statusFilter');

        // Pagination elements
        this.paginationStart = document.getElementById('paginationStart');
        this.paginationEnd = document.getElementById('paginationEnd');
        this.paginationTotal = document.getElementById('paginationTotal');
        this.pageNumbers = document.getElementById('pageNumbers');
        this.prevPage = document.getElementById('prevPage');
        this.nextPage = document.getElementById('nextPage');

        // Controls
        this.darkModeToggle = document.getElementById('darkModeToggle');
        this.loadSampleBtn = document.getElementById('loadSampleBtn');
        this.exportBtn = document.getElementById('exportBtn');

        // Modal elements
        this.tradeModal = document.getElementById('tradeModal');
        this.modalBody = document.getElementById('modalBody');
        this.modalClose = document.getElementById('modalClose');
        this.closeModal = document.getElementById('closeModal');

        // Overlays
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.toastContainer = document.getElementById('toastContainer');
    }

    /**
     * Bind all event listeners
     */
    bindEvents() {
        // Tab navigation events
        this.navTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Two-step import navigation
        if (this.selectTradingViewBtn) {
            this.selectTradingViewBtn.addEventListener('click', this.showTradingViewUpload.bind(this));
        }
        if (this.backToFormatSelection) {
            this.backToFormatSelection.addEventListener('click', this.showFormatSelection.bind(this));
        }

        // File upload events
        console.log('🔧 Binding upload events');
        console.log('📁 Upload area element:', this.uploadArea);
        console.log('📄 File input element:', this.csvFileInput);

        if (this.uploadArea) {
            this.uploadArea.addEventListener('click', (e) => {
                console.log('📁 Upload area clicked!');
                console.log('📄 Triggering file input...');
                if (this.csvFileInput) {
                    this.csvFileInput.click();
                } else {
                    console.error('❌ File input element not found!');
                    this.showToast('Upload interface not properly initialized. Please refresh the page.', 'error');
                }
            });
            this.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
            this.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
            this.uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        }

        if (this.csvFileInput) {
            this.csvFileInput.addEventListener('change', this.handleFileSelect.bind(this));
        }

        // Format selection (legacy - keeping for backward compatibility)
        this.formatOptions.forEach(option => {
            option.addEventListener('change', this.handleFormatChange.bind(this));
        });

        // Controls
        this.darkModeToggle.addEventListener('click', this.toggleDarkMode.bind(this));
        // Load sample data event will be bound by main app
        this.exportBtn.addEventListener('click', this.exportTrades.bind(this));

        // Search and filter
        this.tradeSearch.addEventListener('input', this.handleSearch.bind(this));
        this.statusFilter.addEventListener('change', this.handleFilter.bind(this));

        // Table sorting
        this.tradesTable.addEventListener('click', this.handleTableSort.bind(this));

        // Pagination
        this.prevPage.addEventListener('click', () => this.changePage(this.currentPage - 1));
        this.nextPage.addEventListener('click', () => this.changePage(this.currentPage + 1));

        // Modal events
        this.modalClose.addEventListener('click', this.closeTradeModal.bind(this));
        this.closeModal.addEventListener('click', this.closeTradeModal.bind(this));
        this.tradeModal.addEventListener('click', (e) => {
            if (e.target === this.tradeModal) this.closeTradeModal();
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.tradeModal.classList.contains('active')) {
                this.closeTradeModal();
            }
        });

        // Initialize dark mode
        this.initializeDarkMode();
    }

    /**
     * Handle drag over event
     */
    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }

    /**
     * Handle drag leave event
     */
    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
    }

    /**
     * Handle file drop event
     */
    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    /**
     * Handle file selection
     */
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    /**
     * Handle format option change
     */
    handleFormatChange(e) {
        // Remove active class from all options
        document.querySelectorAll('.format-option').forEach(option => {
            option.classList.remove('active');
        });

        // Add active class to selected option
        e.target.closest('.format-option').classList.add('active');

        if (e.target.value === 'custom') {
            this.showToast('Custom format support coming soon!', 'warning');
        }
    }

    /**
     * Process uploaded file
     */
    async processFile(file) {
        try {
            this.showLoading();
            this.showUploadStatus('Processing your file...');

            // Get selected format - with defensive programming for new two-step interface
            let selectedFormat = 'tradingview'; // Default to TradingView format

            // Try to get format from radio buttons (legacy support)
            const formatRadio = document.querySelector('input[name="csvFormat"]:checked');
            if (formatRadio && formatRadio.value) {
                selectedFormat = formatRadio.value;
            } else {
                // In new two-step interface, format is determined by which step user is on
                // If tradingviewUploadContainer is visible, user selected TradingView format
                const tradingViewContainer = document.getElementById('tradingviewUploadContainer');
                if (tradingViewContainer && tradingViewContainer.style.display !== 'none') {
                    selectedFormat = 'tradingview';
                } else {
                    // Fallback: check if we're in the format selection step
                    const formatContainer = document.getElementById('formatSelectionContainer');
                    if (formatContainer && formatContainer.style.display !== 'none') {
                        // User is still in format selection, shouldn't be uploading yet
                        throw new Error('Please select a format first by clicking "TradingView Format"');
                    }
                }
            }

            console.log(`📁 Processing file with format: ${selectedFormat}`);

            // Process file through main application
            await window.tradleApp.processFile(file, selectedFormat);

        } catch (error) {
            this.hideLoading();
            this.hideUploadStatus();
            this.showToast(`Error: ${error.message}`, 'error');
        }
    }

    /**
     * Update dashboard with trade data
     */
    updateDashboard(trades, summary) {
        this.currentTrades = trades;
        this.filteredTrades = [...trades];

        // Update summary cards
        this.updateSummaryCards(summary);

        // Update charts
        this.updateCharts(trades, summary);

        // Update trading calendar
        this.updateCalendar(trades);

        // Update dashboard trades table
        this.updateDashboardTable(trades);

        // Update trade history table
        this.updateTradesTable();

        // Show dashboard and hide upload
        this.showDashboard();

        this.hideLoading();
        this.hideUploadStatus();

        this.showToast(`Successfully processed ${trades.length} trades!`, 'success');
    }

    /**
     * Update summary cards
     */
    updateSummaryCards(summary) {
        this.updateMetricCards(summary);
    }

    /**
     * Update Trademetria-style metric cards
     */
    updateMetricCards(summary) {
        // Calculate additional metrics for Trademetria-style dashboard
        // Add defensive check to ensure summary has required properties
        if (!summary) {
            console.warn('⚠️ updateMetricCards called with undefined summary - using defaults');
            summary = {
                totalProfit: 0,
                totalGrossProfit: 0,
                winCount: 0,
                lossCount: 0,
                totalTrades: 0,
                winRate: 0,
                averageProfit: 0,
                profitFactor: 0,
                dateRange: null
            };
        }

        // Store last summary so liquidity change can recalculate
        this.lastSummary = summary;

        // Ensure summary has all required properties with defaults
        const safeSummary = {
            totalProfit: 0,
            totalGrossProfit: 0,
            totalCommission: 0,
            winCount: 0,
            lossCount: 0,
            totalTrades: 0,
            winRate: 0,
            averageProfit: 0,
            profitFactor: 0,
            dateRange: null,
            ...summary
        };

        const tradingDays = this.calculateTradingDays(safeSummary.dateRange);
        const dailyNetAvg = tradingDays > 0 ? safeSummary.totalProfit / tradingDays : 0;
        const dailyGrossAvg = tradingDays > 0 ? safeSummary.totalGrossProfit / tradingDays : 0;

        // Update liquidity display
        this.updateLiquidity(safeSummary.totalProfit);

        // Row 1: Revenue metrics
        const liqBaseline = this.startingLiquidity || 100000;

        this.updateElement('netRevenue', this.formatCurrency(safeSummary.totalProfit));
        this.updateElement('netRevenueChange', this.formatPercentage(safeSummary.totalProfit, liqBaseline));
        this.updateTrendIndicator('netRevenueTrend', safeSummary.totalProfit >= 0);

        this.updateElement('dailyNetAverage', this.formatCurrency(dailyNetAvg));
        this.updateElement('dailyAvgChange', this.formatPercentage(dailyNetAvg, liqBaseline));
        this.updateTrendIndicator('dailyAvgTrend', dailyNetAvg >= 0);

        this.updateElement('grossRevenue', this.formatCurrency(safeSummary.totalGrossProfit));
        this.updateElement('grossRevenueChange', this.formatPercentage(safeSummary.totalGrossProfit, liqBaseline));
        this.updateTrendIndicator('grossRevenueTrend', safeSummary.totalGrossProfit >= 0);

        this.updateElement('dailyGrossAverage', this.formatCurrency(dailyGrossAvg));
        this.updateElement('dailyGrossChange', this.formatPercentage(dailyGrossAvg, liqBaseline));
        this.updateTrendIndicator('dailyGrossTrend', dailyGrossAvg >= 0);

        // Total commissions
        const totalComm = safeSummary.totalCommission || 0;
        this.updateElement('totalCommissions', this.formatCurrency(totalComm));
        const perTradeComm = safeSummary.totalTrades > 0 ? (totalComm / safeSummary.totalTrades).toFixed(2) : '0.00';
        this.updateElement('commissionNote', `$${perTradeComm}/trade avg · TradingView rate`);

        // Row 2: Performance metrics
        const netProfitFactor = safeSummary.profitFactor || 0;
        const grossProfitFactor = safeSummary.totalGrossProfit > 0 ? safeSummary.totalGrossProfit / Math.abs(safeSummary.totalProfit - safeSummary.totalGrossProfit) : 0;

        this.updateElement('profitFactor', `${netProfitFactor.toFixed(2)} / ${grossProfitFactor.toFixed(2)}`);
        this.updateBadge('profitFactorBadge', this.getProfitFactorStatus(netProfitFactor));
        this.updateElement('profitFactorAdvice', netProfitFactor < 2 ? 'Increase risk' : 'Good performance');

        this.updateElement('expectancyValue', this.formatCurrency(safeSummary.averageProfit || 0));
        this.updateBadge('expectancyBadge', this.getExpectancyStatus(safeSummary.averageProfit || 0));
        this.updateElement('expectancyAdvice', (safeSummary.averageProfit || 0) < 100 ? 'Increase risk' : 'Good expectancy');

        this.updateElement('winRateValue', `${(safeSummary.winRate || 0).toFixed(2)}%`);
        this.updateElement('winRateRatio', `${safeSummary.winCount || 0} wins / ${safeSummary.totalTrades || 0} total`);
        this.updateElement('winBadge', `${safeSummary.winCount || 0} W`);
        this.updateElement('lossBadge', `${safeSummary.lossCount || 0} L`);

        // Daily win rate (simplified as total win rate for now)
        this.updateElement('dailyWinRate', `${(safeSummary.winRate || 0).toFixed(2)}%`);
        this.updateElement('dailyWinRatio', `${tradingDays} days trading`);
        this.updateElement('dailyWinBadge', `${Math.ceil(tradingDays * (safeSummary.winRate || 0) / 100)} W`);
        this.updateElement('dailyLossBadge', `${Math.floor(tradingDays * (100 - (safeSummary.winRate || 0)) / 100)} L`);
    }

    /**
     * Calculate number of trading days
     */
    calculateTradingDays(dateRange) {
        if (!dateRange || !dateRange.start || !dateRange.end) return 1;
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(1, diffDays);
    }

    /**
     * Update element text content safely
     */
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * Update trend indicator
     */
    updateTrendIndicator(id, isPositive) {
        const element = document.getElementById(id);
        if (element) {
            element.className = `trend-indicator ${isPositive ? 'positive' : 'negative'}`;
            element.innerHTML = `<i class="fas fa-arrow-${isPositive ? 'up' : 'down'}"></i>`;
        }
    }

    /**
     * Update badge with status
     */
    updateBadge(id, status) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = status;
            element.className = `badge ${status.toLowerCase()}`;
        }
    }

    /**
     * Format percentage change
     */
    formatPercentage(value, baseline) {
        const percent = baseline > 0 ? (value / baseline * 100) : 0;
        return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
    }

    /**
     * Get profit factor status
     */
    getProfitFactorStatus(factor) {
        if (factor >= 2) return 'Good';
        if (factor >= 1.5) return 'Fair';
        return 'Poor';
    }

    /**
     * Get expectancy status
     */
    getExpectancyStatus(expectancy) {
        if (expectancy >= 100) return 'Good';
        if (expectancy >= 50) return 'Fair';
        return 'Poor';
    }

    /**
     * Update charts
     */
    updateCharts(trades, summary) {
        this.updatePerformanceChart(trades);
        this.updateDistributionChart(summary);
        this.updatePnLEvolutionChart(trades);
    }

    // ===== Monthly Trading Calendar =====

    /**
     * Initialize liquidity input from localStorage
     */
    initLiquidity() {
        const savedLiquidity = localStorage.getItem('tradle_starting_liquidity');
        this.startingLiquidity = savedLiquidity !== null ? parseFloat(savedLiquidity) : 100000;

        const input = document.getElementById('startingLiquidity');
        if (input) {
            input.value = this.startingLiquidity;
            input.addEventListener('change', () => {
                const val = parseFloat(input.value);
                this.startingLiquidity = isNaN(val) || val < 0 ? 0 : val;
                input.value = this.startingLiquidity;
                localStorage.setItem('tradle_starting_liquidity', String(this.startingLiquidity));
                this.updateLiquidity(this.lastNetRevenue || 0);
                // Recalculate metric card percentages with new baseline
                if (this.lastSummary) {
                    this.updateMetricCards(this.lastSummary);
                }
            });
        }
    }

    /**
     * Update current liquidity display
     */
    updateLiquidity(netRevenue) {
        this.lastNetRevenue = netRevenue;
        if (!this.startingLiquidity && this.startingLiquidity !== 0) this.initLiquidity();

        const current = this.startingLiquidity + netRevenue;
        const returnPct = this.startingLiquidity > 0 ? (netRevenue / this.startingLiquidity) * 100 : 0;

        const currentEl = document.getElementById('currentLiquidity');
        const returnEl = document.getElementById('liquidityReturn');

        if (currentEl) {
            currentEl.textContent = this.formatCurrency(current);
            currentEl.className = 'liquidity-value ' + (current >= this.startingLiquidity ? 'positive' : 'negative');
        }
        if (returnEl) {
            const sign = returnPct >= 0 ? '+' : '';
            returnEl.textContent = `${sign}${returnPct.toFixed(2)}%`;
            returnEl.className = 'liquidity-value ' + (returnPct >= 0 ? 'positive' : 'negative');
        }
    }

    /**
     * Initialize calendar state and event listeners
     */
    initCalendar() {
        this.calendarMonth = new Date().getMonth();
        this.calendarYear = new Date().getFullYear();

        // Load daily goal from localStorage or default to 500
        const savedGoal = localStorage.getItem('tradle_daily_goal');
        this.dailyGoal = savedGoal !== null ? parseFloat(savedGoal) : 500;

        // Populate the goal input
        const goalInput = document.getElementById('dailyGoalInput');
        if (goalInput) {
            goalInput.value = this.dailyGoal;
            goalInput.addEventListener('change', () => {
                const val = parseFloat(goalInput.value);
                this.dailyGoal = isNaN(val) || val < 0 ? 0 : val;
                goalInput.value = this.dailyGoal;
                localStorage.setItem('tradle_daily_goal', String(this.dailyGoal));
                this.renderCalendar(); // Re-render to update goal badges
            });
        }

        const prevBtn = document.getElementById('calendarPrevMonth');
        const nextBtn = document.getElementById('calendarNextMonth');
        if (prevBtn) prevBtn.addEventListener('click', () => this.navigateCalendar(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => this.navigateCalendar(1));
    }

    /**
     * Navigate the calendar by +/- months
     */
    navigateCalendar(delta) {
        this.calendarMonth += delta;
        if (this.calendarMonth > 11) { this.calendarMonth = 0; this.calendarYear++; }
        if (this.calendarMonth < 0) { this.calendarMonth = 11; this.calendarYear--; }
        this.renderCalendar();
    }

    /**
     * Update calendar with trade data
     */
    updateCalendar(trades) {
        if (!this.calendarMonth && this.calendarMonth !== 0) this.initCalendar();
        this.calendarTrades = trades || [];
        this.renderCalendar();
    }

    /**
     * Group trades by calendar day
     */
    groupTradesByDay(trades) {
        const dayMap = {};
        trades.forEach(trade => {
            const exitTime = trade.exitTime || trade.soldDate || trade.date;
            if (!exitTime) return;
            const d = new Date(exitTime);
            if (isNaN(d.getTime())) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!dayMap[key]) dayMap[key] = { pnl: 0, qty: 0, trades: 0, tradeList: [] };
            dayMap[key].pnl += (trade.netProfit ?? trade.returnValue ?? trade.return ?? 0);
            dayMap[key].qty += (trade.quantity ?? trade.qty ?? 0);
            dayMap[key].trades += 1;
            dayMap[key].tradeList.push(trade);
        });
        return dayMap;
    }

    /**
     * Render the full calendar grid for the current month/year
     */
    renderCalendar() {
        const grid = document.getElementById('tradingCalendarGrid');
        const label = document.getElementById('calendarMonthLabel');
        const summaryEl = document.getElementById('calendarSummary');
        if (!grid) return;

        const year = this.calendarYear;
        const month = this.calendarMonth;
        const today = new Date();

        // Month label
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        if (label) label.textContent = `Month of ${monthNames[month]} ${year}`;

        // Group trades
        const dayMap = this.groupTradesByDay(this.calendarTrades || []);
        this.calendarDayMap = dayMap; // Store for chart modal lookup

        // First day of month (0=Sun) and days in month
        const firstDow = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let html = '';

        // Header row
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayNames.forEach(name => {
            html += `<div class="calendar-header-cell">${name}</div>`;
        });

        // Empty cells before first day
        for (let i = 0; i < firstDow; i++) {
            html += '<div class="calendar-day empty"></div>';
        }

        // Stats for summary
        let totalPnl = 0;
        let positiveDays = 0, negativeDays = 0, breakevenDays = 0;
        let totalQty = 0, totalTradeCount = 0;
        let winningTrades = 0, losingTrades = 0;
        let winningPnl = 0, losingPnl = 0;

        // Day cells
        for (let day = 1; day <= daysInMonth; day++) {
            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const data = dayMap[key];
            const isToday = (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day);

            let classes = 'calendar-day';
            if (isToday) classes += ' today';

            if (data) {
                classes += ' has-trades';
                if (data.pnl > 0) { classes += ' positive'; positiveDays++; }
                else if (data.pnl < 0) { classes += ' negative'; negativeDays++; }
                else { classes += ' breakeven'; breakevenDays++; }

                totalPnl += data.pnl;
                totalQty += data.qty;
                totalTradeCount += data.trades;

                // Count winning/losing individual trades
                if (data.tradeList) {
                    data.tradeList.forEach(t => {
                        const pnl = t.netProfit ?? t.returnValue ?? 0;
                        if (pnl >= 0) { winningTrades++; winningPnl += pnl; }
                        else { losingTrades++; losingPnl += pnl; }
                    });
                }

                const goalReached = data.pnl >= this.dailyGoal;

                // Collect unique symbols for this day
                const daySymbols = data.tradeList ? [...new Set(data.tradeList.map(t => {
                    const raw = t.contract || t.symbol || '';
                    return raw.replace(/^[A-Z_]+:/, '');  // Strip exchange prefix
                }).filter(Boolean))] : [];

                html += `<div class="${classes} clickable" data-day-key="${key}" title="Click to view trades">`;
                html += `<div class="calendar-day-number">${day}</div>`;
                if (daySymbols.length) {
                    html += `<div class="calendar-day-symbols">${daySymbols.join(', ')}</div>`;
                }
                html += `<div class="calendar-day-pnl">Pnl: $${this.formatCalendarNumber(data.pnl)}</div>`;
                html += `<div class="calendar-day-qty">Quantity: ${this.formatCalendarNumber(data.qty)}</div>`;
                html += `<div class="calendar-day-trades">Trades: ${data.trades}</div>`;
                if (goalReached) {
                    html += `<div class="calendar-goal-badge"><i class="fas fa-trophy"></i> Goal</div>`;
                }
                html += '</div>';
            } else {
                html += `<div class="${classes}">`;
                html += `<div class="calendar-day-number">${day}</div>`;
                html += '</div>';
            }
        }

        grid.innerHTML = html;

        // Attach click handlers on entire trade-day cells
        grid.querySelectorAll('.calendar-day.clickable').forEach(cell => {
            cell.addEventListener('click', () => {
                const dayKey = cell.dataset.dayKey;
                if (this.calendarDayMap && this.calendarDayMap[dayKey]) {
                    this.openDayChartModal(dayKey, this.calendarDayMap[dayKey]);
                }
            });
        });

        // Summary footer
        if (summaryEl) {
            const pnlClass = totalPnl >= 0 ? 'positive' : 'negative';
            const tradingDays = positiveDays + negativeDays + breakevenDays;
            const avgPerDay = tradingDays > 0 ? totalPnl / tradingDays : 0;
            const avgClass = avgPerDay >= 0 ? 'positive' : 'negative';

            summaryEl.innerHTML =
                `Total P&L: <span class="highlight ${pnlClass}">$${this.formatCalendarNumber(totalPnl)}</span> &nbsp;|&nbsp; ` +
                `<span class="highlight">${totalTradeCount}</span> trades &nbsp;|&nbsp; ` +
                `<span class="highlight">${this.formatCalendarNumber(totalQty)}</span> contracts &nbsp;|&nbsp; ` +
                `Avg/day: <span class="highlight ${avgClass}">$${this.formatCalendarNumber(avgPerDay)}</span><br>` +
                `<span class="highlight positive">${positiveDays}</span> green day${positiveDays !== 1 ? 's' : ''} · ` +
                `<span class="highlight negative">${negativeDays}</span> red day${negativeDays !== 1 ? 's' : ''} · ` +
                `<span class="highlight positive">${winningTrades} W</span> ($${this.formatCalendarNumber(winningPnl)}) · ` +
                `<span class="highlight negative">${losingTrades} L</span> ($${this.formatCalendarNumber(losingPnl)})`;
        }
    }

    /**
     * Format number for calendar display (with commas, 2 decimals)
     */
    formatCalendarNumber(num) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    /**
     * Open the TradingView chart modal for a specific calendar day
     */
    openDayChartModal(dayKey, dayData) {
        const modal = document.getElementById('chartModal');
        const titleEl = document.getElementById('chartModalTitle');
        const tradesEl = document.getElementById('chartModalTrades');
        if (!modal || !tradesEl) return;

        // Parse the day key for display
        const [y, m, d] = dayKey.split('-');
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });

        const trades = dayData.tradeList || [];

        // Title
        if (titleEl) {
            const pnlClass = dayData.pnl >= 0 ? 'positive' : 'negative';
            titleEl.innerHTML = `<i class="fas fa-calendar-day"></i> ${dateStr} &mdash; <span class="highlight ${pnlClass}">${this.formatCurrency(dayData.pnl)}</span>`;
        }

        // Day summary bar
        const wins = trades.filter(t => (t.status === 'WIN' || (t.netProfit ?? 0) >= 0)).length;
        const losses = trades.length - wins;
        const totalQty = trades.reduce((s, t) => s + (t.quantity ?? t.qty ?? 0), 0);
        const uniqueSymbols = [...new Set(trades.map(t => {
            const raw = t.contract || t.symbol || '';
            return raw.replace(/^[A-Z_]+:/, '');
        }).filter(Boolean))];
        const symbolsDisplay = uniqueSymbols.length ? uniqueSymbols.join(', ') : '-';
        let html = `
            <div class="day-trades-summary">
                <div class="summary-stat"><div class="stat-value">${trades.length}</div><div class="stat-label">Trades</div></div>
                <div class="summary-stat"><div class="stat-value" style="color:var(--success-color)">${wins} W</div><div class="stat-label">Wins</div></div>
                <div class="summary-stat"><div class="stat-value" style="color:var(--danger-color)">${losses} L</div><div class="stat-label">Losses</div></div>
                <div class="summary-stat"><div class="stat-value">${totalQty}</div><div class="stat-label">Contracts</div></div>
                <div class="summary-stat"><div class="stat-value">${symbolsDisplay}</div><div class="stat-label">Symbols</div></div>
            </div>
        `;

        // Build trade cards
        trades.forEach((trade, i) => {
            const pnl = trade.netProfit ?? trade.returnValue ?? trade.return ?? 0;
            const status = trade.status || (pnl >= 0 ? 'WIN' : 'LOSE');
            const statusClass = status === 'WIN' ? 'win' : 'lose';
            const pnlClass = pnl >= 0 ? 'positive' : 'negative';
            const entryPrice = trade.entry ?? trade.entryPrice ?? 0;
            const exitPrice = trade.exit ?? trade.exitPrice ?? 0;
            const qty = trade.quantity ?? trade.qty ?? 1;
            const side = trade.side || 'LONG';
            const duration = trade.duration || '-';
            const rawSymbol = trade.contract || trade.symbol || 'CME_MINI:ES1!';
            const tvSymbol = rawSymbol.includes(':') ? rawSymbol : `CME_MINI:${rawSymbol}`;

            // Format entry/exit times
            let entryTimeStr = '-', exitTimeStr = '-';
            try {
                const et = new Date(trade.entryTime || trade.boughtDate);
                if (!isNaN(et.getTime())) entryTimeStr = et.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            } catch (e) { /* ignore */ }
            try {
                const xt = new Date(trade.exitTime || trade.soldDate || trade.date);
                if (!isNaN(xt.getTime())) exitTimeStr = xt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            } catch (e) { /* ignore */ }

            // Build TradingView URL — opens the chart on your TradingView account
            const tvUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}&interval=5`;

            const displaySymbol = rawSymbol.replace(/^[A-Z_]+:/, '');

            html += `
                <div class="chart-trade-card ${statusClass}">
                    <div class="trade-card-header">
                        <span class="trade-card-status ${statusClass}">Trade ${i + 1} · ${status} · <span style="color:var(--primary-color)">${displaySymbol}</span></span>
                        <span class="trade-card-pnl ${pnlClass}">${this.formatCurrency(pnl)}</span>
                    </div>
                    <div class="chart-trade-detail"><span class="label">Side</span><span class="value">${side} × ${qty}</span></div>
                    <div class="chart-trade-detail"><span class="label"><span class="entry-marker"></span>Entry</span><span class="value">${this.formatCurrency(entryPrice)} @ ${entryTimeStr}</span></div>
                    <div class="chart-trade-detail"><span class="label"><span class="exit-marker"></span>Exit</span><span class="value">${this.formatCurrency(exitPrice)} @ ${exitTimeStr}</span></div>
                    <div class="chart-trade-detail"><span class="label">Duration</span><span class="value">${duration}</span></div>
                    <a class="btn-open-tradingview" href="${tvUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
                        <i class="fas fa-external-link-alt"></i> View on TradingView
                    </a>
                </div>
            `;
        });

        tradesEl.innerHTML = html;

        // Show modal
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Close handlers
        const closeBtn = document.getElementById('chartModalClose');
        const closeHandler = () => this.closeDayChartModal();
        if (closeBtn) {
            closeBtn.onclick = closeHandler;
        }
        modal.onclick = (e) => {
            if (e.target === modal) this.closeDayChartModal();
        };
    }

    /**
     * Close the day trades modal
     */
    closeDayChartModal() {
        const modal = document.getElementById('chartModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    /**
     * Update PnL Evolution chart (Trademetria-style)
     */
    updatePnLEvolutionChart(trades) {
        const ctx = document.getElementById('pnlEvolutionChart');
        if (!ctx) return;

        if (this.charts.pnlEvolution) {
            try {
                this.charts.pnlEvolution.destroy();
            } catch (error) {
                console.warn('Warning destroying PnL Evolution chart:', error);
            }
            this.charts.pnlEvolution = null;
        }

        const evolutionData = this.getPnLEvolutionData(trades);

        this.charts.pnlEvolution = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: evolutionData.labels,
                datasets: [{
                    label: 'Portfolio Value',
                    data: evolutionData.values,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => {
                                return `Portfolio: ${this.formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6b7280',
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        display: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6b7280',
                            font: {
                                size: 11
                            },
                            callback: (value) => {
                                return this.formatCurrency(value);
                            }
                        }
                    }
                },
                elements: {
                    point: {
                        hoverRadius: 8
                    }
                }
            }
        });

        this.setupChartControls();
    }

    /**
     * Get PnL evolution data for chart
     */
    getPnLEvolutionData(trades) {
        if (!trades || trades.length === 0) {
            return { labels: ['Start'], values: [0] };
        }

        const labels = ['Start'];
        const values = [0];
        let cumulativePnL = 0;

        trades.forEach((trade, index) => {
            cumulativePnL += trade.netProfit || 0;
            labels.push(`Trade ${index + 1}`);
            values.push(cumulativePnL);
        });

        return { labels, values };
    }

    /**
     * Setup chart period controls
     */
    setupChartControls() {
        const chartButtons = document.querySelectorAll('.btn-chart');
        chartButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all buttons
                chartButtons.forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                e.target.classList.add('active');

                // You can implement period filtering here
                const period = e.target.dataset.period;
                console.log(`Switching to ${period} view`);
            });
        });
    }

    /**
     * Update performance chart
     */
    updatePerformanceChart(trades) {
        const ctx = document.getElementById('performanceChart').getContext('2d');

        if (this.charts.performance) {
            try {
                this.charts.performance.destroy();
            } catch (error) {
                console.warn('Warning destroying Performance chart:', error);
            }
            this.charts.performance = null;
        }

        const chartData = this.getPerformanceChartData(trades);

        this.charts.performance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.map((_, i) => `Trade ${i + 1}`),
                datasets: [{
                    label: 'Cumulative P&L',
                    data: chartData.map(d => d.y),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    /**
     * Update distribution chart
     */
    updateDistributionChart(summary) {
        const ctx = document.getElementById('distributionChart');
        if (!ctx) return;

        if (this.charts.distribution) {
            try {
                this.charts.distribution.destroy();
            } catch (error) {
                console.warn('Warning destroying Distribution chart:', error);
            }
            this.charts.distribution = null;
        }

        // Beautiful color palette for wins (emerald) and losses (rose)
        const colors = {
            wins: {
                primary: '#10b981',
                light: '#d1fae5',
                hover: '#059669'
            },
            losses: {
                primary: '#ef4444',
                light: '#fee2e2',
                hover: '#dc2626'
            }
        };

        this.charts.distribution = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Wins', 'Losses'],
                datasets: [{
                    data: [summary.winCount, summary.lossCount],
                    backgroundColor: [colors.wins.primary, colors.losses.primary],
                    hoverBackgroundColor: [colors.wins.hover, colors.losses.hover],
                    borderWidth: 3,
                    borderColor: '#ffffff',
                    hoverBorderWidth: 4,
                    hoverBorderColor: '#ffffff',
                    // Add spacing between segments
                    spacing: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 1,
                // Ensure proper sizing constraints
                layout: {
                    padding: 10
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        align: 'center',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: {
                                size: 12,
                                weight: '500'
                            },
                            color: 'var(--text-primary)',
                            generateLabels: (chart) => {
                                const data = chart.data;
                                const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                    return {
                                        text: `${label}: ${value} (${percentage}%)`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        strokeStyle: data.datasets[0].backgroundColor[i],
                                        pointStyle: 'circle',
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            title: (context) => {
                                return context[0].label;
                            },
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const value = context.parsed;
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${value} trades (${percentage}%)`;
                            }
                        }
                    }
                },
                // Add smooth animations
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                // Interaction settings
                interaction: {
                    intersect: false
                },
                // Cutout for doughnut hole (makes it more modern)
                cutout: '60%',
                // Radius settings for better proportions
                radius: '85%'
            }
        });
    }

    /**
     * Get performance chart data
     */
    getPerformanceChartData(trades) {
        let runningTotal = 0;
        return trades.map((trade, index) => {
            runningTotal += trade.netProfit;
            return { x: index + 1, y: runningTotal };
        });
    }

    /**
     * Update dashboard trades table with today's trades (or latest trading day)
     */
    updateDashboardTable(trades) {
        const dashboardBody = document.getElementById('dashboardTradesBody');
        const subtitleEl = document.getElementById('todayTradesSubtitle');
        if (!dashboardBody) return;

        dashboardBody.innerHTML = '';

        if (!trades || trades.length === 0) {
            dashboardBody.innerHTML = '<tr class="no-data"><td colspan="6">No trades available</td></tr>';
            return;
        }

        // Get today's date string (YYYY-MM-DD)
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        // Filter trades for today
        let todayTrades = trades.filter(trade => {
            const exitTime = trade.exitTime || trade.soldDate || trade.date;
            if (!exitTime) return false;
            const d = new Date(exitTime);
            if (isNaN(d.getTime())) return false;
            const tradeDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return tradeDate === todayStr;
        });

        let label = 'Today';

        // If no trades today, show the most recent trading day
        if (todayTrades.length === 0) {
            // Find the latest trade date
            const sortedByDate = [...trades]
                .filter(t => t.exitTime || t.soldDate || t.date)
                .sort((a, b) => {
                    const da = new Date(a.exitTime || a.soldDate || a.date);
                    const db = new Date(b.exitTime || b.soldDate || b.date);
                    return db - da;
                });

            if (sortedByDate.length > 0) {
                const latestDate = new Date(sortedByDate[0].exitTime || sortedByDate[0].soldDate || sortedByDate[0].date);
                const latestStr = `${latestDate.getFullYear()}-${String(latestDate.getMonth() + 1).padStart(2, '0')}-${String(latestDate.getDate()).padStart(2, '0')}`;

                todayTrades = trades.filter(trade => {
                    const exitTime = trade.exitTime || trade.soldDate || trade.date;
                    if (!exitTime) return false;
                    const d = new Date(exitTime);
                    if (isNaN(d.getTime())) return false;
                    const tradeDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    return tradeDate === latestStr;
                });

                label = latestDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            }
        }

        // Update subtitle
        if (subtitleEl) {
            const totalPnl = todayTrades.reduce((s, t) => s + (t.netProfit ?? t.returnValue ?? 0), 0);
            const pnlClass = totalPnl >= 0 ? 'positive' : 'negative';
            subtitleEl.innerHTML = `${label} — <span class="${pnlClass}">${this.formatCurrency(totalPnl)}</span> · ${todayTrades.length} trades`;
        }

        // Sort by time (most recent first)
        todayTrades.sort((a, b) => {
            const da = new Date(a.exitTime || a.soldDate || a.date || 0);
            const db = new Date(b.exitTime || b.soldDate || b.date || 0);
            return db - da;
        });

        if (todayTrades.length === 0) {
            dashboardBody.innerHTML = '<tr class="no-data"><td colspan="6">No trades today</td></tr>';
            return;
        }

        todayTrades.forEach((trade, index) => {
            try {
                const row = document.createElement('tr');
                row.onclick = () => {
                    const tradesSection = document.querySelector('.trades-section');
                    if (tradesSection) tradesSection.scrollIntoView({ behavior: 'smooth' });
                };

                const statusClass = (trade.status === 'WIN' || trade.isWin) ? 'win' : 'lose';
                const returnClass = trade.netProfit >= 0 ? 'positive' : 'negative';
                const entryPrice = trade.entry || trade.entryPrice || 0;
                const exitPrice = trade.exit || trade.exitPrice || 0;

                // Show time instead of full date since all are same day
                let timeStr = '';
                try {
                    const exitDate = new Date(trade.exitTime || trade.soldDate || trade.date);
                    if (!isNaN(exitDate.getTime())) {
                        timeStr = exitDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                    }
                } catch (e) { /* ignore */ }

                row.innerHTML = `
                    <td>${timeStr}</td>
                    <td>${trade.contract || 'ES1!'}</td>
                    <td><span class="side side-${(trade.side?.toLowerCase() || 'long')}">${trade.side || 'LONG'}</span></td>
                    <td>${this.formatCurrency(entryPrice)} → ${this.formatCurrency(exitPrice)}</td>
                    <td class="return ${returnClass}">${this.formatCurrency(trade.netProfit || 0)}</td>
                    <td><span class="status ${statusClass}">${trade.status || 'N/A'}</span></td>
                `;

                dashboardBody.appendChild(row);
            } catch (rowError) {
                console.error(`❌ Error creating dashboard row ${index + 1}:`, rowError);
            }
        });
    }

    /**
     * Test dashboard table population manually
     */
    testDashboardTable() {
        console.log('🧪 Testing dashboard table...');

        // Create test trade data
        const testTrades = [{
            date: '2026-02-11 17:00:00',
            contract: 'CME_MINI:ES1!',
            side: 'LONG',
            entry: 6970.75,
            exit: 6976.75,
            netProfit: 300,
            status: 'WIN'
        }];

        // Try to populate table
        this.updateDashboardTable(testTrades);

        return testTrades;
    }

    /**
     * Update trade history performance table
     */
    updateTradeHistoryPerformanceTable(trades) {
        console.log('📊 updateTradeHistoryPerformanceTable called with trades:', trades);
        const tableBody = document.getElementById('tradeHistoryPerformanceBody');

        if (!tableBody) {
            console.error('❌ tradeHistoryPerformanceBody element not found!');
            return;
        }

        // Clear existing content
        tableBody.innerHTML = '';

        if (!trades || trades.length === 0) {
            console.log('❌ No trades provided to trade history performance table');
            tableBody.innerHTML = `
                <tr class="no-data">
                    <td colspan="11">
                        <div class="no-data-message">
                            <i class="fas fa-chart-line"></i>
                            <h4>No Trade History</h4>
                            <p>Upload your trading data to see comprehensive trade history here.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        console.log('✅ About to populate trade history performance table with', trades.length, 'trades');

        // Store trades for filtering/sorting
        this.tradeHistoryTrades = trades;
        this.filteredTradeHistoryTrades = [...trades];

        // Initialize pagination
        this.tradeHistoryCurrentPage = 1;
        this.tradeHistoryRowsPerPage = 20;

        // Setup event listeners for search and filter
        this.setupTradeHistoryControls();

        // Render the table
        this.renderTradeHistoryTable();
    }

    /**
     * Setup trade history controls (search, filter, sort)
     */
    setupTradeHistoryControls() {
        const searchInput = document.getElementById('tradeHistorySearch');
        const statusFilter = document.getElementById('tradeHistoryStatusFilter');
        const sortableHeaders = document.querySelectorAll('.trade-history-table th.sortable');

        // Search functionality
        if (searchInput) {
            searchInput.addEventListener('input', () => this.handleTradeHistorySearch());
        }

        // Filter functionality
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.handleTradeHistoryFilter());
        }

        // Sort functionality
        sortableHeaders.forEach(header => {
            header.addEventListener('click', () => this.handleTradeHistorySort(header.dataset.sort));
        });

        // Export functionality
        const exportBtn = document.getElementById('exportTradeHistoryBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportTradeHistory());
        }

        // Pagination controls
        const prevBtn = document.getElementById('tradeHistoryPrevPage');
        const nextBtn = document.getElementById('tradeHistoryNextPage');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.changeTradeHistoryPage(-1));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.changeTradeHistoryPage(1));
        }
    }

    /**
     * Render trade history table with current filtered/sorted data
     */
    renderTradeHistoryTable() {
        const tableBody = document.getElementById('tradeHistoryPerformanceBody');
        if (!tableBody) return;

        // Apply filters and search
        this.applyTradeHistoryFilters();

        // Calculate pagination
        const totalTrades = this.filteredTradeHistoryTrades.length;
        const totalPages = Math.ceil(totalTrades / this.tradeHistoryRowsPerPage);
        const startIndex = (this.tradeHistoryCurrentPage - 1) * this.tradeHistoryRowsPerPage;
        const endIndex = Math.min(startIndex + this.tradeHistoryRowsPerPage, totalTrades);
        const pageTrades = this.filteredTradeHistoryTrades.slice(startIndex, endIndex);

        // Clear table
        tableBody.innerHTML = '';

        if (pageTrades.length === 0) {
            tableBody.innerHTML = `
                <tr class="no-data">
                    <td colspan="11">
                        <div class="no-data-message">
                            <i class="fas fa-search"></i>
                            <h4>No Matching Trades</h4>
                            <p>Try adjusting your search or filter criteria.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Create table rows
        pageTrades.forEach((trade, index) => {
            try {
                const row = document.createElement('tr');

                // Calculate duration
                const duration = this.calculateTradeDuration(trade);

                // Format data
                const statusClass = (trade.status === 'WIN' || trade.isWin) ? 'win' : 'lose';
                const returnClass = trade.netProfit >= 0 ? 'positive' : 'negative';
                const sideClass = trade.side?.toLowerCase() || 'long';

                row.innerHTML = `
                    <td>${this.formatDate(trade.date || trade.exitTime)}</td>
                    <td>${trade.contract || trade.symbol || 'ES1!'}</td>
                    <td><span class="side side-${sideClass}">${trade.side || 'LONG'}</span></td>
                    <td>${this.formatCurrency(trade.entry || trade.entryPrice || 0)}</td>
                    <td>${this.formatCurrency(trade.exit || trade.exitPrice || 0)}</td>
                    <td>${trade.quantity || 1}</td>
                    <td class="return ${returnClass}">${this.formatCurrency(trade.netProfit || 0)}</td>
                    <td><span class="status ${statusClass}">${trade.status || 'N/A'}</span></td>
                    <td class="duration">${duration}</td>
                `;

                tableBody.appendChild(row);

            } catch (rowError) {
                console.error(`❌ Error creating trade history row ${index + 1}:`, rowError);
                console.error('Trade data:', trade);
            }
        });

        // Update pagination info
        this.updateTradeHistoryPagination(startIndex + 1, endIndex, totalTrades, totalPages);
    }

    /**
     * Calculate trade duration
     */
    calculateTradeDuration(trade) {
        try {
            const entryTime = new Date(trade.boughtDate || trade.entryTime || trade.date);
            const exitTime = new Date(trade.soldDate || trade.exitTime || trade.date);

            if (isNaN(entryTime.getTime()) || isNaN(exitTime.getTime())) {
                return '—';
            }

            const durationMs = exitTime.getTime() - entryTime.getTime();
            const hours = Math.floor(durationMs / (1000 * 60 * 60));
            const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

            if (hours < 24) {
                return `${hours}h ${minutes}m`;
            } else {
                const days = Math.floor(hours / 24);
                const remainingHours = hours % 24;
                return `${days}d ${remainingHours}h`;
            }
        } catch (error) {
            return '—';
        }
    }

    /**
     * Apply filters and search to trade history
     */
    applyTradeHistoryFilters() {
        let filtered = [...this.tradeHistoryTrades];

        // Apply search
        const searchTerm = document.getElementById('tradeHistorySearch')?.value.toLowerCase() || '';
        if (searchTerm) {
            filtered = filtered.filter(trade =>
                (trade.contract || trade.symbol || '').toLowerCase().includes(searchTerm) ||
                (trade.side || '').toLowerCase().includes(searchTerm) ||
                (trade.status || '').toLowerCase().includes(searchTerm) ||
                (trade.date || '').toLowerCase().includes(searchTerm)
            );
        }

        // Apply status filter
        const statusFilter = document.getElementById('tradeHistoryStatusFilter')?.value || 'all';
        if (statusFilter !== 'all') {
            filtered = filtered.filter(trade => trade.status === statusFilter);
        }

        this.filteredTradeHistoryTrades = filtered;
    }

    /**
     * Handle trade history search
     */
    handleTradeHistorySearch() {
        this.tradeHistoryCurrentPage = 1; // Reset to first page
        this.renderTradeHistoryTable();
    }

    /**
     * Handle trade history filter
     */
    handleTradeHistoryFilter() {
        this.tradeHistoryCurrentPage = 1; // Reset to first page
        this.renderTradeHistoryTable();
    }

    /**
     * Handle trade history sort
     */
    handleTradeHistorySort(sortField) {
        // Toggle sort direction
        if (this.tradeHistorySortField === sortField) {
            this.tradeHistorySortDirection = this.tradeHistorySortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.tradeHistorySortField = sortField;
            this.tradeHistorySortDirection = 'desc'; // Default to descending for most fields
        }

        // Update header indicators
        document.querySelectorAll('.trade-history-table th.sortable').forEach(th => {
            th.classList.remove('sorted', 'asc', 'desc');
        });

        const sortedHeader = document.querySelector(`.trade-history-table th[data-sort="${sortField}"]`);
        if (sortedHeader) {
            sortedHeader.classList.add('sorted', this.tradeHistorySortDirection);
        }

        // Sort the filtered trades
        this.filteredTradeHistoryTrades.sort((a, b) => {
            let aValue = this.getTradeValue(a, sortField);
            let bValue = this.getTradeValue(b, sortField);

            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            if (aValue < bValue) return this.tradeHistorySortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return this.tradeHistorySortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        this.renderTradeHistoryTable();
    }

    /**
     * Get trade value for sorting
     */
    getTradeValue(trade, field) {
        switch (field) {
            case 'date': return new Date(trade.date || trade.exitTime);
            case 'symbol': return trade.contract || trade.symbol || '';
            case 'side': return trade.side || '';
            case 'entry': return parseFloat(trade.entry || trade.entryPrice || 0);
            case 'exit': return parseFloat(trade.exit || trade.exitPrice || 0);
            case 'quantity': return parseFloat(trade.quantity || 1);
            case 'return': return parseFloat(trade.netProfit || 0);
            case 'status': return trade.status || '';
            default: return '';
        }
    }

    /**
     * Change trade history page
     */
    changeTradeHistoryPage(direction) {
        const totalPages = Math.ceil(this.filteredTradeHistoryTrades.length / this.tradeHistoryRowsPerPage);
        const newPage = this.tradeHistoryCurrentPage + direction;

        if (newPage >= 1 && newPage <= totalPages) {
            this.tradeHistoryCurrentPage = newPage;
            this.renderTradeHistoryTable();
        }
    }

    /**
     * Update trade history pagination display
     */
    updateTradeHistoryPagination(start, end, total, totalPages) {
        const startSpan = document.getElementById('tradeHistoryStart');
        const endSpan = document.getElementById('tradeHistoryEnd');
        const totalSpan = document.getElementById('tradeHistoryTotal');
        const prevBtn = document.getElementById('tradeHistoryPrevPage');
        const nextBtn = document.getElementById('tradeHistoryNextPage');

        if (startSpan) startSpan.textContent = start;
        if (endSpan) endSpan.textContent = end;
        if (totalSpan) totalSpan.textContent = total;

        if (prevBtn) {
            prevBtn.disabled = this.tradeHistoryCurrentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.tradeHistoryCurrentPage >= totalPages;
        }
    }

    /**
     * Export trade history
     */
    exportTradeHistory() {
        if (!this.filteredTradeHistoryTrades || this.filteredTradeHistoryTrades.length === 0) {
            this.showToast('No trade history data to export', 'warning');
            return;
        }

        // Create CSV content
        const headers = ['Date', 'Symbol', 'Side', 'Entry', 'Exit', 'Quantity', 'Return', 'Status', 'Duration'];
        const csvContent = [
            headers.join(','),
            ...this.filteredTradeHistoryTrades.map(trade => [
                trade.date || trade.exitTime || '',
                trade.contract || trade.symbol || '',
                trade.side || '',
                trade.entry || trade.entryPrice || 0,
                trade.exit || trade.exitPrice || 0,
                trade.quantity || 1,
                trade.netProfit || 0,
                trade.status || '',
                this.calculateTradeDuration(trade)
            ].join(','))
        ].join('\n');

        // Download file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trade-history-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.showToast('Trade history exported successfully', 'success');
    }

    /**
     * Update trades table
     */
    updateTradesTable() {
        try {
            if (!this.tradesTableBody || !this.currentTrades || this.currentTrades.length === 0) {
                console.log('📋 Trade History: No trades to display');
                return;
            }

            console.log('📋 updateTradesTable called with', this.currentTrades.length, 'trades');

            // Apply filters and search
            this.applyFiltersAndSearch();

            // Sort data
            this.sortTrades();

            // Update pagination
            this.updatePagination();

            // Render table rows
            this.renderTableRows();
        } catch (error) {
            console.error('❌ Error updating trades table:', error);
        }
    }

    /**
     * Apply search and filters
     */
    applyFiltersAndSearch() {
        let filtered = [...this.currentTrades];

        // Apply search
        const searchTerm = this.tradeSearch?.value?.toLowerCase().trim() || '';
        if (searchTerm) {
            filtered = filtered.filter(trade => {
                const contract = (trade.contract || trade.symbol || '').toLowerCase();
                const status = (trade.status || '').toLowerCase();
                const entry = (trade.entry ?? trade.entryPrice ?? '').toString();
                const exit = (trade.exit ?? trade.exitPrice ?? '').toString();
                return contract.includes(searchTerm) ||
                    status.includes(searchTerm) ||
                    entry.includes(searchTerm) ||
                    exit.includes(searchTerm);
            });
        }

        // Apply status filter
        const statusFilter = this.statusFilter?.value || '';
        if (statusFilter) {
            filtered = filtered.filter(trade => trade.status === statusFilter);
        }

        this.filteredTrades = filtered;
        this.currentPage = 1; // Reset to first page
    }

    /**
     * Sort trades
     */
    sortTrades() {
        const { column, direction } = this.currentSort;

        this.filteredTrades.sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];

            // Handle different data types
            if (column === 'date') {
                aVal = new Date(a.entryTime);
                bVal = new Date(b.entryTime);
            } else if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            let comparison = 0;
            if (aVal < bVal) comparison = -1;
            else if (aVal > bVal) comparison = 1;

            return direction === 'desc' ? -comparison : comparison;
        });
    }

    /**
     * Handle table sort
     */
    handleTableSort(e) {
        const th = e.target.closest('th[data-sort]');
        if (!th) return;

        const column = th.dataset.sort;

        // Toggle sort direction
        if (this.currentSort.column === column) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.column = column;
            this.currentSort.direction = 'desc';
        }

        // Update table header appearance
        this.updateSortHeaders(column, this.currentSort.direction);

        // Re-render table
        this.updateTradesTable();
    }

    /**
     * Update sort headers
     */
    updateSortHeaders(activeColumn, direction) {
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.classList.remove('sorted');
            const icon = th.querySelector('i');
            icon.className = 'fas fa-sort';
        });

        const activeHeader = document.querySelector(`th[data-sort="${activeColumn}"]`);
        activeHeader.classList.add('sorted');
        const activeIcon = activeHeader.querySelector('i');
        activeIcon.className = direction === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
    }

    /**
     * Update pagination
     */
    updatePagination() {
        const totalTrades = this.filteredTrades.length;
        const totalPages = Math.ceil(totalTrades / this.tradesPerPage);

        // Update pagination info
        const start = (this.currentPage - 1) * this.tradesPerPage + 1;
        const end = Math.min(this.currentPage * this.tradesPerPage, totalTrades);

        this.paginationStart.textContent = totalTrades > 0 ? start : 0;
        this.paginationEnd.textContent = end;
        this.paginationTotal.textContent = totalTrades;

        // Update pagination controls
        this.prevPage.disabled = this.currentPage <= 1;
        this.nextPage.disabled = this.currentPage >= totalPages;

        // Update page numbers
        this.renderPageNumbers(totalPages);
    }

    /**
     * Render page numbers
     */
    renderPageNumbers(totalPages) {
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        let html = '';

        for (let i = startPage; i <= endPage; i++) {
            html += `
                <button class="page-number ${i === this.currentPage ? 'active' : ''}" 
                        data-page="${i}">${i}</button>
            `;
        }

        this.pageNumbers.innerHTML = html;

        // Add click events to page numbers
        this.pageNumbers.querySelectorAll('.page-number').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.changePage(parseInt(e.target.dataset.page));
            });
        });
    }

    /**
     * Change page
     */
    changePage(page) {
        const totalPages = Math.ceil(this.filteredTrades.length / this.tradesPerPage);

        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.updatePagination();
            this.renderTableRows();
        }
    }

    /**
     * Render table rows
     */
    renderTableRows() {
        if (!this.tradesTableBody) return;

        const start = (this.currentPage - 1) * this.tradesPerPage;
        const end = start + this.tradesPerPage;
        const pageTrades = this.filteredTrades.slice(start, end);

        if (pageTrades.length === 0) {
            this.tradesTableBody.innerHTML = `
                <tr class="no-data-row">
                    <td colspan="11">
                        <div class="no-data-message">
                            <i class="fas fa-search"></i>
                            <h4>No Matching Trades</h4>
                            <p>Try adjusting your search or filter criteria.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const html = pageTrades.map(trade => {
            try {
                return this.createTradeRow(trade);
            } catch (err) {
                console.error('❌ Error creating trade row:', err, trade);
                return '';
            }
        }).join('');

        this.tradesTableBody.innerHTML = html;

        // Add click events to rows
        this.tradesTableBody.querySelectorAll('tr.trade-row').forEach(row => {
            row.addEventListener('click', () => {
                const tradeId = row.dataset.tradeId;
                const trade = this.currentTrades.find(t => t.id === tradeId);
                if (trade) this.showTradeModal(trade);
            });
        });
    }

    /**
     * Create table row HTML
     */
    createTradeRow(trade) {
        const pnl = trade.netProfit ?? trade.returnValue ?? trade.return ?? 0;
        const profitClass = pnl >= 0 ? 'profit-positive' : 'profit-negative';
        const status = trade.status || (pnl >= 0 ? 'WIN' : 'LOSE');
        const statusClass = status.toLowerCase();
        const side = trade.side || 'LONG';
        const qty = trade.quantity ?? trade.qty ?? 1;
        const entryPrice = trade.entry ?? trade.entryPrice ?? 0;
        const exitPrice = trade.exit ?? trade.exitPrice ?? 0;
        const dateValue = trade.entryTime || trade.date || trade.boughtDate;
        const dateStr = dateValue ? this.formatDate(new Date(dateValue)) : '-';
        const duration = trade.duration || '-';

        // Try to get margin from trade.margin or from the embedded order objects
        let margin = trade.margin || 0;
        if (!margin && trade.entryOrder && trade.entryOrder.margin) {
            const m = String(trade.entryOrder.margin).replace(/[^0-9.]/g, '');
            margin = parseFloat(m) || 0;
        }
        if (!margin && trade.exitOrder && trade.exitOrder.margin) {
            const m = String(trade.exitOrder.margin).replace(/[^0-9.]/g, '');
            margin = parseFloat(m) || 0;
        }

        const symbol = trade.contract || trade.symbol || 'ES1!';

        return `
            <tr data-trade-id="${trade.id || ''}" class="trade-row">
                <td>${dateStr}</td>
                <td>${symbol}</td>
                <td>${side}</td>
                <td>${qty}</td>
                <td>${this.formatCurrency(entryPrice)}</td>
                <td>${this.formatCurrency(exitPrice)}</td>
                <td class="${profitClass}">${this.formatCurrency(pnl)}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td>${margin > 0 ? this.formatCurrency(margin) : '-'}</td>
                <td class="hide-mobile">${trade.notes || '-'}</td>
                <td>${duration}</td>
            </tr>
        `;
    }

    /**
     * Handle search input
     */
    handleSearch() {
        this.updateTradesTable();
    }

    /**
     * Handle filter change
     */
    handleFilter() {
        this.updateTradesTable();
    }

    /**
     * Show trade modal
     */
    showTradeModal(trade) {
        const html = this.createTradeModalContent(trade);
        this.modalBody.innerHTML = html;
        this.tradeModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close trade modal
     */
    closeTradeModal() {
        this.tradeModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    /**
     * Create trade modal content
     */
    createTradeModalContent(trade) {
        return `
            <div class="trade-details">
                <div class="detail-section">
                    <h4>Trade Summary</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Contract:</label>
                            <span>${trade.contract}</span>
                        </div>
                        <div class="detail-item">
                            <label>Quantity:</label>
                            <span>${trade.quantity}</span>
                        </div>
                        <div class="detail-item">
                            <label>Entry Price:</label>
                            <span>${trade.entry}</span>
                        </div>
                        <div class="detail-item">
                            <label>Exit Price:</label>
                            <span>${trade.exit}</span>
                        </div>
                        <div class="detail-item">
                            <label>Duration:</label>
                            <span>${trade.duration}</span>
                        </div>
                        <div class="detail-item">
                            <label>Status:</label>
                            <span class="status-badge ${trade.status.toLowerCase()}">${trade.status}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Profit & Loss</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Point Difference:</label>
                            <span>${trade.pointDifference.toFixed(4)} points</span>
                        </div>
                        <div class="detail-item">
                            <label>Gross Profit:</label>
                            <span>${this.formatCurrency(trade.grossProfit)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Commission:</label>
                            <span>${this.formatCurrency(trade.totalCommission)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Net Profit:</label>
                            <span class="${trade.netProfit >= 0 ? 'profit-positive' : 'profit-negative'}">
                                ${this.formatCurrency(trade.netProfit)}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Timing</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Entry Time:</label>
                            <span>${this.formatDateTime(trade.entryTime)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Exit Time:</label>
                            <span>${this.formatDateTime(trade.exitTime)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Notes</h4>
                    <textarea class="trade-notes" placeholder="Add your trade notes here...">${trade.notes || ''}</textarea>
                </div>
            </div>
        `;
    }

    /**
     * Export trades to CSV
     */
    exportTrades() {
        if (this.currentTrades.length === 0) {
            this.showToast('No trades to export', 'warning');
            return;
        }

        try {
            const calculator = new window.TradeCalculator();
            const csvContent = calculator.exportToCSV(this.currentTrades);

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');

            a.href = url;
            a.download = `tradle-trades-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            window.URL.revokeObjectURL(url);

            this.showToast('Trades exported successfully!', 'success');
        } catch (error) {
            this.showToast('Export failed: ' + error.message, 'error');
        }
    }

    /**
     * Toggle dark mode
     */
    toggleDarkMode() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        const icon = this.darkModeToggle.querySelector('i');
        const text = this.darkModeToggle.querySelector('span');

        if (newTheme === 'dark') {
            icon.className = 'fas fa-sun';
            text.textContent = 'Light Mode';
        } else {
            icon.className = 'fas fa-moon';
            text.textContent = 'Dark Mode';
        }
    }

    /**
     * Initialize dark mode from localStorage
     */
    initializeDarkMode() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);

            const icon = this.darkModeToggle.querySelector('i');
            const text = this.darkModeToggle.querySelector('span');

            if (savedTheme === 'dark') {
                icon.className = 'fas fa-sun';
                text.textContent = 'Light Mode';
            }
        }
    }

    /**
     * Show loading overlay
     */
    showLoading() {
        this.loadingOverlay.style.display = 'flex';
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    /**
     * Show upload status
     */
    showUploadStatus(message) {
        this.uploadStatus.style.display = 'block';
        this.uploadStatus.querySelector('.status-text').textContent = message;
    }

    /**
     * Hide upload status
     */
    hideUploadStatus() {
        this.uploadStatus.style.display = 'none';
    }

    /**
     * Show dashboard section
     */
    showDashboard() {
        this.uploadSection.style.display = 'none';
        this.dashboardSection.style.display = 'block';
    }

    /**
     * Hide dashboard section
     */
    hideDashboard() {
        this.uploadSection.style.display = 'block';
        this.dashboardSection.style.display = 'none';
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        toast.innerHTML = `
            <i class="fas ${this.getToastIcon(type)}"></i>
            <span>${message}</span>
        `;

        this.toastContainer.appendChild(toast);

        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    /**
     * Get toast icon based on type
     */
    getToastIcon(type) {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-exclamation-circle';
            case 'warning': return 'fa-exclamation-triangle';
            default: return 'fa-info-circle';
        }
    }

    /**
     * Format currency
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    }

    /**
     * Format date
     */
    formatDate(date) {
        if (!date) return '';
        return new Intl.DateTimeFormat('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: '2-digit'
        }).format(date);
    }

    /**
     * Format datetime
     */
    formatDateTime(date) {
        if (!date) return '';
        return new Intl.DateTimeFormat('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(date);
    }

    /**
     * Switch between tabs
     */
    switchTab(tabName) {
        // Remove active class from all tabs
        this.navTabs.forEach(tab => tab.classList.remove('active'));

        // Hide all sections
        document.querySelectorAll('.tab-content').forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active');
        });

        // Activate selected tab
        const activeTab = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // Show selected section
        const sectionMap = {
            'dashboard': this.dashboardSection,
            'import': this.importSection,
            'export': this.exportSection
        };

        const activeSection = sectionMap[tabName];
        if (activeSection) {
            activeSection.style.display = 'block';
            activeSection.classList.add('active');
        }

        // Handle special tab behaviors
        if (tabName === 'dashboard') {
            // Just show the dashboard with whatever data is already in memory.
            // Do NOT reload from localStorage here — during an upload flow the new data
            // hasn't been persisted yet, so reloading would overwrite it with stale data.
            console.log('🔄 Switching to dashboard tab');
            console.log(`  🎯 UI currentTrades: ${this.currentTrades.length}`);
        } else if (tabName === 'import') {
            // Always show format selection first when import tab is opened
            setTimeout(() => {
                this.showFormatSelection();
            }, 50); // Small delay to ensure DOM is ready
        }
    }

    // showDashboard() and hideDashboard() are defined earlier in the class (simple visibility toggle).
    // DO NOT redefine them here — calling switchTab('dashboard') from showDashboard()
    // causes infinite recursion: updateDashboard → showDashboard → switchTab → updateDashboard → ...

    /**
     * Show TradingView upload interface (Step 2)
     */
    showTradingViewUpload() {
        console.log('🎯 Switching to TradingView upload interface');

        if (this.formatSelectionContainer && this.tradingviewUploadContainer) {
            this.formatSelectionContainer.style.display = 'none';
            this.tradingviewUploadContainer.style.display = 'block';

            // Add animation class for smooth transition
            this.tradingviewUploadContainer.style.opacity = '0';
            this.tradingviewUploadContainer.style.transform = 'translateX(20px)';

            requestAnimationFrame(() => {
                this.tradingviewUploadContainer.style.transition = 'all 0.3s ease-out';
                this.tradingviewUploadContainer.style.opacity = '1';
                this.tradingviewUploadContainer.style.transform = 'translateX(0)';
            });

            // Show success message
            this.showToast('TradingView format selected. Upload your CSV file below.', 'success');
        }
    }

    /**
     * Show format selection interface (Step 1)
     */
    showFormatSelection() {
        console.log('🔙 Returning to format selection');

        if (this.formatSelectionContainer && this.tradingviewUploadContainer) {
            this.tradingviewUploadContainer.style.display = 'none';
            this.formatSelectionContainer.style.display = 'block';

            // Add animation class for smooth transition
            this.formatSelectionContainer.style.opacity = '0';
            this.formatSelectionContainer.style.transform = 'translateX(-20px)';

            requestAnimationFrame(() => {
                this.formatSelectionContainer.style.transition = 'all 0.3s ease-out';
                this.formatSelectionContainer.style.opacity = '1';
                this.formatSelectionContainer.style.transform = 'translateX(0)';
            });

            // Reset any upload status
            this.hideUploadStatus();

            // Clear file input
            if (this.csvFileInput) {
                this.csvFileInput.value = '';
            }
        }
    }
}

// Export for use in other modules
window.UIController = UIController;