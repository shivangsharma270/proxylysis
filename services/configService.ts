
import { db } from '../src/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface RedFlagConfig {
  pnsRateThreshold: number;
  hrsHistoryThreshold: number;
  nachBounceThreshold: number;
  addressNotVerifiedThreshold: number;
  blPurchaseThreshold: number;
  lmsReplyThreshold: number;
  bsComplaintsThreshold: number;
  updated_at?: any;
  updated_by?: string;
}

const CONFIG_DOC_ID = 'red_flags';
const COLLECTION_NAME = 'flag_configs';

export const configService = {
  /**
   * Default values as requested/implemented in original code
   */
  getDefaults: (): RedFlagConfig => ({
    pnsRateThreshold: 60,
    hrsHistoryThreshold: 1,
    nachBounceThreshold: 1,
    addressNotVerifiedThreshold: 1,
    blPurchaseThreshold: 40,
    lmsReplyThreshold: 10,
    bsComplaintsThreshold: 3
  }),

  /**
   * Fetch current configuration from Firestore
   */
  getFlags: async (): Promise<RedFlagConfig | null> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, CONFIG_DOC_ID);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as RedFlagConfig;
      }
      return null;
    } catch (e) {
      console.error("Error fetching flag config:", e);
      return null;
    }
  },

  /**
   * Save new configuration to Firestore
   */
  saveFlags: async (config: RedFlagConfig, userEmail: string): Promise<void> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, CONFIG_DOC_ID);
      await setDoc(docRef, {
        ...config,
        updated_by: userEmail,
        updated_at: serverTimestamp()
      });
    } catch (e) {
      console.error("Error saving flag config:", e);
      throw e;
    }
  }
};
