/**
 * CSV Parser for Trading Data
 * Handles parsing of TradingView and Interactive Brokers CSV files
 */
class CSVParser {
    constructor() {
        this.supportedFormats = {
            tradingview: 'TradingView Paper Trading',
            ibkr: 'Interactive Brokers',
            custom: 'Custom Format'
        };

        // IBKR multiplier → TradingView symbol mapping
        this.IBKR_MULTIPLIER_MAP = {
            50: 'ES1!',    // E-mini S&P 500
            5: 'MES1!',   // Micro E-mini S&P 500 (or MYM, M2K — disambiguated by price range)
            20: 'NQ1!',    // E-mini Nasdaq-100
            2: 'MNQ1!',   // Micro E-mini Nasdaq-100
            1000: 'CL1!',    // Crude Oil (or ZB, ZN — disambiguated by price)
            100: 'GC1!',    // Gold (or MCL — disambiguated by price)
            10: 'MGC1!',   // Micro Gold (or NG)
            5000: 'SI1!',    // Silver
            10000: 'NG1!',    // Natural Gas
            125000: '6E1!',    // Euro FX
            12500000: '6J1!',  // Japanese Yen
        };
    }

    /**
     * Parse CSV content based on format
     */
    async parseCSV(csvContent, format = 'tradingview') {
        console.log('🔍 parseCSV: Starting CSV parsing...');
        console.log(`📄 Format: ${format}`);
        console.log(`📏 Content length: ${csvContent.length}`);

        try {
            // Auto-detect format if set to 'auto'
            if (format === 'auto') {
                format = this.detectFormat(csvContent);
                console.log(`🔍 Auto-detected format: ${format}`);
            }

            switch (format) {
                case 'tradingview':
                    console.log('📊 Calling parseTradingViewCSV...');
                    const result = this.parseTradingViewCSV(csvContent);
                    console.log('✅ parseTradingViewCSV completed successfully');
                    return result;
                case 'ibkr':
                    console.log('🏦 Calling parseIBKRCSV...');
                    const ibkrResult = this.parseIBKRCSV(csvContent);
                    console.log('✅ parseIBKRCSV completed successfully');
                    return ibkrResult;
                case 'custom':
                    throw new Error('Custom format not yet supported');
                default:
                    throw new Error(`Unsupported format: ${format}`);
            }
        } catch (error) {
            console.error('❌ CSV parsing error:', error);
            throw error;
        }
    }

