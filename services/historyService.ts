
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
    // Generate unique fixed ID: glid-date-epoch
    const currentDate = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    const glId = data.gl_id || 'unknown';
    const customId = `${glId}-${currentDate}-${timestamp}`;
    
    const payload = {
      action: 'save',
      id: customId,
      created_at: new Date().toISOString(),
      ...data,
    };

    console.log("Saving session to Google Sheets:", customId, payload);

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
        console.log("Save successful:", result);
        return result;
    } catch (e) {
        console.warn("Standard fetch failed or returned non-JSON, attempting no-cors save as fallback.", e);
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
      console.log("Fetching history from:", SCRIPT_URL);
      const response = await fetch(`${SCRIPT_URL}?action=list`);
      if (!response.ok) throw new Error('Failed to fetch history');
      const json = await response.json();
      console.log("History raw response:", json);
      
      // Handle various GAS return structures
      let list = [];
      if (Array.isArray(json)) {
        list = json;
      } else if (json && Array.isArray(json.data)) {
        list = json.data;
      } else if (json && Array.isArray(json.sessions)) {
        list = json.sessions;
      } else if (json && json.status === 'success' && Array.isArray(json.data)) {
        list = json.data;
      }

      const filtered = list.filter(s => s && typeof s === 'object').map(s => {
        // Normalize keys for UI consistency
        const normalized: any = { ...s };
        if (!normalized.id && s.ID) normalized.id = s.ID;
        if (!normalized.gl_id && s.gl_id) normalized.gl_id = s.gl_id;
        if (!normalized.gl_id && s.GL_ID) normalized.gl_id = s.GL_ID;
        if (!normalized.gl_id && s.glid) normalized.gl_id = s.glid;
        if (!normalized.gl_id && s.glId) normalized.gl_id = s.glId;
        if (!normalized.product_name && s.PRODUCT_NAME) normalized.product_name = s.PRODUCT_NAME;
        if (!normalized.created_at && s.CREATED_AT) normalized.created_at = s.CREATED_AT;
        if (!normalized.created_at && s.timestamp) normalized.created_at = s.timestamp;
        
        return normalized;
      }).filter(s => s.id || s.gl_id);
      
      console.log("Processed sessions list for frontend:", filtered);
      return filtered;
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
      console.log("Fetching session snapshot:", sessionId);
      const url = `${SCRIPT_URL}?action=get&id=${sessionId}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch session ${sessionId}`);
      const json = await response.json();
      console.log("Session snapshot raw response:", json);
      
      // Handle GAS wrapping in .data or returning as first element of an array
      let data = json;
      if (json && json.status === 'success' && json.data) {
        data = json.data;
      } else if (json && Array.isArray(json.data) && json.data.length > 0) {
        data = json.data[0];
      } else if (Array.isArray(json) && json.length > 0) {
        data = json[0];
      } else if (json && json.data && !Array.isArray(json.data)) {
        data = json.data;
      }
      
      if (!data || data.error || (!data.id && !data.gl_id && !data.GL_ID && !data.glId)) {
        console.error("Session data error or missing structure:", data);
        return null;
      }

      // Normalize common keys if they are uppercase or camelCase from Sheet
      if (!data.id && data.ID) data.id = data.ID;
      if (!data.gl_id && data.gl_id) {} // already there
      if (!data.gl_id && data.GL_ID) data.gl_id = data.GL_ID;
      if (!data.gl_id && data.glId) data.gl_id = data.glId;
      if (!data.gl_id && data.glid) data.gl_id = data.glid;
      if (!data.product_name && data.PRODUCT_NAME) data.product_name = data.PRODUCT_NAME;
      if (!data.created_at && data.CREATED_AT) data.created_at = data.CREATED_AT;
      if (!data.parameters && data.PARAMETERS) data.parameters = data.PARAMETERS;
      if (!data.csl_data && data.CSL_DATA) data.csl_data = data.CSL_DATA;
      if (!data.match_data && data.MATCH_DATA) data.match_data = data.MATCH_DATA;
      if (!data.analysis_results && data.ANALYSIS_RESULTS) data.analysis_results = data.ANALYSIS_RESULTS;
      if (!data.scan_results && data.SCAN_RESULTS) data.scan_results = data.SCAN_RESULTS;
      if (!data.mcat_data && data.MCAT_DATA) data.mcat_data = data.MCAT_DATA;
      if (!data.company_overviews && data.COMPANY_OVERVIEWS) data.company_overviews = data.COMPANY_OVERVIEWS;
      if (!data.additional_comments && data.ADDITIONAL_COMMENTS) data.additional_comments = data.ADDITIONAL_COMMENTS;
      if (!data.mismatch_status && data.MISMATCH_STATUS) data.mismatch_status = data.MISMATCH_STATUS;

      // Some GAS scripts return strings that need parsing
      const parseIfString = (val: any) => {
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try { return JSON.parse(trimmed); } catch { return val; }
          }
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
      data.mismatch_status = parseIfString(data.mismatch_status);
      data.raw_category = parseIfString(data.raw_category);
      data.raw_complaints = parseIfString(data.raw_complaints);
      data.raw_ratings = parseIfString(data.raw_ratings);
      data.raw_fraud = parseIfString(data.raw_fraud);
      data.raw_services = parseIfString(data.raw_services);
      
      console.log("Parsed session data:", data);
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
