
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
    try {
      const response = await fetch(`${SCRIPT_URL}?action=list`);
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      return (Array.isArray(data) ? data : []).filter(s => s && (s.id || s.gl_id));
    } catch (e) {
      console.error("List sessions error:", e);
      return [];
    }
  },

  /**
   * Retrieve a full session snapshot by ID.
   */
  getSession: async (sessionId: string): Promise<HistorySession | null> => {
    try {
      const response = await fetch(`${SCRIPT_URL}?action=get&id=${sessionId}`);
      if (!response.ok) throw new Error(`Failed to fetch session ${sessionId}`);
      const data = await response.json();
      
      if (!data || data.error) return null;

      // Some GAS scripts return strings that need parsing
      const parseIfString = (val: any) => {
        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
          try { return JSON.parse(val); } catch { return val; }
        }
        return val;
      };

      data.parameters = parseIfString(data.parameters);
      data.csl_data = parseIfString(data.csl_data);
      data.match_data = parseIfString(data.match_data);
      data.analysis_results = parseIfString(data.analysis_results);
      data.scan_results = parseIfString(data.scan_results);
      data.mcat_data = parseIfString(data.mcat_data);
      data.company_overviews = parseIfString(data.company_overviews);
      
      return data;
    } catch (e) {
      console.error("Get session error:", e);
      return null;
    }
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