    /**
     * Parse TradingView CSV format
     */
    parseTradingViewCSV(csvContent) {
        console.log('📊 parseTradingViewCSV: Starting TradingView CSV parsing...');

        const lines = csvContent.split('\n');
        console.log(`📄 Total lines: ${lines.length}`);

        if (lines.length === 0) {
            throw new Error('CSV file is empty');
        }

        const headers = lines[0].split(',');
        console.log('📋 Headers:', headers);

        // Validate headers
        console.log('🔍 Validating TradingView headers...');
        if (!this.validateTradingViewHeaders(headers)) {
            console.error('❌ Header validation failed');
            throw new Error('Invalid TradingView CSV format. Please ensure you have the correct headers.');
        }
        console.log('✅ Headers validated successfully');

        const orders = [];
        let validOrderCount = 0;
        let errorCount = 0;
        let skippedCancelledCount = 0;
        let processedLines = 0;

        console.log(`🔄 Processing ${lines.length - 1} data lines...`);

        for (let i = 1; i < lines.length; i++) {
            processedLines++;

            // Progress logging every 100 lines for large files
            if (processedLines % 100 === 0) {
                console.log(`📊 Progress: ${processedLines}/${lines.length - 1} lines processed`);
            }

            const line = lines[i].trim();

            // Skip empty lines
            if (!line || line.split(',').every(cell => !cell.trim())) {
                continue;
            }

            try {
                const values = this.parseCSVLine(line);

                // Process any symbol with valid data
                if (values.length >= headers.length && values[0] && values[0].trim()) {

                    const order = this.createOrderObject(values, headers);

                    // Silently skip cancelled orders — they are expected in TradingView exports
                    if (order.status && order.status.toLowerCase() === 'cancelled') {
                        skippedCancelledCount++;
                        continue;
                    }

                    if (this.validateOrder(order)) {
                        orders.push(order);
                        validOrderCount++;

                        if (validOrderCount <= 5) {
                            console.log(`📝 Valid order ${validOrderCount}:`, {
                                symbol: order.symbol,
                                side: order.side,
                                fillPrice: order.fillPrice,
                                qty: order.qty,
                                status: order.status
                            });
                        }
                    } else {
                        errorCount++;
                        if (errorCount <= 3) {
                            console.warn(`⚠️ Invalid order on line ${i + 1}:`, order);
                        }
                    }
                }
            } catch (error) {
                errorCount++;
                if (errorCount <= 3) {
                    console.warn(`❌ Error parsing line ${i + 1}:`, error.message);
                }
            }
        }

        console.log(`✅ Line processing completed. Valid: ${validOrderCount}, Cancelled (skipped): ${skippedCancelledCount}, Errors: ${errorCount}`);

        // Reverse to get chronological order (TradingView exports newest first)
        console.log('🔄 Reversing order array for chronological sorting...');
        const chronologicalOrders = orders.reverse();
        console.log('✅ Chronological sorting completed');

        const result = {
            orders: chronologicalOrders,
            stats: {
                totalLines: lines.length - 1,
                validOrders: validOrderCount,
                skippedCancelled: skippedCancelledCount,
                errors: errorCount,
                format: 'tradingview'
            }
        };

        console.log('✅ parseTradingViewCSV completed successfully:', result.stats);
        return result;
    }

    /**
     * Validate TradingView CSV headers
     */
    validateTradingViewHeaders(headers) {
        const requiredHeaders = [
            'Symbol', 'Side', 'Type', 'Qty', 'Fill Price',
            'Status', 'Placing Time', 'Order ID'
        ];

        const headerString = headers.join(',').toLowerCase();
        console.log('🔍 CSV Headers:', headers);
        console.log('🔍 Header validation string:', headerString);

        return requiredHeaders.every(required => {
            const cleanRequired = required.toLowerCase().replace(/\s+/g, '');
            const requiredLower = required.toLowerCase();

            // Check for exact match, partial match, or with/without spaces
            const hasMatch = headerString.includes(cleanRequired) ||
                headerString.includes(requiredLower) ||
                headerString.includes(required.toLowerCase().replace(' ', ''));

            console.log(`🔍 Checking "${required}": ${hasMatch}`);
            return hasMatch;
        });
    }

    /**
     * Parse CSV line handling quoted fields and special characters
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }

    /**
     * Create order object from CSV values
     */
    createOrderObject(values, headers) {
        // Create a dynamic mapping based on actual headers
        const headerMap = {};
        headers.forEach((header, index) => {
            headerMap[header.toLowerCase().trim()] = index;
        });

        // Helper function to get value by header name with fallback to index
        const getValue = (headerNames, fallbackIndex = null) => {
            for (const headerName of headerNames) {
                const index = headerMap[headerName.toLowerCase()];
                if (index !== undefined && values[index] !== undefined) {
                    return values[index];
                }
            }
            // Fallback to hardcoded index if header not found
            return fallbackIndex !== null ? values[fallbackIndex] : '';
        };

        return {
            symbol: getValue(['symbol'], 0) || '',
            side: getValue(['side'], 1) || '',
            type: getValue(['type'], 2) || '',
            qty: this.parseInteger(getValue(['qty', 'quantity'], 3)),
            limitPrice: this.parsePrice(getValue(['limit price', 'limitprice'], 4)),
            stopPrice: this.parsePrice(getValue(['stop price', 'stopprice'], 5)),
            fillPrice: this.parsePrice(getValue(['fill price', 'fillprice'], 6)),
            status: getValue(['status'], 7) || '',
            commission: getValue(['commission'], 8) || '',
            placingTime: this.parseDateTime(getValue(['placing time', 'placingtime', 'time'], 9)),
            closingTime: this.parseDateTime(getValue(['closing time', 'closingtime'], 10)),
            orderId: getValue(['order id', 'orderid'], 11) || '',
            levelId: getValue(['level id', 'levelid'], 12) || '',
            leverage: getValue(['leverage'], 13) || '',
            margin: getValue(['margin'], 14) || '',
            broker: 'TradingView'
        };
    }

