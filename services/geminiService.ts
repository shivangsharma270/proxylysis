

const GATEWAY_URL = "https://imllm.intermesh.net/v1/chat/completions";
const ACCESS_KEY = (process.env.GEMINI_API_KEY as string);
if (!ACCESS_KEY) {
  console.warn("GEMINI_API_KEY is not defined in environment variables.");
}
const DEFAULT_MODEL = "google/gemini-2.5-pro";


export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  timestamp: number;
  model: string;
}

let globalTokenHistory: TokenUsage[] = [];

export const getTokenHistory = () => globalTokenHistory;
export const clearTokenHistory = () => { globalTokenHistory = []; };

async function callGateway(systemInstruction: string, userPrompt: any, isJson: boolean = false) {
  const messages: any[] = [
    { role: "system", content: systemInstruction }
  ];

  if (Array.isArray(userPrompt)) {
    const content = userPrompt.map(p => {
      if (p.text) return { type: "text", text: p.text };
      if (p.inlineData) return { 
        type: "image_url", 
        image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } 
      };
      return p;
    });
    messages.push({ role: "user", content });
  } else {
    messages.push({ role: "user", content: userPrompt });
  }

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ACCESS_KEY}`
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      response_format: isJson ? { type: "json_object" } : undefined,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gateway Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  // Track tokens
  if (data.usage) {
    globalTokenHistory.push({
      ...data.usage,
      timestamp: Date.now(),
      model: DEFAULT_MODEL
    });
    // Dispatch event for UI update
    window.dispatchEvent(new CustomEvent('gemini-token-update', { detail: data.usage }));
  }

  return data.choices[0].message.content;
}

export const analyzeActivityData = async (jsonLogs: any, productName: string) => {
  const systemInstruction = `You are a specialized data analyst tracking user journeys with strict filtering requirements. 
Your task is to analyze the provided JSON CSL logs.

ANALYSIS RULES:

1. DATA TABLE (activities array): 
   - Extract and include ALL log entries present in the JSON response into the "activities" array. 
   - Do NOT filter this array. Every single log entry from the source must be present here for the frontend table.
   - Fields: glId, dateTime, domain, referer, ipAddress, modId, sectionVisited, catalogOwnerId.

2. SEQUENTIAL SUMMARY (sequentialSummary string):
   - TARGET PRODUCT: "${productName || 'Any'}"
   - This summary is strictly filtered. ONLY include a log entry in this summary if it meets ALL these conditions:
     a) "catalog_owner_glusr_id" is NOT 0 or "0".
     b) The "referer" field is NOT empty and NOT just a generic page name.
     c) The "referer" field MUST contain keywords directly related to "${productName}" (or semantically similar terms).
   - EXCLUSION: If the referer is empty, or if it contains generic phrases like "Show FCP / MDC Page" without mentioning the product "${productName}", EXCLUDE that entry from the summary.
   - FALLBACK: If NO entries meet the filtering criteria above, you MUST return exactly: "No related activity found".
   - FORMAT: A sequential list of bullet points starting with "- ". 
     Format: "- [glId] visited [catalogOwnerId] at [dateTime] for the mentioned product".
   - No introductory text. No paragraphs.

TIMING CONVERSION:
- Convert all timestamps from yyyymmddhhmmss to dd-mm-yy hh:mm:ss format.

Return ONLY the JSON object with keys "activities" and "sequentialSummary".`;

  const prompt = `CSL logs to analyze:
  ${JSON.stringify(jsonLogs, null, 2)}`;

  try {
    const text = await callGateway(systemInstruction, prompt, true);
    return text;
  } catch (error: any) {
    console.error("Gateway analysis error:", error);
    throw new Error(`AI Analysis Failed: ${error.message || 'Check Gateway Connection'}`);
  }
};

/**
 * Normalizes raw Matchmaking API data into a strict 28-field tabular structure.
 */
export const analyzeMatchmakingData = async (rawMatchJson: any) => {
  const systemInstruction = `You are an expert data engineer. Parse the raw JSON Matchmaking API response and transform it into a strictly flat list of records containing exactly 28 fields.

