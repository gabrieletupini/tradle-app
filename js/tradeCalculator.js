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
            // CFD instruments (B2Prime / other CFD brokers)
            'SPXUSD': { multiplier: 1, commission: 0, name: 'S&P 500 CFD' },
            'NAS100': { multiplier: 1, commission: 0, name: 'Nasdaq 100 CFD' },
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
            .sort((a, b) => a.placingTime - b.placingTime);

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
            contract: entryOrder.symbol,
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

        // Profit calculation (works for any futures contract)
        // LONG:  (Exit - Entry) × Qty × Multiplier  (buy low, sell high)
        // SHORT: (Entry - Exit) × Qty × Multiplier  (sell high, buy low)
        const pointDifference = side === 'SHORT'
            ? entryPrice - exitPrice
            : exitPrice - entryPrice;
        const grossProfit = pointDifference * quantity * specs.multiplier;

        // Commission: if the CSV supplied per-order values, use those (scaled for partial fills).
        // A blank CSV commission means paper trading with $0 commission.
        // Fall back to the spec-based rate only when there is no CSV commission field at all.
        let totalCommission;
        const entryOrder = trade.entryOrder;
        const exitOrder  = trade.exitOrder;
        if (entryOrder && entryOrder.commission !== undefined && entryOrder.commission !== null) {
            const origEntryQty = entryOrder.originalQty || quantity;
            const origExitQty  = exitOrder  ? (exitOrder.originalQty  || quantity) : quantity;
            const entryComm = (parseFloat(entryOrder.commission) || 0) * (quantity / origEntryQty);
            const exitComm  = (parseFloat(exitOrder?.commission)  || 0) * (quantity / origExitQty);
            totalCommission = entryComm + exitComm;
        } else {
            totalCommission = specs.commission * quantity * 2;
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