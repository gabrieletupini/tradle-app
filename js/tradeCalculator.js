/**
 * Trade Calculator for Futures Contracts
 * Supports multiple symbols dynamically via CONTRACT_SPECS registry
 */
class TradeCalculator {
    constructor() {
        // Contract specifications registry — add new symbols here
        this.CONTRACT_SPECS = {
            'ES1!': { multiplier: 50, commission: 2.50, name: 'E-mini S&P 500' },
            'MES1!': { multiplier: 5, commission: 0.62, name: 'Micro E-mini S&P 500' },
            'NQ1!': { multiplier: 20, commission: 2.50, name: 'E-mini Nasdaq-100' },
            'MNQ1!': { multiplier: 2, commission: 0.62, name: 'Micro E-mini Nasdaq-100' },
            'YM1!': { multiplier: 5, commission: 2.50, name: 'E-mini Dow' },
            'MYM1!': { multiplier: 0.50, commission: 0.62, name: 'Micro E-mini Dow' },
            'RTY1!': { multiplier: 50, commission: 2.50, name: 'E-mini Russell 2000' },
            'M2K1!': { multiplier: 5, commission: 0.62, name: 'Micro E-mini Russell 2000' },
            'CL1!': { multiplier: 1000, commission: 2.50, name: 'Crude Oil' },
            'MCL1!': { multiplier: 100, commission: 0.62, name: 'Micro Crude Oil' },
            'GC1!': { multiplier: 100, commission: 2.50, name: 'Gold' },
            'MGC1!': { multiplier: 10, commission: 0.62, name: 'Micro Gold' },
            'SI1!': { multiplier: 5000, commission: 2.50, name: 'Silver' },
            'NG1!': { multiplier: 10000, commission: 2.50, name: 'Natural Gas' },
            'ZB1!': { multiplier: 1000, commission: 2.50, name: '30-Year T-Bond' },
            'ZN1!': { multiplier: 1000, commission: 2.50, name: '10-Year T-Note' },
            '6E1!': { multiplier: 125000, commission: 2.50, name: 'Euro FX' },
            '6J1!': { multiplier: 12500000, commission: 2.50, name: 'Japanese Yen' },
            // ── Additional CME futures ────────────────────────────────────────
            'ZC1!': { multiplier: 50,    commission: 2.50, name: 'Corn' },
            'ZW1!': { multiplier: 50,    commission: 2.50, name: 'Wheat' },
            'ZS1!': { multiplier: 50,    commission: 2.50, name: 'Soybeans' },
            'HG1!': { multiplier: 25000, commission: 2.50, name: 'Copper' },
            'PL1!': { multiplier: 50,    commission: 2.50, name: 'Platinum' },
            '6B1!': { multiplier: 62500, commission: 2.50, name: 'British Pound' },
            '6C1!': { multiplier: 100000,commission: 2.50, name: 'Canadian Dollar' },
            '6A1!': { multiplier: 100000,commission: 2.50, name: 'Australian Dollar' },
            '6S1!': { multiplier: 125000,commission: 2.50, name: 'Swiss Franc' },
            '6N1!': { multiplier: 100000,commission: 2.50, name: 'New Zealand Dollar' },
            '6M1!': { multiplier: 500000,commission: 2.50, name: 'Mexican Peso' },

            // ── CFD indices (B2Prime / OANDA / Pepperstone / etc.) ───────────
            'SPXUSD': { multiplier: 1, commission: 0, name: 'S&P 500 CFD' },
            'NAS100': { multiplier: 1, commission: 0, name: 'Nasdaq 100 CFD' },
            'US30':   { multiplier: 1, commission: 0, name: 'Dow Jones CFD' },
            'US2000': { multiplier: 1, commission: 0, name: 'Russell 2000 CFD' },
            'GER40':  { multiplier: 1, commission: 0, name: 'DAX 40 CFD' },
            'UK100':  { multiplier: 1, commission: 0, name: 'FTSE 100 CFD' },
            'FRA40':  { multiplier: 1, commission: 0, name: 'CAC 40 CFD' },
            'JPN225': { multiplier: 1, commission: 0, name: 'Nikkei 225 CFD' },
            'HK50':   { multiplier: 1, commission: 0, name: 'Hang Seng CFD' },
            'AUS200': { multiplier: 1, commission: 0, name: 'ASX 200 CFD' },

            // ── CFD commodities ───────────────────────────────────────────────
            'XAUUSD': { multiplier: 1, commission: 0, name: 'Gold CFD' },
            'XAGUSD': { multiplier: 1, commission: 0, name: 'Silver CFD' },
            'XPTUSD': { multiplier: 1, commission: 0, name: 'Platinum CFD' },
            'USOIL':  { multiplier: 1, commission: 0, name: 'US Crude Oil CFD' },
            'UKOIL':  { multiplier: 1, commission: 0, name: 'Brent Oil CFD' },
            'NATGAS': { multiplier: 1, commission: 0, name: 'Natural Gas CFD' },

            // ── CFD forex majors ──────────────────────────────────────────────
            'EURUSD': { multiplier: 1, commission: 0, name: 'EUR/USD' },
            'GBPUSD': { multiplier: 1, commission: 0, name: 'GBP/USD' },
            'USDJPY': { multiplier: 1, commission: 0, name: 'USD/JPY' },
            'USDCHF': { multiplier: 1, commission: 0, name: 'USD/CHF' },
            'AUDUSD': { multiplier: 1, commission: 0, name: 'AUD/USD' },
            'NZDUSD': { multiplier: 1, commission: 0, name: 'NZD/USD' },
            'USDCAD': { multiplier: 1, commission: 0, name: 'USD/CAD' },
            // Reversed-quote variants (as B2Prime sometimes labels them)
            'USDEUR': { multiplier: 1, commission: 0, name: 'USD/EUR' },
            'USDGBP': { multiplier: 1, commission: 0, name: 'USD/GBP' },
            'JPYUSD': { multiplier: 1, commission: 0, name: 'JPY/USD' },

            // ── CFD forex crosses ─────────────────────────────────────────────
            'EURGBP': { multiplier: 1, commission: 0, name: 'EUR/GBP' },
            'EURJPY': { multiplier: 1, commission: 0, name: 'EUR/JPY' },
            'EURCAD': { multiplier: 1, commission: 0, name: 'EUR/CAD' },
            'EURCHF': { multiplier: 1, commission: 0, name: 'EUR/CHF' },
            'EURAUD': { multiplier: 1, commission: 0, name: 'EUR/AUD' },
            'EURNZD': { multiplier: 1, commission: 0, name: 'EUR/NZD' },
            'GBPJPY': { multiplier: 1, commission: 0, name: 'GBP/JPY' },
            'GBPCAD': { multiplier: 1, commission: 0, name: 'GBP/CAD' },
            'GBPCHF': { multiplier: 1, commission: 0, name: 'GBP/CHF' },
            'GBPAUD': { multiplier: 1, commission: 0, name: 'GBP/AUD' },
            'GBPNZD': { multiplier: 1, commission: 0, name: 'GBP/NZD' },
            'AUDJPY': { multiplier: 1, commission: 0, name: 'AUD/JPY' },
            'AUDCAD': { multiplier: 1, commission: 0, name: 'AUD/CAD' },
            'AUDCHF': { multiplier: 1, commission: 0, name: 'AUD/CHF' },
            'AUDNZD': { multiplier: 1, commission: 0, name: 'AUD/NZD' },
            'CADJPY': { multiplier: 1, commission: 0, name: 'CAD/JPY' },
            'CHFJPY': { multiplier: 1, commission: 0, name: 'CHF/JPY' },
            'NZDJPY': { multiplier: 1, commission: 0, name: 'NZD/JPY' },
            'NZDCAD': { multiplier: 1, commission: 0, name: 'NZD/CAD' },
            'NZDCHF': { multiplier: 1, commission: 0, name: 'NZD/CHF' },

            // ── CFD crypto (TV / broker CFDs) ─────────────────────────────────
            'BTCUSD': { multiplier: 1, commission: 0, name: 'Bitcoin CFD' },
            'ETHUSD': { multiplier: 1, commission: 0, name: 'Ethereum CFD' },
        };

        // Default specs for unknown symbols
        this.DEFAULT_SPECS = { multiplier: 1, commission: 0, name: 'Unknown' };
    }