REQUIRED FIELDS (Map raw values to these keys):
1. contact_city, 2. contact_state, 3. country_name, 4. contacts_name, 5. contacts_company, 6. contacts_mobile1, 7. contact_ph_country, 8. contact_number_type, 9. contact_last_product, 10. last_product_qty, 11. contacts_add_date, 12. last_contact_date, 13. last_contact_date_view, 14. latest_txn_date, 15. latest_txn_date_view, 16. last_message, 17. unread_message_cnt, 18. contacts_glid, 19. im_contact_id, 20. uniqueId, 21. fk_glusr_usr_id, 22. is_txn_initiator, 23. latest_txn_initiator, 24. is_call, 25. mcat_id, 26. mcat_name, 27. starred_lead_color, 28. contact_type_remarks

RULES:
- Locate the array of records within the raw input (look for keys like 'data', 'contacts', 'records', or the root array).
- For each record, map available values to the 28 required fields.
- If a field is missing, use an empty string "" or "0" for unread_message_cnt.
- Ensure all 28 keys exist in every object in the output array.
- Return ONLY the JSON object with key "contacts" containing the array.`;

  try {
    const text = await callGateway(systemInstruction, `Matchmaking Source Data: ${JSON.stringify(rawMatchJson)}`, true);
    const parsed = JSON.parse(text.trim());
    return parsed.contacts || [];
  } catch (error) {
    console.error("Matchmaking Analysis critical error:", error);
    return [];
  }
};

/**
 * Identifies GLIDs involved in a deal for the mentioned product.
 * Uses CSL logs (referer) and Matchmaking (contact_last_product).
 */
export const identifyInvolvedGLIDs = async (cslLogs: any[], matchmakingRecords: any[], productName: string) => {
  const systemInstruction = `You are a conflict intelligence auditor. Your task is to identify GLIDs (Global User IDs) where the product "${productName}" (or terms that resemble or match it exactly) appears in the activity records.

INPUT DATA:
- Target Product Name: ${productName}
- CSL Log Excerpts: ${JSON.stringify((cslLogs || []).filter(l => l && typeof l === 'object').map(l => ({ referer: l.referer, glId: l.glusr_id })))}
- Matchmaking Records: ${JSON.stringify((matchmakingRecords || []).filter(m => m && typeof m === 'object').map(m => ({ glId: m.contacts_glid, lastProduct: m.contact_last_product, companyName: m.contacts_company })))}

AUDIT LOGIC:
1. Scan CSL log "referer" fields for the exact product name "${productName}" or terms that resemble it.
2. Scan Matchmaking "lastProduct" and "companyName" fields for matches or resemblances to "${productName}".
3. Identify the GLIDs associated with these entries.
4. Do NOT provide involvement logic or explanations.

OUTPUT:
Return a JSON array of objects representing the identified GLIDs in a key called "involvedGLIDs".
Each object must have:
- glId: The identified ID.
- companyName: The company name associated with this GLID from matchmaking records.
- lastProduct: The product string found in the data that matched/resembled "${productName}".
- confidenceScore: A percentage string (e.g., "100%" for exact match, "80%" for resemblance).

Return ONLY the JSON object.`;

  try {
    const text = await callGateway(systemInstruction, `Identify GLIDs matching product: ${productName}`, true);
    const parsed = JSON.parse(text.trim());
    return parsed.involvedGLIDs || [];
  } catch (error) {
    console.error("GLID Identification error:", error);
    return [];
  }
};

/**
 * Uses Gemini to determine if the Target Product is matching or a subject of Approved Products.
 */
export const analyzeProductMismatch = async (productName: string, approvedProducts: string[]) => {
  if (!productName || !approvedProducts || approvedProducts.length === 0) {
    return "Mismatch";
  }

  const systemInstruction = `You are a product catalog auditor. Your task is to determine if a specific "Target Product" is matching or a subject of (logical subset, specific type, or relevant match for) a list of "Approved Products" that a seller is allowed to transact.