    /**
     * Parse price from string, handling special characters
     */
    parsePrice(priceStr) {
        if (!priceStr || priceStr.trim() === '' || priceStr.includes('�') || priceStr === '–') {
            return null;
        }

        // Remove any non-numeric characters except dots and hyphens
        const cleaned = priceStr.replace(/[^\d.-]/g, '');
        const price = parseFloat(cleaned);

        return isNaN(price) ? null : price;
    }

    /**
     * Parse integer from string
     */
    parseInteger(str) {
        if (!str || str.trim() === '') return 0;
        const num = parseInt(str.replace(/[^\d-]/g, ''));
        return isNaN(num) ? 0 : num;
    }

    /**
     * Parse datetime from TradingView format
     * Supports: "2/10/26 15:56", "2/10/26 15:56:03", "2026-02-12 16:33:22"
     */
    parseDateTime(dateTimeStr) {
        if (!dateTimeStr || dateTimeStr.trim() === '') return null;

        try {
            // Format 1: "M/D/YY HH:MM" or "M/D/YY HH:MM:SS"
            const slashMatch = dateTimeStr.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+)(?::(\d+))?/);
            if (slashMatch) {
                const [, month, day, year, hour, minute, second] = slashMatch;
                const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
                return new Date(
                    fullYear,
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hour),
                    parseInt(minute),
                    parseInt(second || 0)
                );
            }

            // Format 2: "YYYY-MM-DD HH:MM:SS" (ISO-like)
            const isoMatch = dateTimeStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d+):(\d+)(?::(\d+))?/);
            if (isoMatch) {
                const [, year, month, day, hour, minute, second] = isoMatch;
                return new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hour),
                    parseInt(minute),
                    parseInt(second || 0)
                );
            }

            // Format 3: Try native Date.parse as last resort
            const parsed = new Date(dateTimeStr);
            if (!isNaN(parsed.getTime())) return parsed;

            return null;
        } catch (error) {
            console.warn('Date parsing error:', error);
            return null;
        }
    }

    /**
     * Validate order object
     */
    validateOrder(order) {
        return (
            order.symbol &&
            order.side &&
            order.fillPrice !== null &&
            order.qty > 0 &&
            order.placingTime !== null &&
            order.status === 'Filled'
        );
    }

    /**
     * Get file info and validate before parsing
     */
    validateFile(file) {
        const errors = [];
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (!file) {
            errors.push('No file selected');
        } else {
            if (!file.name.toLowerCase().endsWith('.csv')) {
                errors.push('File must be a CSV file');
            }

            if (file.size > maxSize) {
                errors.push('File size must be less than 10MB');
            }

            if (file.size === 0) {
                errors.push('File is empty');
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            size: file ? file.size : 0,
            name: file ? file.name : ''
        };
    }

    /**
     * Read file content as text
     */
    readFileContent(file) {
        console.log('📖 readFileContent: Starting FileReader operation...');
        console.log(`📏 File details: ${file.name}, ${file.size} bytes, type: ${file.type}`);

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            let resolved = false;

            // Add timeout protection
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    console.error('❌ FileReader timeout after 25 seconds');
                    reject(new Error('FileReader timeout - file reading took too long'));
                }
            }, 25000); // 25 second timeout

            reader.onload = (e) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    console.log('✅ FileReader onload event fired');
                    console.log(`📝 Content length: ${e.target.result.length} characters`);
                    resolve(e.target.result);
                }
            };

            reader.onerror = (e) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    console.error('❌ FileReader onerror event fired:', e);
                    reject(new Error('Failed to read file - FileReader error'));
                }
            };

            reader.onabort = (e) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    console.error('❌ FileReader onabort event fired:', e);
                    reject(new Error('File reading was aborted'));
                }
            };

            reader.onloadstart = (e) => {
                console.log('🔄 FileReader onloadstart event fired - reading started');
            };

            reader.onprogress = (e) => {
                if (e.lengthComputable) {
                    const progress = Math.round((e.loaded / e.total) * 100);
                    console.log(`📊 FileReader progress: ${progress}% (${e.loaded}/${e.total} bytes)`);
                }
            };

            reader.onloadend = (e) => {
                console.log('🏁 FileReader onloadend event fired - reading finished');
            };

            console.log('🚀 Starting FileReader.readAsText()...');
            try {
                reader.readAsText(file);
                console.log('📤 FileReader.readAsText() call completed');
            } catch (syncError) {
                resolved = true;
                clearTimeout(timeout);
                console.error('❌ Synchronous error in readAsText:', syncError);
                reject(new Error(`FileReader synchronous error: ${syncError.message}`));
            }
        });
    }

    /**
     * Auto-detect CSV format from headers
     */
    detectFormat(csvContent) {
        const firstLine = csvContent.split('\n')[0].toLowerCase();
        if (firstLine.includes('net amount') && !firstLine.includes('status')) {
            return 'ibkr';
        }
        if (firstLine.includes('placing time') || firstLine.includes('order id') || firstLine.includes('status')) {
            return 'tradingview';
        }
        return 'tradingview'; // default fallback
    }

    /**
     * Validate Interactive Brokers CSV headers
     */
    validateIBKRHeaders(headers) {
        const required = ['symbol', 'side', 'qty', 'fill price', 'time'];
        const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
        return required.every(req => normalizedHeaders.some(h => h.includes(req)));
    }

    /**
     * Resolve IBKR symbol from contract name, price, and multiplier
     * IBKR uses "Mar20 '26" style names; we detect the product from the multiplier
     */
    resolveIBKRSymbol(ibkrSymbol, fillPrice, qty, netAmount) {
        if (!fillPrice || !qty || !netAmount) return ibkrSymbol;

        const multiplier = Math.round(Math.abs(netAmount) / (fillPrice * qty));
        console.log(`🔍 IBKR symbol resolve: ${ibkrSymbol} | price=${fillPrice} qty=${qty} net=${netAmount} → multiplier=${multiplier}`);

        // Disambiguate multiplier=5 by price range
        if (multiplier === 5) {
            if (fillPrice > 3000) return 'MES1!';        // Micro S&P (price ~5000-7000)
            if (fillPrice > 100) return 'MYM1!';         // Micro Dow (price ~300-450)
            return 'M2K1!';                              // Micro Russell (price ~20-30)
        }

        // Disambiguate multiplier=1000 by price range
        if (multiplier === 1000) {
            if (fillPrice > 500) return 'ZB1!';           // 30-Year T-Bond
            if (fillPrice > 100) return 'ZN1!';           // 10-Year T-Note
            return 'CL1!';                                // Crude Oil (price ~50-100)
        }

        // Disambiguate multiplier=100 by price
        if (multiplier === 100) {
            if (fillPrice > 500) return 'GC1!';           // Gold (price ~1800-2500)
            return 'MCL1!';                               // Micro Crude Oil
        }

        return this.IBKR_MULTIPLIER_MAP[multiplier] || ibkrSymbol;
    }

    /**
     * Parse Interactive Brokers CSV format
     * Headers: Symbol, Side, Qty, Fill Price, Time, Net Amount, Commission
     */
    parseIBKRCSV(csvContent) {
        console.log('🏦 parseIBKRCSV: Starting Interactive Brokers CSV parsing...');

        const lines = csvContent.split('\n');
        console.log(`📄 Total lines: ${lines.length}`);

        if (lines.length === 0) {
            throw new Error('CSV file is empty');
        }

        const headers = lines[0].split(',');
        console.log('📋 Headers:', headers);

        if (!this.validateIBKRHeaders(headers)) {
            console.error('❌ IBKR header validation failed');
            throw new Error('Invalid Interactive Brokers CSV format. Expected columns: Symbol, Side, Qty, Fill Price, Time, Net Amount, Commission');
        }

        // Build header index map
        const headerMap = {};
        headers.forEach((header, index) => {
            headerMap[header.toLowerCase().trim()] = index;
        });

        const getValue = (name) => {
            const idx = headerMap[name.toLowerCase()];
            return idx !== undefined ? (lines[0] ? undefined : undefined) : undefined; // placeholder
        };

        const orders = [];
        let validOrderCount = 0;
        let errorCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.split(',').every(cell => !cell.trim())) continue;

            try {
                const values = this.parseCSVLine(line);
                if (values.length < 5) continue;

                const getVal = (name) => {
                    const idx = headerMap[name.toLowerCase()];
                    return idx !== undefined && values[idx] !== undefined ? values[idx].trim() : '';
                };

                const ibkrSymbol = getVal('symbol');
                const side = getVal('side');
                const qty = this.parseInteger(getVal('qty'));
                const fillPrice = this.parsePrice(getVal('fill price'));
                const time = this.parseDateTime(getVal('time'));
                const netAmount = parseFloat((getVal('net amount') || '0').replace(/[^\d.-]/g, '')) || 0;
                const commission = parseFloat((getVal('commission') || '0').replace(/[^\d.-]/g, '')) || 0;

                if (!ibkrSymbol || !side || !fillPrice || !qty || !time) {
                    errorCount++;
                    if (errorCount <= 3) console.warn(`⚠️ Invalid IBKR order on line ${i + 1}`);
                    continue;
                }

                // Resolve to TradingView-style symbol using multiplier detection
                const resolvedSymbol = this.resolveIBKRSymbol(ibkrSymbol, fillPrice, qty, netAmount);

                orders.push({
                    symbol: resolvedSymbol,
                    side: side,
                    type: 'Market',  // IBKR trade history = already filled, treat as Market
                    qty: qty,
                    limitPrice: null,
                    stopPrice: null,
                    fillPrice: fillPrice,
                    status: 'Filled', // All IBKR trade history entries are filled
                    commission: commission,
                    placingTime: time,
                    closingTime: time,
                    orderId: `ibkr_${time.getTime()}_${i}`,
                    levelId: '',
                    leverage: '',
                    margin: netAmount ? `${netAmount} USD` : '',
                    broker: 'IBKR'
                });
                validOrderCount++;

                if (validOrderCount <= 5) {
                    console.log(`📝 IBKR order ${validOrderCount}: ${side} ${qty}x ${resolvedSymbol} @ ${fillPrice} (${ibkrSymbol})`);
                }
            } catch (error) {
                errorCount++;
                if (errorCount <= 3) console.warn(`❌ Error parsing IBKR line ${i + 1}:`, error.message);
            }
        }

        console.log(`✅ IBKR parsing completed. Valid: ${validOrderCount}, Errors: ${errorCount}`);

        // Sort chronologically (IBKR may export newest first)
        const chronologicalOrders = orders.sort((a, b) => a.placingTime - b.placingTime);

        return {
            orders: chronologicalOrders,
            stats: {
                totalLines: lines.length - 1,
                validOrders: validOrderCount,
                errors: errorCount,
                format: 'ibkr'
            }
        };
    }

    /**
     * Get sample CSV data for demonstration
     */
    getSampleCSVData() {
        return `Symbol,Side,Type,Qty,Limit Price,Stop Price,Fill Price,Status,Commission,Placing Time,Closing Time,Order ID,Level ID,Leverage,Margin
CME_MINI:ES1!,Sell,Market,5,,,6997.25,Filled,,2/10/26 15:56,2/10/26 15:56,2744987017,,20:01,"87,465.63 USD"
CME_MINI:ES1!,Buy,Limit,5,6994.5,,6994,Filled,,2/10/26 15:54,2/10/26 15:55,2744962758,,20:01,"87,431.25 USD"
CME_MINI:ES1!,Sell,Market,5,,,6994.25,Filled,,2/10/26 15:32,2/10/26 15:32,2744711867,,20:01,"87,428.13 USD"
CME_MINI:ES1!,Buy,Limit,5,6992.5,,6992.5,Filled,,2/10/26 15:31,2/10/26 15:31,2744692729,,20:01,"87,406.25 USD"
CME_MINI:ES1!,Sell,Market,5,,,6979.5,Filled,,2/10/26 14:32,2/10/26 14:32,2744427309,,20:01,"87,243.75 USD"
CME_MINI:ES1!,Buy,Limit,5,6979.75,,6979.75,Filled,,2/10/26 14:25,2/10/26 14:25,2744396661,,20:01,"87,246.88 USD"
CME_MINI:ES1!,Sell,Market,5,,,6996,Filled,,2/10/26 10:26,2/10/26 10:26,2743783687,,20:01,"87,450.00 USD"
CME_MINI:ES1!,Buy,Limit,5,6996.75,,6996.25,Filled,,2/10/26 10:23,2/10/26 10:23,2743777657,,20:01,"87,459.38 USD"
CME_MINI:ES1!,Sell,Market,5,,,6987.5,Filled,,2/10/26 0:07,2/10/26 0:07,2742532081,,20:01,"87,343.75 USD"
CME_MINI:ES1!,Buy,Stop,5,,6987.75,6987.75,Filled,,2/10/26 0:07,2/10/26 0:07,2742531948,,20:01,"87,346.88 USD"
CME_MINI:ES1!,Sell,Market,5,,,6976.75,Filled,,2/9/26 16:40,2/9/26 16:40,2741094918,,20:01,"87,209.38 USD"
CME_MINI:ES1!,Buy,Limit,5,6971,,6970.75,Filled,,2/9/26 16:31,2/9/26 16:31,2741028262,,20:01,"87,137.50 USD"`;
    }

    /**
     * Generate parsing summary
     */
    generateParsingSummary(parseResult) {
        const { orders, stats } = parseResult;

        return {
            success: true,
            totalOrders: orders.length,
            dateRange: this.getDateRange(orders),
            symbols: this.getUniqueSymbols(orders),
            sides: this.getSideDistribution(orders),
            summary: `Successfully parsed ${stats.validOrders} orders from ${stats.totalLines} lines. ${stats.errors > 0 ? `${stats.errors} errors encountered.` : ''}`,
            stats
        };
    }

    /**
     * Get date range from orders
     */
    getDateRange(orders) {
        if (orders.length === 0) return null;

        const dates = orders
            .filter(o => o.placingTime)
            .map(o => o.placingTime)
            .sort((a, b) => a - b);

        return dates.length > 0 ? {
            start: dates[0],
            end: dates[dates.length - 1]
        } : null;
    }

    /**
     * Get unique symbols from orders
     */
    getUniqueSymbols(orders) {
        return [...new Set(orders.map(o => o.symbol).filter(Boolean))];
    }

    /**
     * Get side distribution
     */
    getSideDistribution(orders) {
        const distribution = { Buy: 0, Sell: 0 };
        orders.forEach(order => {
            if (order.side in distribution) {
                distribution[order.side]++;
            }
        });
        return distribution;
    }
}

// Export for use in other modules
window.CSVParser = CSVParser;