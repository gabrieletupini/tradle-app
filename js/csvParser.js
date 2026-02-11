/**
 * CSV Parser for TradingView Data
 * Handles parsing and validation of TradingView paper trading CSV files
 */
class CSVParser {
    constructor() {
        this.supportedFormats = {
            tradingview: 'TradingView Paper Trading',
            custom: 'Custom Format'
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
            switch (format) {
                case 'tradingview':
                    console.log('📊 Calling parseTradingViewCSV...');
                    const result = this.parseTradingViewCSV(csvContent);
                    console.log('✅ parseTradingViewCSV completed successfully');
                    return result;
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

                // Only process ES1! orders with valid data (including CME_MINI:ES1!)
                if (values.length >= headers.length && values[0] &&
                    (values[0].includes('ES1!') || values[0].includes('CME_MINI:ES1!'))) {

                    const order = this.createOrderObject(values, headers);

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

        console.log(`✅ Line processing completed. Valid: ${validOrderCount}, Errors: ${errorCount}`);

        // Reverse to get chronological order (TradingView exports newest first)
        console.log('🔄 Reversing order array for chronological sorting...');
        const chronologicalOrders = orders.reverse();
        console.log('✅ Chronological sorting completed');

        const result = {
            orders: chronologicalOrders,
            stats: {
                totalLines: lines.length - 1,
                validOrders: validOrderCount,
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
            margin: getValue(['margin'], 14) || ''
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
     * Parse datetime from TradingView format (e.g., "2/10/26 15:56")
     */
    parseDateTime(dateTimeStr) {
        if (!dateTimeStr || dateTimeStr.trim() === '') return null;

        try {
            // Handle format like "2/10/26 15:56" or "2/10/26 15:56:03" (with optional seconds)
            const match = dateTimeStr.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+)(?::(\d+))?/);
            if (match) {
                const [, month, day, year, hour, minute, second] = match;

                // Convert 2-digit year to 4-digit (assuming 2000s)
                const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);

                return new Date(
                    fullYear,
                    parseInt(month) - 1, // Month is 0-indexed
                    parseInt(day),
                    parseInt(hour),
                    parseInt(minute),
                    parseInt(second || 0)
                );
            }

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