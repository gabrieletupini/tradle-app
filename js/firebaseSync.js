/**
 * FirebaseSync — Real-time cross-device sync via Firebase Realtime Database.
 *
 * Stores journal notes, screenshots, and uploaded CSV data.
 * No authentication needed (test mode). Instant sync, no rebuild delays.
 *
 * Firebase REST API — no SDK required.
 */
class FirebaseSync {
    static DB_URL = 'https://tradle-db-default-rtdb.europe-west1.firebasedatabase.app';

    // Debounce timers
    static _journalTimer = null;
    static _csvTimer = null;

    // ===== Journal Sync =====

    /**
     * Schedule a debounced journal push (2s after last change).
     */
    static scheduleJournalSync() {
        clearTimeout(this._journalTimer);
        this._journalTimer = setTimeout(() => this.pushJournal(), 2000);
    }

    /**
     * Push all journal data (notes + daily goal) to Firebase.
     * Screenshots are pushed separately due to size.
     */
    static async pushJournal() {
        try {
            const journals = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('tradle_journal_')) {
                    try { journals[key] = JSON.parse(localStorage.getItem(key)); }
                    catch (e) { /* skip */ }
                }
            }

            const payload = {
                journals: journals,
                dailyGoal: localStorage.getItem('tradle_daily_goal') || null,
                updatedAt: new Date().toISOString()
            };

