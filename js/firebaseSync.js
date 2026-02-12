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
            return { success: true };
        } catch (e) {
            console.warn('⚠️ FirebaseSync: Journal push failed:', e.message);
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
            return { success: true, merged };
        } catch (e) {
            console.log(`📥 FirebaseSync: Journal pull failed: ${e.message}`);
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
            return { success: true };
        } catch (e) {
            console.warn('⚠️ FirebaseSync: Screenshot push failed:', e.message);
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
            return { success: true, merged };
        } catch (e) {
            console.log(`📥 FirebaseSync: Screenshot pull failed: ${e.message}`);
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
            return { success: true, message: `${format} data synced — all devices will update on next load` };
        } catch (e) {
            console.warn('⚠️ FirebaseSync: CSV push failed:', e.message);
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
}

// Export
window.FirebaseSync = FirebaseSync;