LOGIC:
- A "No Mismatch" occurs if the Target Product matches an entry, is a specific model/type of an entry, a synonym, or a subset that logically falls under any of the provided Approved Products.
- A "Mismatch" occurs if the Target Product is completely unrelated to all the provided Approved Products.

INPUT:
- Target Product: ${productName}
- Approved Products: ${approvedProducts.join(", ")}

OUTPUT:
Return a JSON object with a single key "result" which must be either "No Mismatch" or "Mismatch".
Return ONLY the JSON object.`;

  try {
    const text = await callGateway(systemInstruction, `Compare Target Product "${productName}" with Approved List: ${approvedProducts.join(", ")}`, true);
    const parsed = JSON.parse(text.trim());
    return parsed.result || "Mismatch";
  } catch (error) {
    console.error("Product Mismatch Analysis error:", error);
    return "Mismatch";
  }
};

/**
 * Performs OCR on uploaded documents using Gemini to extract specific business details.
 */
export const scanDocumentsWithGemini = async (files: { data: string, mimeType: string }[]) => {
  const systemInstruction = `You are a specialized document auditor. Your task is to perform OCR on the provided documents (invoices, screenshots, WhatsApp chats) and extract specific contact and payment details.

EXTRACT THESE FIELDS:
1. Names: List all person or company names found.
2. Phone Numbers: List all mobile or landline numbers.
3. Emails: List all email addresses.
4. UPI ID of receiver: Specifically look for UPI IDs (e.g., name@bank, number@upi) that appear to be the payment receiver.
5. Address: List any physical addresses found.
6. Invoice Dates: Specifically look for any dates mentioned in the documents (especially invoice dates).

RULES:
- If a field is not found, return an empty array for that field.
- Remove duplicates.
- Return ONLY the JSON object with keys: names, phoneNumbers, emails, upiIds, addresses, invoiceDates.`;

  const parts = files.map(file => ({
    inlineData: {
      data: file.data.split(',')[1], // Remove data:image/png;base64, prefix
      mimeType: file.mimeType
    }
  }));

  parts.push({ text: "Scan these documents and extract Names, Phone Numbers, Emails, UPI IDs, Addresses, and Invoice Dates." } as any);

  try {
    const text = await callGateway(systemInstruction, parts, true);
    return JSON.parse(text.trim());
  } catch (error: any) {
    console.error("OCR Analysis error:", error);
    throw new Error(`Document Scan Failed: ${error.message}`);
  }
};

/**
 * Searches for a seller's online presence and ratings using Google Search grounding.
 */
export const searchOnlinePresence = async (companyName: string, address: string, gst: string, contact: string) => {
  const systemInstruction = `You are a business intelligence researcher. Your task is to find the online presence, ratings, and reviews for a specific seller across various platforms (Google, Justdial, Indiamart, Facebook, etc.).
  
  SELLER DETAILS:
  - Name: ${companyName}
  - Address: ${address}
  - GST: ${gst}
  - Contact: ${contact}
  
  TASK:
  1. Find the seller's profiles and ratings on major platforms.
  2. Specifically look for Google Reviews/Rating.
  3. Look for other platforms like Trustpilot, Facebook, Justdial, etc.
  4. Extract the platform name, the rating (out of 5), and the direct link to the profile/reviews page.
  
  OUTPUT FORMAT:
  Return a JSON object with an array called "presence".
  Each item in the array should have:
  - platform: Name of the platform (e.g., "Google", "Facebook", "Justdial")
  - rating: The numeric rating (e.g., 4.1) or "N/A" if not found.
  - link: The direct URL to the profile or reviews page.
  
  Return ONLY the JSON object.`;

  try {
    const text = await callGateway(systemInstruction, `Find online presence and ratings for: ${companyName}, ${address}, ${contact}`, true);
    const parsed = JSON.parse(text.trim());
    return parsed.presence || [];
  } catch (error) {
    console.error("Online Presence Search error:", error);
    return [];
  }
};