            const resp = await fetch(`${this.DB_URL}/journalData.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            console.log(`✅ FirebaseSync: Journal pushed (${Object.keys(journals).length} days)`);
            this._setSyncStatus('synced');
            return { success: true };
        } catch (e) {
            console.warn('⚠️ FirebaseSync: Journal push failed:', e.message);
            this._setSyncStatus('error', e.message);
            return { success: false, message: e.message };
        }
    }

    /**
     * Pull journal data from Firebase and merge into localStorage.
     */
    static async pullJournal() {
        try {
            const resp = await fetch(`${this.DB_URL}/journalData.json`);
            if (!resp.ok) return { success: false };

            const data = await resp.json();
            if (!data || !data.journals) return { success: false, message: 'No remote journal' };

            let merged = 0;
            for (const [key, remoteJournal] of Object.entries(data.journals)) {
                const localRaw = localStorage.getItem(key);
                if (!localRaw) {
                    localStorage.setItem(key, JSON.stringify(remoteJournal));
                    merged++;
                } else {
                    try {
                        const local = JSON.parse(localRaw);
                        let changed = false;

                        if (!local.dayNotes && remoteJournal.dayNotes) {
                            local.dayNotes = remoteJournal.dayNotes;
                            changed = true;
                        }
                        if (remoteJournal.trades) {
                            if (!local.trades) local.trades = {};
                            for (const [tid, data] of Object.entries(remoteJournal.trades)) {
                                if (!local.trades[tid] || !local.trades[tid].note) {
                                    local.trades[tid] = data;
                                    changed = true;
                                }
                            }
                        }
                        if (changed) {
                            localStorage.setItem(key, JSON.stringify(local));
                            merged++;
                        }
                    } catch (e) { /* skip */ }
                }
            }

            if (data.dailyGoal && !localStorage.getItem('tradle_daily_goal')) {
                localStorage.setItem('tradle_daily_goal', data.dailyGoal);
            }

            console.log(`📥 FirebaseSync: Merged ${merged} journal days from remote`);
            this._setSyncStatus('synced');
            return { success: true, merged };
        } catch (e) {
            console.log(`📥 FirebaseSync: Journal pull failed: ${e.message}`);
            this._setSyncStatus('error', e.message);
            return { success: false, message: e.message };
        }
    }

    // ===== Screenshot Sync =====

    /**
     * Push a single screenshot to Firebase.
     */
    static async pushScreenshot(screenshot) {
        try {
            const id = screenshot.id || `img_${Date.now()}`;
            const resp = await fetch(`${this.DB_URL}/screenshots/${id}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(screenshot)
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            console.log(`✅ FirebaseSync: Screenshot ${id} pushed`);
            this._setSyncStatus('synced');
            return { success: true };
        } catch (e) {
            console.warn('⚠️ FirebaseSync: Screenshot push failed:', e.message);
            this._setSyncStatus('error', e.message);
            return { success: false };
        }
    }

    /**
     * Remove a screenshot from Firebase.
     */
    static async removeScreenshot(imgId) {
        try {
            await fetch(`${this.DB_URL}/screenshots/${imgId}.json`, { method: 'DELETE' });
            console.log(`✅ FirebaseSync: Screenshot ${imgId} removed`);
        } catch (e) {
            console.warn('⚠️ FirebaseSync: Screenshot remove failed:', e.message);
        }
    }

    /**
     * Pull all screenshots from Firebase and merge into IndexedDB.
     */
    static async pullScreenshots() {
        try {
            const resp = await fetch(`${this.DB_URL}/screenshots.json`);
            if (!resp.ok) return { success: false };

            const data = await resp.json();
            if (!data) return { success: false, message: 'No remote screenshots' };

            await ImageStore.init();
            const db = await ImageStore._getDB();
            let merged = 0;

            for (const [id, screenshot] of Object.entries(data)) {
                if (!screenshot || !screenshot.dataUrl) continue;

                const exists = await new Promise(resolve => {
                    const tx = db.transaction('screenshots', 'readonly');
                    const req = tx.objectStore('screenshots').get(id);
                    req.onsuccess = () => resolve(!!req.result);
                    req.onerror = () => resolve(false);
                });

                if (!exists) {
                    await new Promise((resolve, reject) => {
                        const tx = db.transaction('screenshots', 'readwrite');
                        tx.objectStore('screenshots').put(screenshot);
                        tx.oncomplete = () => resolve();
                        tx.onerror = () => reject(tx.error);
                    });
                    merged++;
                }
            }

            console.log(`📥 FirebaseSync: Merged ${merged} screenshots from remote`);
            this._setSyncStatus('synced');
            return { success: true, merged };
        } catch (e) {
            console.log(`📥 FirebaseSync: Screenshot pull failed: ${e.message}`);
            this._setSyncStatus('error', e.message);
            return { success: false, message: e.message };
        }
    }

    /**
     * Push ALL existing screenshots from IndexedDB to Firebase (one-time migration).
     */
    static async pushAllScreenshots() {
        try {
            await ImageStore.init();
            const db = await ImageStore._getDB();
            const allScreenshots = await new Promise((resolve, reject) => {
                const tx = db.transaction('screenshots', 'readonly');
                const req = tx.objectStore('screenshots').getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });

            if (allScreenshots.length === 0) {
                console.log('📤 FirebaseSync: No local screenshots to push');
                return { success: true, pushed: 0 };
            }

            let pushed = 0;
            for (const screenshot of allScreenshots) {
                if (!screenshot.id || !screenshot.dataUrl) continue;
                const resp = await fetch(`${this.DB_URL}/screenshots/${screenshot.id}.json`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(screenshot)
                });
                if (resp.ok) pushed++;
            }

            console.log(`📤 FirebaseSync: Pushed ${pushed}/${allScreenshots.length} screenshots to Firebase`);
            return { success: true, pushed };
        } catch (e) {
            console.warn('⚠️ FirebaseSync: Bulk screenshot push failed:', e.message);
            return { success: false, message: e.message };
        }
    }

    // ===== CSV Sync =====

    /**
     * Push uploaded CSV to Firebase (so other devices can pull it).
     */
    static async pushCSV(csvContent, format) {
        try {
            const key = format === 'ibkr' ? 'ibkr' : 'tradingview';
            const resp = await fetch(`${this.DB_URL}/csvData/${key}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: csvContent,
                    format: format,
                    updatedAt: new Date().toISOString()
                })
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            console.log(`✅ FirebaseSync: ${format} CSV pushed`);
            this._setSyncStatus('synced');
            return { success: true, message: `${format} data synced — all devices will update on next load` };
        } catch (e) {
            console.warn('⚠️ FirebaseSync: CSV push failed:', e.message);
            this._setSyncStatus('error', e.message);
            return { success: false, message: e.message };
        }
    }

    /**
     * Pull CSV data from Firebase. Returns { tradingview, ibkr } with content strings.
     */
    static async pullCSVs() {
        try {
            const resp = await fetch(`${this.DB_URL}/csvData.json`);
            if (!resp.ok) return null;

            const data = await resp.json();
            if (!data) return null;

            console.log(`📥 FirebaseSync: CSV data found (TV: ${!!data.tradingview}, IBKR: ${!!data.ibkr})`);
            return data;
        } catch (e) {
            console.log(`📥 FirebaseSync: CSV pull failed: ${e.message}`);
            return null;
        }
    }

    // ===== Trade Database Sync =====

    /**
     * Push the entire trade database to Firebase.
     * Deduplicates local trades before pushing.
     */
    static async pushTradeDatabase() {
        try {
            const raw = localStorage.getItem('tradle_trade_database');
            if (!raw) return { success: false, message: 'No trade database' };

            const db = JSON.parse(raw);
            let trades = db.trades || [];

            // Deduplicate by fingerprint before pushing
            const seen = new Set();
            const fingerprint = (t) => {
                const sym = (t.contract || t.symbol || '').replace(/[^A-Za-z0-9]/g, '');
                const eTime = t.entryTime ? new Date(t.entryTime).getTime() : 0;
                const xTime = t.exitTime ? new Date(t.exitTime).getTime() : 0;
                const ePrice = Math.round((t.entryPrice || 0) * 100);
                const xPrice = Math.round((t.exitPrice || 0) * 100);
                return `${sym}_${eTime}_${xTime}_${ePrice}_${xPrice}`;
            };
            const before = trades.length;
            trades = trades.filter(t => {
                const fp = fingerprint(t);
                if (seen.has(fp)) return false;
                seen.add(fp);
                return true;
            });
            if (trades.length < before) {
                console.log(`🧹 FirebaseSync: Removed ${before - trades.length} duplicate trades before push`);
                // Also clean local storage
                db.trades = trades;
                localStorage.setItem('tradle_trade_database', JSON.stringify(db));
            }

            const payload = {
                trades: trades,
                lastUpdated: new Date().toISOString()
            };

            const resp = await fetch(`${this.DB_URL}/tradeDatabase.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

            console.log(`✅ FirebaseSync: Trade database pushed (${trades.length} trades)`);
            this._setSyncStatus('synced');
            return { success: true };
        } catch (e) {
            console.warn('⚠️ FirebaseSync: Trade DB push failed:', e.message);
            this._setSyncStatus('error', e.message);
            return { success: false, message: e.message };
        }
    }

    /**
     * Pull the trade database from Firebase and merge into localStorage.
     * Deduplicates by order IDs AND by trade fingerprint (symbol + times + prices).
     */
    static async pullTradeDatabase() {
        try {
            const resp = await fetch(`${this.DB_URL}/tradeDatabase.json`);
            if (!resp.ok) return { success: false };

            const remote = await resp.json();
            if (!remote || !remote.trades || remote.trades.length === 0) {
                return { success: true, merged: 0, message: 'No remote trades' };
            }

            // Load local DB
            const localRaw = localStorage.getItem('tradle_trade_database');
            const localDB = localRaw ? JSON.parse(localRaw) : { trades: [], orderIds: [] };
            const localTrades = localDB.trades || [];

            // Build set of local trade IDs for fast lookup
            const localIds = new Set(localTrades.map(t => t.id).filter(Boolean));

            // Build set of all local order IDs
            const localOrderIds = new Set();
            localTrades.forEach(t => {
                if (t.entryOrderId) localOrderIds.add(t.entryOrderId);
                if (t.exitOrderId) localOrderIds.add(t.exitOrderId);
                if (t.allOrderIds) t.allOrderIds.forEach(oid => { if (oid) localOrderIds.add(oid); });
            });

            // Build fingerprint set for content-based dedup
            // (catches duplicates where IDs differ but the trade is the same)
            const fingerprint = (t) => {
                const sym = (t.contract || t.symbol || '').replace(/[^A-Za-z0-9]/g, '');
                const eTime = t.entryTime ? new Date(t.entryTime).getTime() : 0;
                const xTime = t.exitTime ? new Date(t.exitTime).getTime() : 0;
                const ePrice = Math.round((t.entryPrice || 0) * 100);
                const xPrice = Math.round((t.exitPrice || 0) * 100);
                return `${sym}_${eTime}_${xTime}_${ePrice}_${xPrice}`;
            };
            const localFingerprints = new Set(localTrades.map(fingerprint));

            let merged = 0;
            for (const trade of remote.trades) {
                // Skip if trade ID already in local
                if (trade.id && localIds.has(trade.id)) continue;

                // Skip if any order ID already tracked
                const tradeOrderIds = [trade.entryOrderId, trade.exitOrderId, ...(trade.allOrderIds || [])].filter(Boolean);
                if (tradeOrderIds.length > 0 && tradeOrderIds.some(oid => localOrderIds.has(oid))) continue;

                // Skip if fingerprint matches an existing local trade
                const fp = fingerprint(trade);
                if (localFingerprints.has(fp)) continue;

                localTrades.push(trade);
                localIds.add(trade.id);
                localFingerprints.add(fp);
                tradeOrderIds.forEach(oid => localOrderIds.add(oid));
                merged++;
            }

            if (merged > 0) {
                localDB.trades = localTrades;
                localDB.lastUpdated = new Date().toISOString();
                localStorage.setItem('tradle_trade_database', JSON.stringify(localDB));
            }

            console.log(`📥 FirebaseSync: Merged ${merged} trades from remote (local now has ${localTrades.length})`);
            this._setSyncStatus('synced');
            return { success: true, merged };
        } catch (e) {
            console.log(`📥 FirebaseSync: Trade DB pull failed: ${e.message}`);
            this._setSyncStatus('error', e.message);
            return { success: false, message: e.message };
        }
    }

    // ===== Sync Status Indicator =====

    static _syncStatus = 'connecting'; // 'connecting' | 'synced' | 'error' | 'offline'
    static _syncError = null;

    static _setSyncStatus(status, error) {
        this._syncStatus = status;
        this._syncError = error || null;
        this._renderSyncIndicator();
    }

    static _renderSyncIndicator() {
        const dot = document.getElementById('firebaseSyncDot');
        const tooltip = document.getElementById('firebaseSyncTooltip');
        if (!dot) return;

        const configs = {
            connecting: { color: '#f59e0b', pulse: true, label: 'Connecting to cloud...' },
            synced: { color: '#10b981', pulse: false, label: 'Synced — data saved to cloud' },
            error: { color: '#ef4444', pulse: true, label: this._syncError ? `Sync error: ${this._syncError}` : 'Sync error — data only saved locally' },
            offline: { color: '#94a3b8', pulse: false, label: 'Offline — data saved locally' }
        };

        const cfg = configs[this._syncStatus] || configs.offline;
        dot.style.background = cfg.color;
        dot.classList.toggle('sync-pulse', cfg.pulse);
        if (tooltip) tooltip.textContent = cfg.label;
    }
}

// Export
window.FirebaseSync = FirebaseSync;
