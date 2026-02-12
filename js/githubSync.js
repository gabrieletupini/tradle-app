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
}

// Export
window.GitHubSync = GitHubSync;
