
const getBridgeHost = () => {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? window.location.origin 
    : 'http://localhost:3000';
};

const BRIDGE_HOST = getBridgeHost();

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

export const analyzeActivityData = async (jsonLogs: any, productName: string) => {
  const response = await fetch(`${BRIDGE_HOST}/ai/analyze_activity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ logs: jsonLogs, productName })
  });
  if (!response.ok) throw new Error("AI Activity Analysis Failed");
  return await response.text();
};

export const analyzeMatchmakingData = async (rawMatchJson: any) => {
  const response = await fetch(`${BRIDGE_HOST}/ai/match_records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawMatchJson })
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.contacts || [];
};

export const identifyInvolvedGLIDs = async (cslLogs: any[], matchmakingRecords: any[], productName: string) => {
  const response = await fetch(`${BRIDGE_HOST}/ai/identify_glids`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ logs: cslLogs, matchmaking: matchmakingRecords, productName })
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.involvedGLIDs || [];
};

export const analyzeProductMismatch = async (productName: string, mcatCategories: string[]) => {
  const response = await fetch(`${BRIDGE_HOST}/ai/mismatch_check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productName, mcatCategories })
  });
  if (!response.ok) return "Mismatch";
  const data = await response.json();
  return data.result || "Mismatch";
};

export const scanDocumentsWithGemini = async (files: { data: string, mimeType: string }[]) => {
  const response = await fetch(`${BRIDGE_HOST}/ai/scan_docs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files })
  });
  if (!response.ok) throw new Error("Document Scan Failed");
  return await response.json();
};

export const searchOnlinePresence = async (companyName: string, address: string, gst: string, contact: string) => {
  const response = await fetch(`${BRIDGE_HOST}/ai/online_presence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyName, address, gst, contact })
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.presence || [];
};
