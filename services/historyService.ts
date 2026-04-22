
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwFQJtNOALgKfw5fWcXPb_H8kFLL6B8Y5BWRVR_lmVv3HKxJCOz7ZVd8tFfXiJx5oIIAQ/exec';

export interface HistorySession {
  id: string;
  gl_id: string;
  product_name: string;
  created_at: string;
  parameters?: any;
  csl_data?: any;
  match_data?: any;
  analysis_results?: any;
  scan_results?: any;
  mcat_data?: any;
  company_overviews?: any;
  additional_comments?: string;
}

/**
 * Service to handle history data storage and retrieval via Google Sheets Web App.
 * All requests are made directly from the frontend.
 */
export const historyService = {
  /**
   * Save a complete analysis session snapshot.
   */
  saveSession: async (data: any): Promise<{ id: string }> => {
    // Generate custom ID: glid-current date
    const currentDate = new Date().toISOString().split('T')[0];
    const glId = data.gl_id || 'unknown';
    const customId = `${glId}-${currentDate}`;
    
    const payload = {
      action: 'save',
      id: customId,
      ...data,
    };

    try {
        // Use text/plain to avoid preflight OPTIONS request
        const corsResponse = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify(payload),
        });
        if (!corsResponse.ok) throw new Error('CORS request failed');
        const result = await corsResponse.json();
        return result;
    } catch (e) {
        console.warn("Standard fetch failed or returned non-JSON, attempting no-cors save as fallback.");
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify(payload),
        });
        return { id: customId };
    }
  },

  /**
   * List all saved sessions (metadata only).
   */
  listSessions: async (): Promise<HistorySession[]> => {
    const response = await fetch(`${SCRIPT_URL}?action=list`);
    if (!response.ok) throw new Error('Failed to fetch history');
    return await response.json();
  },

  /**
   * Retrieve a full session snapshot by ID.
   */
  getSession: async (sessionId: string): Promise<HistorySession> => {
    const response = await fetch(`${SCRIPT_URL}?action=get&id=${sessionId}`);
    if (!response.ok) throw new Error(`Failed to fetch session ${sessionId}`);
    const data = await response.json();
    
    // Some GAS scripts return strings that need parsing
    if (typeof data.parameters === 'string') data.parameters = JSON.parse(data.parameters);
    if (typeof data.csl_data === 'string') data.csl_data = JSON.parse(data.csl_data);
    if (typeof data.match_data === 'string') data.match_data = JSON.parse(data.match_data);
    if (typeof data.analysis_results === 'string') data.analysis_results = JSON.parse(data.analysis_results);
    if (typeof data.scan_results === 'string') data.scan_results = JSON.parse(data.scan_results);
    if (typeof data.mcat_data === 'string') data.mcat_data = JSON.parse(data.mcat_data);
    if (typeof data.company_overviews === 'string') data.company_overviews = JSON.parse(data.company_overviews);
    
    return data;
  },

  /**
   * Delete a session by ID.
   */
  deleteSession: async (sessionId: string): Promise<void> => {
    const response = await fetch(`${SCRIPT_URL}?action=delete&id=${sessionId}`, {
      method: 'GET', // Many GAS scripts use GET for delete via query param
    });
    if (!response.ok) {
        // Fallback to POST if GET didn't work
        await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', id: sessionId })
        });
    }
  }
};