    /**
     * Look up contract specs for a given symbol string.
     * Strips exchange prefixes like "CME_MINI:" before matching.
     */
    getContractSpecs(symbolRaw) {
        if (!symbolRaw) return this.DEFAULT_SPECS;
        const stripped = symbolRaw.replace(/^[A-Z0-9_]+:/, ''); // "CME_MINI:ES1!" → "ES1!", "B2PRIME:SPXUSD" → "SPXUSD"
        return this.CONTRACT_SPECS[stripped] || this.DEFAULT_SPECS;
    }

    /**
     * Process orders and calculate trades
     */
    processOrders(orders) {
        console.log('🧮 processOrders: Starting trade calculation...');
        console.log(`📊 Input: ${orders.length} orders`);

        try {
            // Match buy/sell pairs chronologically
            console.log('🔗 Step 1: Matching trades...');
            const trades = this.matchTrades(orders);
            console.log(`✅ Matched ${trades.length} trades`);

            // Calculate profit/loss for each trade
            console.log('💰 Step 2: Calculating trade profits...');
            const calculatedTrades = trades.map((trade, index) => {
                if (index < 5) {
                    console.log(`💹 Calculating trade ${index + 1}:`, {
                        entry: trade.entryPrice,
                        exit: trade.exitPrice,
                        qty: trade.quantity
                    });
                }
                return this.calculateTrade(trade);
            });
            console.log(`✅ Calculated ${calculatedTrades.length} trades`);

            // Generate summary statistics
            console.log('📈 Step 3: Generating summary statistics...');
            const summary = this.generateSummary(calculatedTrades);
            console.log('✅ Summary generated:', {
                totalTrades: summary.totalTrades,
                totalProfit: summary.totalProfit,
                winRate: summary.winRate
            });

            const result = {
                trades: calculatedTrades,
                summary,
                orders: orders.length
            };

            console.log('✅ processOrders completed successfully');
            return result;

        } catch (error) {
            console.error('❌ Trade processing error:', error);
            throw error;
        }
    }

