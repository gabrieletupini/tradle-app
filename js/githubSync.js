/**
 * GitHubSync — Push uploaded CSVs to the GitHub repo so all devices stay in sync.
 *
 * Uses the GitHub Contents API to update files in data/sample-data/.
 * The user's PAT is stored in localStorage (set once via Settings).
 *
 * Flow:
 *   1. User uploads CSV on any device
 *   2. After local processing, GitHubSync.pushCSV() updates the repo
 *   3. GitHub Pages rebuilds (takes ~30-60s)
 *   4. All other devices pick up the new data on next page load
 */
class GitHubSync {
    static STORAGE_KEY = 'tradle_github_pat';
    static REPO_OWNER = 'gabrieletupini';
    static REPO_NAME = 'tradle-app';
    static API_BASE = 'https://api.github.com';

    /**
     * Get the stored GitHub PAT.
     */
    static getPAT() {
        return localStorage.getItem(this.STORAGE_KEY) || '';
    }

    /**
     * Save the GitHub PAT to localStorage.
     */
    static setPAT(pat) {
        if (pat && pat.trim()) {
            localStorage.setItem(this.STORAGE_KEY, pat.trim());
        } else {
            localStorage.removeItem(this.STORAGE_KEY);
        }
    }

    /**
     * Check if a PAT is configured.
     */
    static isConfigured() {
        return !!this.getPAT();
    }

