/**
 * ImageStore — IndexedDB-backed screenshot storage for Tradle Journal.
 *
 * localStorage caps at ~5 MB total.  IndexedDB has no practical limit
 * (browsers grant hundreds of MB – GBs based on available disk space).
 *
 * Schema:
 *   Database: tradle_images
 *   Object Store: screenshots
 *     key:   auto-generated id (string UUID)
 *     value: { id, dayKey, tradeId, dataUrl, createdAt }
 *
 * Usage:
 *   await ImageStore.init();
 *   const id = await ImageStore.save(dayKey, tradeId, dataUrl);
 *   const dataUrl = await ImageStore.get(id);
 *   const urls = await ImageStore.getForTrade(dayKey, tradeId);  // [{id, dataUrl}]
 *   await ImageStore.remove(id);
 *   await ImageStore.migrateFromLocalStorage();  // one-time migration
 */
class ImageStore {
    static DB_NAME = 'tradle_images';
    static DB_VERSION = 1;
    static STORE_NAME = 'screenshots';

    static _db = null;

    /**
     * Open (or create) the IndexedDB database.
     * Safe to call multiple times — returns cached handle.
     */
    static async init() {
        if (this._db) return this._db;

        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                    store.createIndex('dayKey', 'dayKey', { unique: false });
                    store.createIndex('dayKey_tradeId', ['dayKey', 'tradeId'], { unique: false });
                }
            };

            req.onsuccess = (e) => {
                this._db = e.target.result;
                console.log('📦 ImageStore: IndexedDB ready');
                resolve(this._db);
            };

            req.onerror = (e) => {
                console.error('📦 ImageStore: Failed to open IndexedDB', e.target.error);
                reject(e.target.error);
            };
        });
    }

    /**
     * Generate a unique ID for a screenshot.
     */
    static _generateId() {
        return `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }

    /**
     * Save a screenshot image to IndexedDB.
     * @param {string} dayKey - e.g. "2026-02-11"
     * @param {string} tradeId - order ID or "trade_0" etc.
     * @param {string} dataUrl - base64 data URL of the image
     * @returns {string} the generated image ID
     */
    static async save(dayKey, tradeId, dataUrl) {
        const db = await this.init();
        const id = this._generateId();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readwrite');
            tx.objectStore(this.STORE_NAME).put({
                id,
                dayKey,
                tradeId,
                dataUrl,
                createdAt: new Date().toISOString()
            });
            tx.oncomplete = () => resolve(id);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Get a single screenshot by ID.
     * @returns {{ id, dayKey, tradeId, dataUrl } | null}
     */
    static async get(id) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readonly');
            const req = tx.objectStore(this.STORE_NAME).get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Get all screenshots for a specific trade on a specific day.
     * @returns {Array<{ id, dataUrl }>}
     */
    static async getForTrade(dayKey, tradeId) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readonly');
            const index = tx.objectStore(this.STORE_NAME).index('dayKey_tradeId');
            const req = index.getAll([dayKey, tradeId]);
            req.onsuccess = () => {
                const results = (req.result || []).map(r => ({ id: r.id, dataUrl: r.dataUrl }));
                resolve(results);
            };
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Get all screenshots for a given day.
     * @returns {Array<{ id, tradeId, dataUrl }>}
     */
    static async getForDay(dayKey) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readonly');
            const index = tx.objectStore(this.STORE_NAME).index('dayKey');
            const req = index.getAll(dayKey);
            req.onsuccess = () => {
                const results = (req.result || []).map(r => ({ id: r.id, tradeId: r.tradeId, dataUrl: r.dataUrl }));
                resolve(results);
            };
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Remove a screenshot by ID.
     */
    static async remove(id) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readwrite');
            tx.objectStore(this.STORE_NAME).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Check if any screenshots exist for a given day (fast check for calendar indicator).
     */
    static async dayHasScreenshots(dayKey) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readonly');
            const index = tx.objectStore(this.STORE_NAME).index('dayKey');
            const req = index.openCursor(IDBKeyRange.only(dayKey));
            req.onsuccess = () => resolve(!!req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * One-time migration: move base64 screenshots from localStorage journal
     * entries into IndexedDB.  Rewrites the localStorage entry with image IDs
     * instead of raw data URLs.
     */
    static async migrateFromLocalStorage() {
        const migrationKey = 'tradle_images_migrated';
        if (localStorage.getItem(migrationKey)) return; // already done

        console.log('📦 ImageStore: Checking for localStorage screenshots to migrate...');
        let migrated = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith('tradle_journal_')) continue;

            try {
                const journal = JSON.parse(localStorage.getItem(key));
                if (!journal || !journal.trades) continue;

                const dayKey = key.replace('tradle_journal_', '');
                let changed = false;

                for (const tradeId of Object.keys(journal.trades)) {
                    const t = journal.trades[tradeId];
                    if (!t.screenshots || !t.screenshots.length) continue;

                    const newIds = [];
                    for (const item of t.screenshots) {
                        // Only migrate actual data URLs, skip already-migrated IDs
                        if (typeof item === 'string' && item.startsWith('data:')) {
                            const id = await this.save(dayKey, tradeId, item);
                            newIds.push(id);
                            migrated++;
                        } else {
                            newIds.push(item); // already an ID
                        }
                    }
                    t.screenshots = newIds;
                    changed = true;
                }

                if (changed) {
                    localStorage.setItem(key, JSON.stringify(journal));
                }
            } catch (e) {
                console.warn('📦 Migration error for key:', key, e);
            }
        }

        localStorage.setItem(migrationKey, Date.now().toString());
        if (migrated > 0) {
            console.log(`📦 ImageStore: Migrated ${migrated} screenshots from localStorage → IndexedDB`);
        } else {
            console.log('📦 ImageStore: No screenshots to migrate');
        }
    }

    /**
     * Get approximate storage usage info.
     */
    static async getStorageInfo() {
        if (navigator.storage && navigator.storage.estimate) {
            const est = await navigator.storage.estimate();
            return {
                used: est.usage || 0,
                quota: est.quota || 0,
                usedMB: ((est.usage || 0) / 1024 / 1024).toFixed(1),
                quotaMB: ((est.quota || 0) / 1024 / 1024).toFixed(0)
            };
        }
        return null;
    }

    /**
     * Get a Set of all dayKeys that have at least one screenshot stored.
     * Used to show journal indicators on the calendar synchronously.
     */
    static async getDaysWithScreenshots() {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('screenshots', 'readonly');
            const store = tx.objectStore('screenshots');
            const index = store.index('dayKey');
            const days = new Set();
            const req = index.openKeyCursor();
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    days.add(cursor.key);
                    cursor.continue();
                } else {
                    resolve(days);
                }
            };
            req.onerror = () => reject(req.error);
        });
    }
}

// Export
window.ImageStore = ImageStore;