    /**
     * Determine if an order type is an entry order (placed in advance)
     * Limit and Stop are entry types; Market, Stop Loss, Take Profit are exit types
     */
    isEntryOrderType(type) {
        const t = (type || '').toLowerCase().trim();
        if (t === 'stop loss' || t === 'take profit') return false;
        if (t === 'limit' || t === 'stop') return true;
        return false; // Market and anything else = exit
    }

    /**
     * Match orders into trades using FIFO position tracking.
     * Handles partial fills: a single large entry (e.g. Sell 5) is correctly matched
     * against multiple smaller exits (Buy 2 + Buy 2 + Buy 1) using a per-symbol position queue.
     */
    matchTrades(orders) {
        const trades = [];
        const validOrders = orders
            .filter(order => order.fillPrice && order.placingTime)
            // Primary: chronological. Secondary: price ascending (stable tiebreaker so
            // same-timestamp orders always sort identically across devices/JS engines).
            .sort((a, b) => (a.placingTime - b.placingTime) || (a.fillPrice - b.fillPrice));

        console.log(`Matching ${validOrders.length} valid orders chronologically (FIFO)`);

        // Position tracker per symbol: array of open lots { qty, price, order }
        const positions = {};

        for (const order of validOrders) {
            if (order.status !== 'Filled') continue;

            const sym = order.symbol;
            if (!positions[sym]) positions[sym] = [];
            const pos = positions[sym];

            if (pos.length === 0) {
                // No open position — start one
                pos.push({ qty: order.qty, price: order.fillPrice, order });
                continue;
            }

            const openSide = pos[0].order.side.toLowerCase();
            const isSameSide = openSide === order.side.toLowerCase();

            if (isSameSide) {
                // Scale into existing position
                pos.push({ qty: order.qty, price: order.fillPrice, order });
                continue;
            }

            // Opposite side — close open lots FIFO
            let remainingQty = order.qty;
            while (remainingQty > 0 && pos.length > 0) {
                const lot = pos[0];
                const closeQty = Math.min(remainingQty, lot.qty);

                // Copies that carry the partial qty and the original qty (for commission scaling)
                const entryOrderCopy = { ...lot.order, originalQty: lot.order.qty, qty: closeQty };
                const exitOrderCopy  = { ...order, originalQty: order.qty, qty: closeQty };

                const trade = this.createTradeObject(entryOrderCopy, exitOrderCopy);
                trades.push(trade);

                const label = (closeQty < lot.order.qty || closeQty < order.qty) ? ' (partial)' : '';
                console.log(`✅ Trade ${trades.length}${label}: ${lot.order.side} ${lot.price} → ${order.side} ${order.fillPrice} qty=${closeQty} [${trade.side}]`);

                lot.qty -= closeQty;
                remainingQty -= closeQty;
                if (lot.qty <= 0) pos.shift();
            }

            // Leftover quantity opens a new position in the opposite direction
            if (remainingQty > 0) {
                pos.push({ qty: remainingQty, price: order.fillPrice, order });
            }
        }

        // Log any positions left open (e.g. no closing order in this CSV)
        for (const [sym, pos] of Object.entries(positions)) {
            if (pos.length > 0) {
                const unclosed = pos.reduce((s, l) => s + l.qty, 0);
                console.log(`⚠️ Unclosed position: ${sym} ${unclosed} qty remaining`);
            }
        }

        console.log(`Matched ${trades.length} complete trades`);
        return trades;
    }