    /**
     * Push a CSV file to the repo's data/sample-data/ folder.
     * @param {string} csvContent - The raw CSV text
     * @param {string} format - 'tradingview' or 'ibkr'
     * @returns {Promise<{success: boolean, message: string}>}
     */
    static async pushCSV(csvContent, format) {
        const pat = this.getPAT();
        if (!pat) {
            return { success: false, message: 'GitHub PAT not configured — set it in Settings to enable cross-device sync' };
        }

        const filename = format === 'ibkr'
            ? 'data/sample-data/sample-ibkr-data.csv'
            : 'data/sample-data/sample-tradingview-data.csv';

        try {
            console.log(`🔄 GitHubSync: Pushing ${format} CSV to ${filename}...`);

            // Step 1: Get current file SHA (required for update)
            const fileInfo = await this._getFile(filename, pat);
            const sha = fileInfo ? fileInfo.sha : null;

            // Step 2: Update (or create) the file
            const content = btoa(unescape(encodeURIComponent(csvContent))); // UTF-8 safe base64
            const body = {
                message: `sync: update ${format} data from web upload`,
                content: content,
                branch: 'main'
            };
            if (sha) body.sha = sha;

            const response = await fetch(
                `${this.API_BASE}/repos/${this.REPO_OWNER}/${this.REPO_NAME}/contents/${filename}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${pat}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/vnd.github.v3+json'
                    },
                    body: JSON.stringify(body)
                }
            );

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || `HTTP ${response.status}`);
            }

            console.log(`✅ GitHubSync: ${format} CSV pushed to GitHub successfully`);
            return { success: true, message: `${format === 'ibkr' ? 'IBKR' : 'TradingView'} data synced to GitHub — all devices will update shortly` };

        } catch (error) {
            console.error('❌ GitHubSync: Push failed:', error);
            return { success: false, message: `Sync failed: ${error.message}` };
        }
    }

    /**
     * Get file info (including SHA) from the repo.
     */
    static async _getFile(path, pat) {
        try {
            const response = await fetch(
                `${this.API_BASE}/repos/${this.REPO_OWNER}/${this.REPO_NAME}/contents/${path}?ref=main`,
                {
                    headers: {
                        'Authorization': `token ${pat}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            if (response.ok) return response.json();
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Validate the PAT by making a test API call.
     * @returns {Promise<{valid: boolean, message: string}>}
     */
    static async validatePAT(pat) {
        try {
            const response = await fetch(
                `${this.API_BASE}/repos/${this.REPO_OWNER}/${this.REPO_NAME}`,
                {
                    headers: {
                        'Authorization': `token ${pat}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            if (response.ok) {
                const data = await response.json();
                if (data.permissions && data.permissions.push) {
                    return { valid: true, message: `Connected to ${data.full_name} ✓` };
                }
                return { valid: false, message: 'Token lacks push permission — needs "Contents: Read and write"' };
            }
            return { valid: false, message: `Invalid token (HTTP ${response.status})` };
        } catch (error) {
            return { valid: false, message: `Connection error: ${error.message}` };
        }
    }

    // ===== Journal + Screenshot Sync =====

    static JOURNAL_PATH = 'data/journal-data.json';

    /**
     * Debounce timer for journal sync (avoid pushing on every keystroke).
     */
    static _journalSyncTimer = null;

    /**
     * Schedule a debounced journal sync (3s after last change).
     * Call this after every journal save or screenshot change.
     */
    static scheduleJournalSync() {
        if (!this.isConfigured()) return;
        clearTimeout(this._journalSyncTimer);
        this._journalSyncTimer = setTimeout(() => {
            this.pushJournalData().then(result => {
                if (result.success) {
                    console.log('✅ Journal synced to GitHub');
                } else {
                    console.warn('⚠️ Journal sync failed:', result.message);
                }
            });
        }, 3000);
    }

    /**
     * Collect ALL journal data (notes from localStorage + screenshots from IndexedDB)
     * and push as a single JSON file to the repo.
     */
    static async pushJournalData() {
        const pat = this.getPAT();
        if (!pat) return { success: false, message: 'PAT not configured' };

        try {
            console.log('🔄 GitHubSync: Collecting journal data...');

            // 1. Gather all journal notes from localStorage
            const journals = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('tradle_journal_')) {
                    try {
                        journals[key] = JSON.parse(localStorage.getItem(key));
                    } catch (e) { /* skip corrupt entries */ }
                }
            }

            // 2. Gather all screenshots from IndexedDB
            const screenshots = [];
            try {
                await ImageStore.init();
                const db = await ImageStore._getDB();
                const tx = db.transaction('screenshots', 'readonly');
                const store = tx.objectStore('screenshots');
                const allRecords = await new Promise((resolve, reject) => {
                    const req = store.getAll();
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => reject(req.error);
                });
                screenshots.push(...allRecords);
            } catch (e) {
                console.warn('⚠️ Could not read screenshots from IndexedDB:', e);
            }

            // 3. Build the journal data object
            const journalData = {
                version: '1.0',
                updatedAt: new Date().toISOString(),
                journals: journals,
                screenshots: screenshots,
                dailyGoal: localStorage.getItem('tradle_daily_goal') || null
            };

            // 4. Push to GitHub
            const content = btoa(unescape(encodeURIComponent(JSON.stringify(journalData))));
            const fileInfo = await this._getFile(this.JOURNAL_PATH, pat);

            const body = {
                message: 'sync: update journal data',
                content: content,
                branch: 'main'
            };
            if (fileInfo && fileInfo.sha) body.sha = fileInfo.sha;

            const response = await fetch(
                `${this.API_BASE}/repos/${this.REPO_OWNER}/${this.REPO_NAME}/contents/${this.JOURNAL_PATH}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${pat}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/vnd.github.v3+json'
                    },
                    body: JSON.stringify(body)
                }
            );

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || `HTTP ${response.status}`);
            }

            console.log(`✅ GitHubSync: Journal pushed (${Object.keys(journals).length} days, ${screenshots.length} screenshots)`);
            return { success: true, message: 'Journal synced' };

        } catch (error) {
            console.error('❌ GitHubSync: Journal push failed:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Pull journal data from GitHub and merge into local storage.
     * Called on startup to load journal data from other devices.
     */
    static async pullJournalData() {
        try {
            console.log('📥 GitHubSync: Fetching journal data from repo...');

            // Fetch without PAT (public repo, works via GitHub Pages)
            const response = await fetch(`${this.JOURNAL_PATH}?t=${Date.now()}`);
            if (!response.ok) {
                console.log('📥 No remote journal data found');
                return { success: false, message: 'No remote journal data' };
            }

            const journalData = await response.json();
            if (!journalData || !journalData.version) {
                console.log('📥 Invalid journal data format');
                return { success: false, message: 'Invalid format' };
            }

            console.log(`📥 Remote journal: ${Object.keys(journalData.journals || {}).length} days, ${(journalData.screenshots || []).length} screenshots`);

            let mergedNotes = 0;
            let mergedScreenshots = 0;

            // 1. Merge journal notes (remote wins for missing days, merge per-trade for existing)
            if (journalData.journals) {
                for (const [key, remoteJournal] of Object.entries(journalData.journals)) {
                    const localRaw = localStorage.getItem(key);
                    if (!localRaw) {
                        // Day doesn't exist locally — take remote entirely
                        localStorage.setItem(key, JSON.stringify(remoteJournal));
                        mergedNotes++;
                    } else {
                        // Merge: keep local notes if they exist, fill in from remote if missing
                        try {
                            const localJournal = JSON.parse(localRaw);
                            let changed = false;

                            // Merge dayNotes (keep whichever is non-empty, prefer local)
                            if (!localJournal.dayNotes && remoteJournal.dayNotes) {
                                localJournal.dayNotes = remoteJournal.dayNotes;
                                changed = true;
                            }

                            // Merge per-trade notes
                            if (remoteJournal.trades) {
                                if (!localJournal.trades) localJournal.trades = {};
                                for (const [tradeId, remoteTradeData] of Object.entries(remoteJournal.trades)) {
                                    if (!localJournal.trades[tradeId] || !localJournal.trades[tradeId].note) {
                                        localJournal.trades[tradeId] = remoteTradeData;
                                        changed = true;
                                    }
                                }
                            }

                            if (changed) {
                                localStorage.setItem(key, JSON.stringify(localJournal));
                                mergedNotes++;
                            }
                        } catch (e) { /* skip corrupt local */ }
                    }
                }
            }

            // 2. Merge screenshots into IndexedDB (skip if already exists by id)
            if (journalData.screenshots && journalData.screenshots.length > 0) {
                try {
                    await ImageStore.init();
                    const db = await ImageStore._getDB();

                    for (const screenshot of journalData.screenshots) {
                        // Check if this screenshot already exists
                        const existing = await new Promise((resolve) => {
                            const tx = db.transaction('screenshots', 'readonly');
                            const req = tx.objectStore('screenshots').get(screenshot.id);
                            req.onsuccess = () => resolve(req.result);
                            req.onerror = () => resolve(null);
                        });

                        if (!existing) {
                            await new Promise((resolve, reject) => {
                                const tx = db.transaction('screenshots', 'readwrite');
                                tx.objectStore('screenshots').put(screenshot);
                                tx.oncomplete = () => resolve();
                                tx.onerror = () => reject(tx.error);
                            });
                            mergedScreenshots++;
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ Could not merge remote screenshots:', e);
                }
            }

            // 3. Merge daily goal
            if (journalData.dailyGoal && !localStorage.getItem('tradle_daily_goal')) {
                localStorage.setItem('tradle_daily_goal', journalData.dailyGoal);
            }

            console.log(`📥 GitHubSync: Merged ${mergedNotes} journal days, ${mergedScreenshots} screenshots from remote`);
            return { success: true, mergedNotes, mergedScreenshots };

        } catch (error) {
            console.log(`📥 Could not fetch remote journal: ${error.message}`);
            return { success: false, message: error.message };
        }
    }
}

// Export
window.GitHubSync = GitHubSync;
