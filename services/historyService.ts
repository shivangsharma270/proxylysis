
import { db } from '../src/lib/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc, 
  doc, 
  deleteDoc, 
  query, 
  orderBy, 
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';

export interface HistorySession {
  id: string;
  gl_id: string;
  product_name: string;
  created_at: any;
  saved_by?: string;
  parameters?: any;
  csl_data?: any;
  match_data?: any;
  analysis_results?: any;
  scan_results?: any;
  mcat_data?: any;
  company_overviews?: any;
  additional_comments?: string;
  mismatch_status?: any;
  raw_category?: any;
  raw_complaints?: any;
  raw_ratings?: any;
  raw_fraud?: any;
  raw_services?: any;
}

const COLLECTION_NAME = 'sessions';

/**
 * Service to handle history data storage and retrieval via Firebase Firestore.
 */
export const historyService = {
  /**
   * Save a complete analysis session snapshot.
   */
  saveSession: async (data: any): Promise<{ id: string }> => {
    // Use existing ID if provided, otherwise generate a unique fixed ID: glid-date-epoch
    const customId = data.id || `${data.gl_id || 'unknown'}-${new Date().toISOString().split('T')[0]}-${Date.now()}`;
    
    // Remove functions or BigInts that Firestore can't serialize
    const cleanData = JSON.parse(JSON.stringify(data));
    
    const payload = {
      ...cleanData,
      id: customId,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: serverTimestamp()
    };

    console.log("Saving session to Firestore:", customId);

    try {
      await setDoc(doc(db, COLLECTION_NAME, customId), payload);
      return { id: customId };
    } catch (e) {
      console.error("Firestore save failed:", e);
      throw e;
    }
  },

  /**
   * List all saved sessions (metadata only).
   */
  listSessions: async (): Promise<HistorySession[]> => {
    try {
      console.log("Fetching history from Firestore...");
      const q = query(collection(db, COLLECTION_NAME), orderBy('updated_at', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const list: HistorySession[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          gl_id: data.gl_id || data.glId || '',
          product_name: data.product_name || data.productName || '',
          created_at: data.created_at,
          saved_by: data.saved_by || data.savedBy || '',
        });
      });
      
      console.log("Found sessions:", list.length);
      return list;
    } catch (e) {
      console.error("Firestore list sessions error:", e);
      return [];
    }
  },

  /**
   * Retrieve a full session snapshot by ID.
   */
  getSession: async (sessionId: string): Promise<HistorySession | null> => {
    try {
      console.log("Fetching session snapshot from Firestore:", sessionId);
      const docRef = doc(db, COLLECTION_NAME, sessionId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as HistorySession;
        console.log("Session fetched successfully");
        return data;
      } else {
        console.warn("No such session!");
        return null;
      }
    } catch (e) {
      console.error("Firestore get session error:", e);
      return null;
    }
  },

  /**
   * Delete a session by ID.
   */
  deleteSession: async (sessionId: string): Promise<void> => {
    try {
      console.log("Deleting session from Firestore:", sessionId);
      const docRef = doc(db, COLLECTION_NAME, sessionId);
      await deleteDoc(docRef);
      console.log("Session deleted successfully");
    } catch (e) {
      console.error("Firestore delete error:", e);
      throw e;
    }
  }
};
;