    /**
     * Check if two orders form a valid trade pair
     */
    isValidTradePair(order1, order2) {
        return (
            order1.side !== order2.side &&
            order1.qty === order2.qty &&
            order1.status === 'Filled' &&
            order2.status === 'Filled' &&
            order1.symbol === order2.symbol
        );
    }

    /**
     * Create trade object from buy/sell order pair
     */
    createTradeObject(order1, order2) {
        // Chronological: order1 is always the entry, order2 is the exit
        // (matchTrades sorts by time, so order1 came first)
        const entryOrder = order1;
        const exitOrder = order2;

        // LONG if entry is a BUY, SHORT if entry is a SELL
        const side = entryOrder.side.toLowerCase() === 'buy' ? 'LONG' : 'SHORT';

        // Parse margin value from order (e.g. "87,209.38 USD" -> 87209.38)
        const parseMargin = (m) => {
            if (!m) return 0;
            const cleaned = String(m).replace(/[^0-9.]/g, '');
            return parseFloat(cleaned) || 0;
        };

        return {
            id: `trade_${entryOrder.orderId}_${exitOrder.orderId}`,
            entryOrder: entryOrder,
            exitOrder: exitOrder,
            entryPrice: entryOrder.fillPrice,
            exitPrice: exitOrder.fillPrice,
            quantity: entryOrder.qty,
            entryTime: entryOrder.placingTime,
            exitTime: exitOrder.placingTime,
            contract: (entryOrder.symbol || '').replace(/^[A-Z0-9_]+:/, '') || entryOrder.symbol || 'Unknown',
            side: side,
            margin: parseMargin(entryOrder.margin || exitOrder.margin),
            leverage: entryOrder.leverage || exitOrder.leverage || '',
            broker: entryOrder.broker || exitOrder.broker || ''
        };
    }

    /**
     * Calculate profit/loss for a single trade
     */
    calculateTrade(trade) {
        const { entryPrice, exitPrice, quantity } = trade;
        const side = trade.side || 'LONG';

        // Look up contract specs from the trade's actual symbol
        const specs = this.getContractSpecs(trade.contract);

        // Profit calculation
        // LONG:  (Exit - Entry) × Qty × Multiplier  (buy low, sell high)
        // SHORT: (Entry - Exit) × Qty × Multiplier  (sell high, buy low)
        const pointDifference = side === 'SHORT'
            ? entryPrice - exitPrice
            : exitPrice - entryPrice;

        // Effective multiplier — for most instruments specs.multiplier is correct.
        // For non-USD-quoted forex (e.g. GBPJPY) the raw point×qty product is in
        // the quote currency, not USD.  Derive a conversion factor from the order's
        // margin and leverage so the result is always in USD.
        let effectiveMultiplier = specs.multiplier;
        if (trade.margin > 0 && trade.leverage) {
            const levMatch = String(trade.leverage).match(/(\d+)/);
            if (levMatch) {
                const levVal = parseFloat(levMatch[1]);
                const refQty = (trade.entryOrder && trade.entryOrder.originalQty) || quantity;
                if (levVal > 0 && refQty > 0 && entryPrice > 0) {
                    const derived = (trade.margin * levVal) / (refQty * entryPrice);
                    // Use derived value only when it differs significantly from spec
                    // (avoids fill-price vs margin-price rounding noise on limit/stop orders)
                    const specMult = specs.multiplier || 1;
                    if (Math.abs(derived - specMult) / specMult > 0.1) {
                        effectiveMultiplier = derived;
                    }
                }
            }
        }

        const grossProfit = pointDifference * quantity * effectiveMultiplier;

        // Commission: use CSV per-order values only when at least one order has a non-zero value.
        // Blank CSV commission (paper trading) falls back to spec-based rate.
        let totalCommission;
        const entryOrder = trade.entryOrder;
        const exitOrder  = trade.exitOrder;
        const entryCommNum = parseFloat(entryOrder?.commission) || 0;
        const exitCommNum  = parseFloat(exitOrder?.commission)  || 0;
        if (entryOrder && entryOrder.commission !== undefined && (entryCommNum > 0 || exitCommNum > 0)) {
            // Non-zero CSV commission — use per-order values scaled for partial fills
            const origEntryQty = entryOrder.originalQty || quantity;
            const origExitQty  = exitOrder ? (exitOrder.originalQty || quantity) : quantity;
            totalCommission = entryCommNum * (quantity / origEntryQty) + exitCommNum * (quantity / origExitQty);
        } else {
            // Blank commission in CSV → use spec-based round-trip rate (entry + exit legs)
            totalCommission = specs.commission * 2 * quantity;
        }
        const netProfit = grossProfit - totalCommission;

        // Determine win/loss status
        const isWin = netProfit > 0;
        const status = isWin ? 'WIN' : 'LOSE';

        // Format return value (round to nearest dollar)
        const returnValue = Math.round(netProfit);

        // Create Trinjo-compatible format
        const trinjoTrade = {
            // Original trade data
            ...trade,

            // Calculated values
            pointDifference,
            grossProfit,
            totalCommission,
            netProfit,
            returnValue,
            status,
            isWin,

            // Trinjo format fields
            date: this.formatDateTime(trade.exitTime),
            boughtDate: this.formatDateTime(trade.entryTime),
            soldDate: this.formatDateTime(trade.exitTime),
            side: trade.side || 'LONG',
            contract: trade.contract || trade.entryOrder?.symbol || 'Unknown',
            entry: entryPrice,
            exit: exitPrice,
            return: returnValue,
            commission: specs.commission,
            currency: 'USD',
            images: '-',
            notes: '',
            tags: '',

            // Additional metadata
            duration: this.calculateDuration(trade.entryTime, trade.exitTime),
            entryOrderId: trade.entryOrder.orderId,
            exitOrderId: trade.exitOrder.orderId,
            margin: trade.margin || 0,
            leverage: trade.leverage || '',
            broker: trade.broker || trade.entryOrder?.broker || ''
        };

        return trinjoTrade;
    }

    /**
     * Calculate duration between two dates
     */
    calculateDuration(startTime, endTime) {
        const durationMs = endTime - startTime;
        const minutes = Math.floor(durationMs / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else {
            return `${minutes}m`;
        }
    }

    /**
     * Format datetime for display
     */
    formatDateTime(date) {
        if (!date) return '';

        // Check if date is valid
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            console.warn('Invalid date passed to formatDateTime:', date);
            return '';
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    /**
     * Generate summary statistics
     */
    generateSummary(trades) {
        if (trades.length === 0) {
            return this.getEmptySummary();
        }

        const totalProfit = trades.reduce((sum, trade) => sum + trade.netProfit, 0);
        const winningTrades = trades.filter(trade => trade.isWin);
        const losingTrades = trades.filter(trade => !trade.isWin);

        const winCount = winningTrades.length;
        const lossCount = losingTrades.length;
        const winRate = trades.length > 0 ? (winCount / trades.length) * 100 : 0;

        const profits = trades.map(t => t.netProfit);
        const bestTrade = Math.max(...profits);
        const worstTrade = Math.min(...profits);
        const averageProfit = totalProfit / trades.length;

        const totalCommission = trades.reduce((sum, trade) => sum + trade.totalCommission, 0);
        const totalGrossProfit = trades.reduce((sum, trade) => sum + trade.grossProfit, 0);

        return {
            totalTrades: trades.length,
            totalProfit: totalProfit,
            totalGrossProfit: totalGrossProfit,
            totalCommission: totalCommission,
            winCount,
            lossCount,
            winRate,
            bestTrade,
            worstTrade,
            averageProfit,
            averageWin: winCount > 0 ? winningTrades.reduce((sum, t) => sum + t.netProfit, 0) / winCount : 0,
            averageLoss: lossCount > 0 ? losingTrades.reduce((sum, t) => sum + t.netProfit, 0) / lossCount : 0,
            profitFactor: this.calculateProfitFactor(winningTrades, losingTrades),
            sharpeRatio: this.calculateSharpeRatio(profits),
            maxDrawdown: this.calculateMaxDrawdown(trades),
            consecutiveWins: this.getMaxConsecutive(trades, true),
            consecutiveLosses: this.getMaxConsecutive(trades, false),
            dateRange: this.getDateRange(trades)
        };
    }

    /**
     * Get empty summary for no trades
     */
    getEmptySummary() {
        return {
            totalTrades: 0,
            totalProfit: 0,
            totalGrossProfit: 0,
            totalCommission: 0,
            winCount: 0,
            lossCount: 0,
            winRate: 0,
            bestTrade: 0,
            worstTrade: 0,
            averageProfit: 0,
            averageWin: 0,
            averageLoss: 0,
            profitFactor: 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            consecutiveWins: 0,
            consecutiveLosses: 0,
            dateRange: null
        };
    }

    /**
     * Calculate profit factor (gross profit / gross loss)
     */
    calculateProfitFactor(winningTrades, losingTrades) {
        const grossWin = winningTrades.reduce((sum, t) => sum + t.netProfit, 0);
        const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.netProfit, 0));

        return grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
    }

    /**
     * Calculate Sharpe ratio (simplified version)
     */
    calculateSharpeRatio(profits) {
        if (profits.length < 2) return 0;

        const mean = profits.reduce((sum, p) => sum + p, 0) / profits.length;
        const variance = profits.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / profits.length;
        const standardDeviation = Math.sqrt(variance);

        return standardDeviation > 0 ? mean / standardDeviation : 0;
    }

    /**
     * Calculate maximum drawdown
     */
    calculateMaxDrawdown(trades) {
        let runningTotal = 0;
        let peak = 0;
        let maxDrawdown = 0;

        for (const trade of trades) {
            runningTotal += trade.netProfit;

            if (runningTotal > peak) {
                peak = runningTotal;
            }

            const drawdown = peak - runningTotal;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }

        return maxDrawdown;
    }

    /**
     * Get maximum consecutive wins or losses
     */
    getMaxConsecutive(trades, isWin) {
        let maxConsecutive = 0;
        let currentConsecutive = 0;

        for (const trade of trades) {
            if (trade.isWin === isWin) {
                currentConsecutive++;
                maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
            } else {
                currentConsecutive = 0;
            }
        }

        return maxConsecutive;
    }

    /**
     * Get date range from trades
     */
    getDateRange(trades) {
        if (trades.length === 0) return null;

        const dates = trades.map(t => t.entryTime).filter(Boolean).sort((a, b) => a - b);

        return dates.length > 0 ? {
            start: dates[0],
            end: dates[dates.length - 1]
        } : null;
    }

    /**
     * Export trades to CSV format (Trinjo compatible)
     */
    exportToCSV(trades) {
        const headers = [
            'Date', 'Bought Date', 'Sold Date', 'Side', 'Status', 'Contract',
            'Quantity', 'Entry', 'Exit', 'Return', 'Commission', 'Currency',
            'Images', 'Notes', 'Tags'
        ];

        const csvLines = [headers.join(',')];

        trades.forEach(trade => {
            const row = [
                trade.date,
                trade.boughtDate,
                trade.soldDate,
                trade.side,
                trade.status,
                trade.contract,
                trade.quantity,
                trade.entry,
                trade.exit,
                trade.return,
                trade.commission,
                trade.currency,
                trade.images,
                trade.notes || '-',
                trade.tags || '-'
            ];
            csvLines.push(row.join(','));
        });

        return csvLines.join('\n');
    }

    /**
     * Get distribution data for pie chart
     */
    getDistributionChartData(trades) {
        const winCount = trades.filter(t => t.isWin).length;
        const lossCount = trades.length - winCount;

        return [
            { label: 'Wins', value: winCount, color: '#10b981' },
            { label: 'Losses', value: lossCount, color: '#ef4444' }
        ];
    }
}

// Export for use in other modules
window.TradeCalculator = TradeCalculator;