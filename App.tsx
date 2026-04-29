  import React, { useState, useEffect, useRef, useMemo } from 'react';
  import JSZip from 'jszip';
  import * as XLSX from 'xlsx';
  import { Bold, Italic, Underline, List, ListOrdered, Image as ImageIcon, Trash2, Type, Link as LinkIcon, Eraser, ArrowUpDown } from 'lucide-react';
  import { motion, AnimatePresence } from 'framer-motion';
  import { AgentSettings } from './types.ts';
  import { identifyInvolvedGLIDs, analyzeProductMismatch, searchOnlinePresence, scanDocumentsWithGemini } from './services/geminiService.ts';
import { historyService } from './services/historyService.ts';
import TokenAnalysis from './components/TokenAnalysis.tsx';
import { Coins } from 'lucide-react';

  const App: React.FC = () => {
    const [settings, setSettings] = useState<AgentSettings>({
      glId: '113816',
      startDate: new Date().toISOString().split('T')[0],
      startTime: '00:00:00',
      endDate: new Date().toISOString().split('T')[0],
      endTime: '23:59:59',
      authToken: '',
      productName: '',
      disputedAmount: '',
      document: null,
      disputedContactNumber: '',
      mid: '3655',
    });

    const [rawCslResponse, setRawCslResponse] = useState<any>(null);
    const [rawMatchResponse, setRawMatchResponse] = useState<any>(null);
    const [rawServicesResponse, setRawServicesResponse] = useState<any>(null);
    const [rawCategoryResponse, setRawCategoryResponse] = useState<any>(null);
    const [rawComplaintsResponse, setRawComplaintsResponse] = useState<any>(null);
    const [rawRatingsResponse, setRawRatingsResponse] = useState<any>(null);
    const [rawFraudResponse, setRawFraudResponse] = useState<any>(null);
    const [matchmakingData, setMatchmakingData] = useState<any[] | null>(null);
    const [cslTableData, setCslTableData] = useState<any[] | null>(null);
    const [lmsFraudLogs, setLmsFraudLogs] = useState<any[] | null>(null);
    
    // Company Overview state
    const [selectedGlId, setSelectedGlId] = useState<string | null>(null);
    const [companyOverviewData, setCompanyOverviewData] = useState<any>(null);
    const [redshiftOverviewData, setRedshiftOverviewData] = useState<any>(null);
    const [topBarSummaryData, setTopBarSummaryData] = useState<any>(null);
    const [mcatData, setMcatData] = useState<string[] | null>(null);
    const [latlongStatusData, setLatlongStatusData] = useState<string | null>(null);
    const [addressStatusData, setAddressStatusData] = useState<string | null>(null);
    const [onlinePresenceCache, setOnlinePresenceCache] = useState<Record<string, any[]>>({});
    const [isPresenceLoading, setIsPresenceLoading] = useState(false);
    const [isMerpLoading, setIsMerpLoading] = useState(false);
    const [isRedshiftLoading, setIsRedshiftLoading] = useState(false);
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [isMcatLoading, setIsMcatLoading] = useState(false);
    const [isLatlongLoading, setIsLatlongLoading] = useState(false);
    const [isOverviewPaneOpen, setIsOverviewPaneOpen] = useState(false);

    // Mismatch Analysis State
    const [mismatchAnalysisStatus, setMismatchAnalysisStatus] = useState<Record<string, 'pending' | 'processing' | 'Mismatch Found' | 'No Mismatch'>>({});
    const [isMismatchAnalyzing, setIsMismatchAnalyzing] = useState(false);

    // AI Involved GLIDs state
    const [involvedGLIDs, setInvolvedGLIDs] = useState<any[] | null>(null);
    const [isAnalyzingGLIDs, setIsAnalyzingGLIDs] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [suspectSortBy, setSuspectSortBy] = useState<'ratings' | 'paidSince' | null>(null);
    const [suspectSortOrder, setSuspectSortOrder] = useState<'asc' | 'desc'>('asc');
    const [suspectSearchQuery, setSuspectSearchQuery] = useState('');

    // Local filtering state for Matchmaking
    const [matchFilterStartDate, setMatchFilterStartDate] = useState<string>('');
    const [matchFilterEndDate, setMatchFilterEndDate] = useState<string>('');

    const [isSyncing, setIsSyncing] = useState(false);
    const [showReanalyzeButton, setShowReanalyzeButton] = useState(false);

    // Document Scanning State
    const [attachedFiles, setAttachedFiles] = useState<{ data: string, mimeType: string, name: string, size: number }[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanResults, setScanResults] = useState<{
      names: string[],
      phoneNumbers: string[],
      emails: string[],
      upiIds: string[],
      addresses: string[],
      invoiceDates: string[]
    } | null>(null);

    const [backendStatus, setBackendStatus] = useState<{csl: boolean, match: boolean, services: boolean, category: boolean, complaints: boolean, ratings: boolean, fraud: boolean, overview: boolean, summary: boolean, history: boolean}>({
      csl: false, 
      match: false, 
      services: false,
      category: false,
      complaints: false,
      ratings: false,
      fraud: false,
      overview: false,
      summary: false,
      history: false
    });
    const [error, setError] = useState<string | null>(null);
    const [networkIp, setNetworkIp] = useState<string>('Detecting...');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authEmail, setAuthEmail] = useState('');
    const [loginError, setLoginError] = useState('');

    const hardcodedUsers = {
      'rahul.singh@indiamart.com': '25672',
      'shivangi.saxena1@indiamart.com': '113739',
      'shivani.badoni@indiamart.com': '82394'
    };

    const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const email = formData.get('email') as string;
      const pass = formData.get('password') as string;
      const emailLower = email.toLowerCase().trim();
      
      if (hardcodedUsers[emailLower as keyof typeof hardcodedUsers] === pass) {
        setIsAuthenticated(true);
        setAuthEmail(emailLower);
        setLoginError('');
      } else {
        setLoginError('Invalid Email or Password');
      }
    };

    const columnSelectorRef = useRef<HTMLDivElement>(null);
    const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);

    const [isStreamsVisible, setIsStreamsVisible] = useState(false);
    const [isFileListModalOpen, setIsFileListModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportOptions, setExportOptions] = useState({
      initialParameters: true,
      extractedData: true,
      userActivity: true,
      matchmaking: true,
      networkSuspect: true,
    });
    const [selectedSuspectGLIDs, setSelectedSuspectGLIDs] = useState<string[]>([]);
    
    // History Management State
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isTokenAnalysisOpen, setIsTokenAnalysisOpen] = useState(false);
    const [historySessions, setHistorySessions] = useState<any[]>([]);
    const [historySearchTerm, setHistorySearchTerm] = useState('');
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [isSavingSession, setIsSavingSession] = useState(false);
    const [sessionOverviews, setSessionOverviews] = useState<Record<string, any>>({});
    const [additionalComments, setAdditionalComments] = useState('');
    const editorRef = useRef<HTMLDivElement>(null);

    const execCommand = (command: string, value: string = '') => {
      document.execCommand(command, false, value);
      if (editorRef.current) {
        setAdditionalComments(editorRef.current.innerHTML);
      }
    };

    const handleSaveSession = async () => {
      if (!cslTableData && !matchmakingData) {
        setError("No data to save. Please fetch or analyse data first.");
        return;
      }

      setIsSavingSession(true);
      try {
        // Pack all UI state into a restoration context to ensure it's saved 
        // even if the Sheet doesn't have dedicated columns for these fields.
        const restorationContext = {
          mismatch_status: mismatchAnalysisStatus,
          raw_category: rawCategoryResponse,
          raw_complaints: rawComplaintsResponse,
          raw_ratings: rawRatingsResponse,
          raw_fraud: rawFraudResponse,
          raw_services: rawServicesResponse
        };

        const payload = {
          gl_id: settings.glId,
          product_name: settings.productName,
          parameters: {
            ...settings,
            __restoration_context: restorationContext,
            saved_by: authEmail || 'Unknown'
          },
          csl_data: {
            raw: rawCslResponse,
            table: cslTableData,
            pagination: cslPagination
          },
          match_data: {
            raw: rawMatchResponse,
            table: matchmakingData
          },
          analysis_results: involvedGLIDs,
          scan_results: scanResults,
          mcat_data: mcatData,
          company_overviews: sessionOverviews,
          additional_comments: additionalComments,
          saved_by: authEmail || 'Unknown',
          SAVED_BY: authEmail || 'Unknown',
          savedBy: authEmail || 'Unknown',
          "Saved By": authEmail || 'Unknown',
          operator: authEmail || 'Unknown',
          email: authEmail || 'Unknown'
        };

        const result = await historyService.saveSession(payload);
        alert(`Session saved successfully! (ID: ${result.id})`);
        fetchHistory(); // Refresh history list after save
      } catch (err: any) {
        console.error("Save Session Error:", err);
        setError("Save Error: " + err.message);
      } finally {
        setIsSavingSession(false);
      }
    };

    const fetchHistory = async () => {
      setIsHistoryLoading(true);
      setError(null);
      try {
        const data = await historyService.listSessions();
        console.log("App.tsx fetchHistory received:", data);
        if (data && Array.isArray(data)) {
          setHistorySessions(data);
          console.log("State updated with", data.length, "sessions");
        } else {
          setHistorySessions([]);
          console.log("State set to empty array");
        }
      } catch (err: any) {
        console.error("Fetch History Error:", err);
        setError("History Load Error: " + err.message);
      } finally {
        setIsHistoryLoading(false);
      }
    };

    const loadSession = async (sessionId: string) => {
      setIsHistoryLoading(true);
      try {
        const session = await historyService.getSession(sessionId);
        if (!session) {
          setError("Session not found or could not be loaded.");
          return;
        }

        // Restore all states with safety checks
        if (session.parameters) setSettings(session.parameters);
        
        if (session.csl_data) {
          setRawCslResponse(session.csl_data.raw || null);
          setCslTableData(session.csl_data.table || null);
          setCslPagination(session.csl_data.pagination || { hasMore: false, isFetchingMore: false });
        }
        
        if (session.match_data) {
          setRawMatchResponse(session.match_data.raw || null);
          setMatchmakingData(session.match_data.table || null);
        }
        
        // Handle potential object-as-array wrapping from GAS
        let results = session.analysis_results || [];
        if (results && typeof results === 'object' && !Array.isArray(results)) {
          results = Object.values(results);
        }

        setInvolvedGLIDs(Array.isArray(results) ? results.filter((i: any) => i && (i.glId || i.gl_id || i.glid)).map((i: any) => ({
          ...i,
          glId: String(i.glId || i.gl_id || i.glid || '')
        })) : []);
        
        setScanResults(session.scan_results || { phoneNumbers: [], emails: [], upiIds: [], addresses: [], names: [], invoiceDates: [] });
        setMcatData(session.mcat_data || []);
        setSessionOverviews(session.company_overviews || {});
        setAdditionalComments(session.additional_comments || '');
        
        // Restore extended analysis states from direct properties OR restoration context
        const context = (session.parameters as any)?.__restoration_context;
        
        const mismatchStatus = session.mismatch_status || context?.mismatch_status;
        if (mismatchStatus) setMismatchAnalysisStatus(mismatchStatus);

        const category = session.raw_category || context?.raw_category;
        if (category) setRawCategoryResponse(category);

        const complaints = session.raw_complaints || context?.raw_complaints;
        if (complaints) setRawComplaintsResponse(complaints);

        const ratings = session.raw_ratings || context?.raw_ratings;
        if (ratings) setRawRatingsResponse(ratings);

        const fraud = session.raw_fraud || context?.raw_fraud;
        if (fraud) setRawFraudResponse(fraud);

        const services = session.raw_services || context?.raw_services;
        if (services) setRawServicesResponse(services);

        if (editorRef.current) {
          editorRef.current.innerHTML = session.additional_comments || '';
        }
        
        setIsHistoryModalOpen(false);
        alert("Session restored successfully!");
      } catch (err: any) {
        console.error("Load Session Error:", err);
        setError("Load Error: " + err.message);
      } finally {
        setIsHistoryLoading(false);
      }
    };

    const deleteSession = async (sessionId: string) => {
      if (!confirm("Are you sure you want to delete this session?")) return;
      try {
        await historyService.deleteSession(sessionId);
        setHistorySessions(prev => prev.filter(s => s.id !== sessionId));
      } catch (err) {
        console.error("Delete Session Error:", err);
      }
    };

    const handleExport = async () => {
      setIsExporting(true);
      try {
        const workbook = XLSX.utils.book_new();

        // 1. Initial Parameters
        if (exportOptions.initialParameters) {
          const paramsData = [
            { Parameter: 'GLusr_ID', Value: settings.glId },
            { Parameter: 'Product Name', Value: settings.productName },
            { Parameter: 'Auth Token', Value: settings.authToken },
            { Parameter: 'Start Date', Value: settings.startDate },
            { Parameter: 'End Date', Value: settings.endDate },
            { Parameter: 'Disputed Amount', Value: settings.disputedAmount },
            { Parameter: 'Disputed Contact', Value: settings.disputedContactNumber },
          ];
          const ws = XLSX.utils.json_to_sheet(paramsData);
          XLSX.utils.book_append_sheet(workbook, ws, 'Initial Parameters');
        }

        // 2. Extracted Data from Docs
        if (exportOptions.extractedData && scanResults) {
          const extractedData = [
            ...scanResults.names.map(v => ({ Category: 'Name', Value: v })),
            ...scanResults.phoneNumbers.map(v => ({ Category: 'Phone', Value: v })),
            ...scanResults.emails.map(v => ({ Category: 'Email', Value: v })),
            ...scanResults.upiIds.map(v => ({ Category: 'UPI ID', Value: v })),
            ...scanResults.addresses.map(v => ({ Category: 'Address', Value: v })),
            ...(scanResults.invoiceDates || []).map(v => ({ Category: 'Invoice Date', Value: v })),
          ];
          if (extractedData.length > 0) {
            const ws = XLSX.utils.json_to_sheet(extractedData);
            XLSX.utils.book_append_sheet(workbook, ws, 'Extracted Data');
          }
        }

        // 3. User Activity Timeline (CSL)
        if (exportOptions.userActivity && cslTableData) {
          const ws = XLSX.utils.json_to_sheet(cslTableData);
          XLSX.utils.book_append_sheet(workbook, ws, 'User Activity (CSL)');
        }

        // 4. Matchmaking Intelligence
        if (exportOptions.matchmaking && matchmakingData) {
          const ws = XLSX.utils.json_to_sheet(matchmakingData);
          XLSX.utils.book_append_sheet(workbook, ws, 'Matchmaking Intelligence');
        }

        // 5. Network Suspect Intelligence
        if (exportOptions.networkSuspect && involvedGLIDs) {
          const selectedSuspects = involvedGLIDs.filter(s => s && selectedSuspectGLIDs.includes(s.glId));
          
          const suspectsData = selectedSuspects.map(s => ({
            'GL ID': s.glId,
            'Last Product': s.lastProductMatch || s.lastProduct || '-',
            'Services': Array.isArray(s.servicesAvailed) ? s.servicesAvailed.join(', ') : (s.servicesAvailed || '-'),
            'Paid Since': s.paidSince || '-',
            'Mismatched': s.productMismatched || 'NO',
            'Ratings': s.supplierRating !== undefined ? s.supplierRating : (s.supplierRatings || 0),
            'Confidence': s.confidence || (parseInt(s.confidenceScore) > 80 ? 'HIGH' : 'LOW')
          }));
          
          if (suspectsData.length > 0) {
            const wsSuspects = XLSX.utils.json_to_sheet(suspectsData);
            XLSX.utils.book_append_sheet(workbook, wsSuspects, 'Network Suspects');

            // Company Overviews
            const overviews: any[] = [];
            for (const glId of selectedSuspectGLIDs) {
              try {
                const res = await fetch(`${BRIDGE_HOST}:5007/overview`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ glId, AK: settings.authToken })
                });
                if (res.ok) {
                  const data = await res.json();
                  overviews.push({
                    'GL ID': glId,
                    'Company Name': data.glusr_data?.companyname || '-',
                    'Contact Person': data.glusr_data?.contactperson || '-',
                    'Primary Contact': data.client_contact_numbers?.[0]?.value || '-',
                    'City': data.glusr_data?.city || '-',
                    'State': data.glusr_data?.state || '-',
                    'Address': data.glusr_data?.address || '-',
                    'Email': data.glusr_data?.email || '-',
                  });
                }
              } catch (e) {
                console.error(`Failed to fetch overview for ${glId}`, e);
              }
            }
            if (overviews.length > 0) {
              const wsOverviews = XLSX.utils.json_to_sheet(overviews);
              XLSX.utils.book_append_sheet(workbook, wsOverviews, 'Company Overviews');
            }
          }
        }

        XLSX.writeFile(workbook, `Proxylysis_Export_${new Date().getTime()}.xlsx`);
        setIsExportModalOpen(false);
      } catch (err: any) {
        setError("Export failed: " + err.message);
      } finally {
        setIsExporting(false);
      }
    };

    const matchColumnSelectorRef = useRef<HTMLDivElement>(null);
    const [isMatchColumnSelectorOpen, setIsMatchColumnSelectorOpen] = useState(false);

    // Target local backend from Vercel/Localhost
    const BRIDGE_HOST = 'http://localhost';

    // 47 Parameters for CSL
    const cslParameters = [
      "glusr_id", "url_weight", "datevalue", "fk_activity_id", "fk_display_title",
      "domain_name", "insertion_time", "log_status_flag", "modid", "referer",
      "adminln", "cat_id", "catalog_owner_glusr_id", "coordinate_accuracy", "coordinate_latitude",
      "coordinate_longitude", "empid", "fk_glcat_grp_id", "ga_utma_cookie", "gl_country",
      "gl_custtype_weight", "glb_city", "glb_latitude", "glb_longitude", "glb_state",
      "glusr_usr_listing_status", "http_status", "imeshvisitor_glusr_email", "imeshvisitor_glusr_id", "keyword",
      "location_pref_city_ids", "location_pref_city_names", "mcat_ids", "mcat_names", "owner_gl_country",
      "owner_gl_custtype_weight", "owner_glusr_usr_listing_status", "product_disp_id", "remote_ip", "request_url",
      "response_size", "response_time", "seller_city_id", "server_name", "user_agent",
      "v4iilex_glusr_email", "v4iilex_glusr_id"
    ];

    // Parameters for Matchmaking
    const matchParameters = [
      "Matchmaking Type",
      "contacts_name", "contacts_company", "contacts_mobile1", "contact_last_product",
      "last_product_qty", "last_message", "unread_message_cnt", "contacts_add_date",
      "last_contact_date", "last_contact_date_view", "latest_txn_date", "latest_txn_date_view",
      "contact_state", "country_name", "contact_ph_country", "contact_number_type",
      "is_txn_initiator", "latest_txn_initiator", "is_call", "mcat_id", "mcat_name",
      "contacts_glid", "im_contact_id", "uniqueId", "fk_glusr_usr_id", "contacts_type",
      "starred_lead_color", "contact_type_remarks", "glusr_usr_logo_img"
    ];

    const [visibleCslColumns, setVisibleCslColumns] = useState<string[]>(cslParameters);
    const [visibleMatchColumns, setVisibleMatchColumns] = useState<string[]>(matchParameters);

    const cachedCount = useMemo(() => {
      if (!involvedGLIDs) return 0;
      return involvedGLIDs.filter(item => item && item.glId && sessionOverviews[item.glId]?.merp).length;
    }, [involvedGLIDs, sessionOverviews]);

    const isGlidSuspect = (glId: string, row: any) => {
      const overview = sessionOverviews[glId];
      if (!overview) return false;

      const merp = overview.merp;
      const redshift = overview.redshift;
      const summary = overview.summary;

      // 1. PNS < 60%
      const pnsRateStr = merp?.paid_company?.[0]?.PNS_rate;
      const pnsRate = pnsRateStr ? parseFloat(pnsRateStr) : 100;
      if (pnsRate < 60) return true;

      // 2. HRS History Tickets >= 1
      if (Number(redshift?.hrs_history || 0) >= 1) return true;

      // 3. Nach Bounce >= 1
      if (Number(redshift?.nach_bounce || 0) >= 1) return true;

      // 4. Address not verified >= 1
      if (Number(redshift?.address_not_verified || 0) >= 1) return true;

      // 5. BL purchase frequency > 40 and LMS Replies < 10 in a month
      const blFreq = Number(summary?.bl_lm || 0);
      const lmsReplies = Number(summary?.qry_reply_lm || 0);
      if (blFreq > 40 && lmsReplies < 10) return true;

      // 6. BS complaints > 3
      if (Number(row.bsComplaints || 0) > 3) return true;

      return false;
    };

    // Compute filtered matchmaking data based on contacts_add_date
    const filteredMatchmakingData = useMemo(() => {
      if (!matchmakingData) return null;
      if (!matchFilterStartDate && !matchFilterEndDate) return matchmakingData;

      return matchmakingData.filter(item => {
        const addDateStr = item.contacts_add_date; 
        if (!addDateStr) return false;
        
        const itemDate = new Date(addDateStr.split(' ')[0]);
        const start = matchFilterStartDate ? new Date(matchFilterStartDate) : null;
        const end = matchFilterEndDate ? new Date(matchFilterEndDate) : null;

        if (start && itemDate < start) return false;
        if (end && itemDate > end) return false;
        
        return true;
      });
    }, [matchmakingData, matchFilterStartDate, matchFilterEndDate]);

    // Compute sorted involved GLIDs
    const sortedInvolvedGLIDs = useMemo(() => {
      if (!involvedGLIDs) return null;
      
      let filtered = [...involvedGLIDs].filter(item => item && item.glId);
      
      if (suspectSearchQuery) {
        const query = suspectSearchQuery.toLowerCase();
        filtered = filtered.filter(item => {
          const glId = String(item.glId || '').toLowerCase();
          const companyName = String(item.companyName || (item.glId && sessionOverviews[item.glId]?.merp?.glusr_data?.companyname) || '').toLowerCase();
          const services = Array.isArray(item.servicesAvailed) ? item.servicesAvailed.join(', ').toLowerCase() : String(item.servicesAvailed || '').toLowerCase();
          
          return glId.includes(query) || companyName.includes(query) || services.includes(query);
        });
      }

      const sorted = filtered;
      if (suspectSortBy === 'ratings') {
        sorted.sort((a, b) => {
          const valA = Number(a.supplierRating !== undefined ? a.supplierRating : (a.supplierRatings || 0));
          const valB = Number(b.supplierRating !== undefined ? b.supplierRating : (b.supplierRatings || 0));
          return suspectSortOrder === 'asc' ? valA - valB : valB - valA;
        });
      } else if (suspectSortBy === 'paidSince') {
        sorted.sort((a, b) => {
          const valA = String(a.paidSince || '');
          const valB = String(b.paidSince || '');
          return suspectSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        });
      }
      return sorted;
    }, [involvedGLIDs, suspectSortBy, suspectSortOrder, suspectSearchQuery, sessionOverviews]);

    // Handle re-analysis button appearance
    useEffect(() => {
      if (involvedGLIDs !== null) {
        setShowReanalyzeButton(true);
      }
    }, [visibleCslColumns, visibleMatchColumns, matchFilterStartDate, matchFilterEndDate]);

    useEffect(() => {
      fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => setNetworkIp(data.ip))
        .catch(() => setNetworkIp('Unavailable'));

      const checkHealth = async () => {
        let cslOk = false;
        let matchOk = false;
        let servicesOk = false;
        let categoryOk = false;
        let complaintsOk = false;
        let ratingsOk = false;
        let fraudOk = false;
        let overviewOk = false;
        let summaryOk = false;
        let historyOk = false;

        try {
          // History status check removed - using Google Sheets
          historyOk = true;
        } catch {}

        try {
          const cslRes = await fetch(`${BRIDGE_HOST}:5000/fetch`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ ping: true }) 
          });
          cslOk = cslRes.ok;
        } catch {}

        try {
          const matchRes = await fetch(`${BRIDGE_HOST}:5001/search`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ ping: true }) 
          });
          matchOk = matchRes.ok;
        } catch {}

        try {
          const servicesRes = await fetch(`${BRIDGE_HOST}:5002/services`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ ping: true }) 
          });
          servicesOk = servicesRes.ok;
        } catch {}

        try {
          const categoryRes = await fetch(`${BRIDGE_HOST}:5003/category`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ ping: true }) 
          });
          categoryOk = categoryRes.ok;
        } catch {}

        try {
          const complaintsRes = await fetch(`${BRIDGE_HOST}:5004/complaints`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ ping: true }) 
          });
          complaintsOk = complaintsRes.ok;
        } catch {}

        try {
          const ratingsRes = await fetch(`${BRIDGE_HOST}:5005/rating`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ ping: true }) 
          });
          ratingsOk = ratingsRes.ok;
        } catch {}

        try {
          const fraudRes = await fetch(`${BRIDGE_HOST}:5006/fraud`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ ping: true }) 
          });
          fraudOk = fraudRes.ok;
        } catch {}

        try {
          const overviewRes = await fetch(`${BRIDGE_HOST}:5007/overview`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ ping: true }) 
          });
          overviewOk = overviewRes.ok;
        } catch {}

        try {
          const summaryRes = await fetch(`${BRIDGE_HOST}:5008/summary`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ ping: true }) 
          });
          summaryOk = summaryRes.ok;
        } catch {}

        setBackendStatus({ 
          csl: cslOk, 
          match: matchOk, 
          services: servicesOk, 
          category: categoryOk, 
          complaints: complaintsOk, 
          ratings: ratingsOk, 
          fraud: fraudOk, 
          overview: overviewOk,
          summary: summaryOk,
          history: true
        });
      };

      checkHealth();
      
      const interval = setInterval(checkHealth, 5000);

      const handleClickOutside = (event: MouseEvent) => {
        if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
          setIsColumnSelectorOpen(false);
        }
        if (matchColumnSelectorRef.current && !matchColumnSelectorRef.current.contains(event.target as Node)) {
          setIsMatchColumnSelectorOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);

      return () => {
        clearInterval(interval);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);

    useEffect(() => {
      if (involvedGLIDs && involvedGLIDs.length > 0 && !isSyncing && !isAnalyzingGLIDs) {
        const autoFetch = async () => {
          for (const item of involvedGLIDs) {
            if (!item || !item.glId) continue;
            const glid = item.glId;
            if (!sessionOverviews[glid]) {
              try {
                const [merpRes, rsRes, sumRes, mcatRes] = await Promise.all([
                  fetch(`${BRIDGE_HOST}:5007/overview`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ glid, AK: settings.authToken })
                  }),
                  fetch(`${BRIDGE_HOST}:5004/redshift_overview`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ glId: glid })
                  }),
                  fetch(`${BRIDGE_HOST}:5008/summary`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ glid })
                  }),
                  fetch(`${BRIDGE_HOST}:5010/mcat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ glId: glid })
                  })
                ]);

                let merpData = null;
                let rsData = null;
                let sumData = null;
                let mcatDataBatch = null;

                if (merpRes.ok) {
                  const d = await merpRes.json();
                  merpData = d.data;
                  if (merpData?.glusr_data) {
                    searchOnlinePresence(
                      merpData.glusr_data.companyname,
                      `${merpData.glusr_data.address}, ${merpData.glusr_data.city}`,
                      merpData?.gst_data?.[0]?.gst || '',
                      merpData?.client_contact_numbers?.[0]?.value || ''
                    ).then(presence => {
                      setOnlinePresenceCache(prev => ({ ...prev, [glid]: presence }));
                    }).catch(() => {});
                  }
                }
                if (rsRes.ok) rsData = await rsRes.json();
                if (sumRes.ok) {
                  const d = await sumRes.json();
                  sumData = d?.parsed_response?.top_bar_data?.[0] || null;
                }
                if (mcatRes.ok) {
                  const d = await mcatRes.json();
                  mcatDataBatch = d.mcat_data || [];
                }

                setSessionOverviews(prev => ({
                  ...prev,
                  [glid]: { merp: merpData, redshift: rsData, summary: sumData, mcat: mcatDataBatch }
                }));
              } catch (e) {
                console.error(`Auto-fetch failed for ${glid}`, e);
              }
            }
          }
        };
        autoFetch();
      }
    }, [involvedGLIDs, isSyncing, isAnalyzingGLIDs]);

    const toggleCslColumn = (param: string) => {
      setVisibleCslColumns(prev => 
        prev.includes(param) ? prev.filter(p => p !== param) : [...prev, param]
      );
    };

    const toggleMatchColumn = (param: string) => {
      setVisibleMatchColumns(prev => 
        prev.includes(param) ? prev.filter(p => p !== param) : [...prev, param]
      );
    };

    const fetchCompanyOverview = async (glid: string) => {
      setSelectedGlId(glid);
      setIsOverviewPaneOpen(true);
      
      if (sessionOverviews[glid]) {
        setCompanyOverviewData(sessionOverviews[glid].merp);
        setRedshiftOverviewData(sessionOverviews[glid].redshift);
        setTopBarSummaryData(sessionOverviews[glid].summary);
        setMcatData(sessionOverviews[glid].mcat || []);
        setLatlongStatusData(sessionOverviews[glid].latlong_status || null);
        setAddressStatusData(sessionOverviews[glid].address_status || null);
        setIsMerpLoading(false);
        setIsRedshiftLoading(false);
        setIsSummaryLoading(false);
        setIsLatlongLoading(false);
        
        // Trigger presence if not cached
        const data = sessionOverviews[glid].merp;
        if (!onlinePresenceCache[glid] && data?.glusr_data) {
          const glusrData = data.glusr_data;
          setIsPresenceLoading(true);
          searchOnlinePresence(
            glusrData.companyname,
            `${glusrData.address}, ${glusrData.city}`,
            data?.gst_data?.[0]?.gst || '',
            data?.client_contact_numbers?.[0]?.value || ''
          ).then(presence => {
            setOnlinePresenceCache(prev => ({ ...prev, [glid]: presence }));
          }).catch(console.error).finally(() => setIsPresenceLoading(false));
        }
        return;
      }

      // Reset states for fresh fetch
      setCompanyOverviewData(null);
      setRedshiftOverviewData(null);
      setTopBarSummaryData(null);
      setMcatData(null);
      
      setIsMerpLoading(true);
      setIsRedshiftLoading(true);
      setIsSummaryLoading(true);
      setIsMcatLoading(true);
      setIsLatlongLoading(true);
      setLatlongStatusData(null);
      setAddressStatusData(null);

      // 1. Fetch MERP Overview
      fetch(`${BRIDGE_HOST}:5007/overview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ glid, AK: settings.authToken })
      })
      .then(res => res.json())
      .then(async (overviewData) => {
        const data = overviewData?.data || null;
        setCompanyOverviewData(data);
        setIsMerpLoading(false);

        // Update Session Overviews Cache
        setSessionOverviews(prev => ({
          ...prev,
          [glid]: {
            ...prev[glid],
            merp: data
          }
        }));

        // Trigger Online Presence search as soon as we have company details
        const glusrData = data?.glusr_data;
        if (!onlinePresenceCache[glid] && glusrData) {
          setIsPresenceLoading(true);
          try {
            const presence = await searchOnlinePresence(
              glusrData.companyname,
              `${glusrData.address}, ${glusrData.city}`,
              data?.gst_data?.[0]?.gst || '',
              data?.client_contact_numbers?.[0]?.value || ''
            );
            setOnlinePresenceCache(prev => ({ ...prev, [glid]: presence }));
          } catch (err) {
            console.error("Presence Search Error:", err);
          } finally {
            setIsPresenceLoading(false);
          }
        }
      })
      .catch(err => {
        console.error("MERP Error:", err);
        setIsMerpLoading(false);
      });

      // 2. Fetch Redshift Overview Metrics
      fetch(`${BRIDGE_HOST}:5004/redshift_overview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ glId: glid })
      })
      .then(res => {
        if (!res.ok) return res.json().then(err => { throw new Error(err.error || 'Redshift Fetch Failed') });
        return res.json();
      })
      .then(redshiftData => {
        console.log(`[*] Redshift Overview Data for ${glid}:`, redshiftData);
        setRedshiftOverviewData(redshiftData || null);
        setIsRedshiftLoading(false);

        // Update Session Overviews Cache
        setSessionOverviews(prev => ({
          ...prev,
          [glid]: {
            ...prev[glid],
            redshift: redshiftData
          }
        }));
      })
      .catch(err => {
        console.error("Redshift Error:", err);
        setError(`Redshift Error: ${err.message}`);
        setIsRedshiftLoading(false);
      });

      // 3. Fetch Top Bar Summary
      fetch(`${BRIDGE_HOST}:5008/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ glid })
      })
      .then(res => res.json())
      .then(summaryData => {
        const summary = summaryData?.parsed_response?.top_bar_data?.[0] || null;
        setTopBarSummaryData(summary);
        setIsSummaryLoading(false);

        // Update Session Overviews Cache
        setSessionOverviews(prev => ({
          ...prev,
          [glid]: {
            ...prev[glid],
            summary: summary
          }
        }));
      })
      .catch(err => {
        console.error("Summary Error:", err);
        setIsSummaryLoading(false);
      });

      // 3.5 Fetch MCAT Data
      fetch(`${BRIDGE_HOST}:5010/mcat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ glId: glid })
      })
      .then(res => res.json())
      .then(mcatRes => {
        const mcat = mcatRes.mcat_data || [];
        setMcatData(mcat);
        setIsMcatLoading(false);

        // Update Session Overviews Cache
        setSessionOverviews(prev => ({
          ...prev,
          [glid]: {
            ...prev[glid],
            mcat: mcat
          }
        }));
      })
      .catch(err => {
        console.error("MCAT Error:", err);
        setIsMcatLoading(false);
      });

      // 4. Fetch LatLong Status
      fetch(`${BRIDGE_HOST}:5004/bs_complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ glId: glid })
      })
      .then(res => res.json())
      .then(data => {
        const latlongStatus = data.latlong_status || 'Not Verified';
        const addressStatus = data.address_status || 'Not Verified';
        setLatlongStatusData(latlongStatus);
        setAddressStatusData(addressStatus);
        setIsLatlongLoading(false);

        // Update Session Overviews Cache
        setSessionOverviews(prev => ({
          ...prev,
          [glid]: {
            ...prev[glid],
            latlong_status: latlongStatus,
            address_status: addressStatus
          }
        }));
      })
      .catch(err => {
        console.error("LatLong Error:", err);
        setIsLatlongLoading(false);
      });
    };

    const unformatDateValue = (val: any) => {
      if (!val) return '';
      const sVal = String(val);
      if (/^\d{14}$/.test(sVal)) return sVal;
      if (/^\d{8}$/.test(sVal)) return sVal;
      
      // Handle dd-mm-yy hh:mm:ss or dd-mm-yy hh-mm-ss
      const match = sVal.match(/(\d{2})-(\d{2})-(\d{2})\s+(\d{2})[:|-](\d{2})[:|-](\d{2})/);
      if (match) {
        const [_, d, m, y, hh, mm, ss] = match;
        return `20${y}${m}${d}${hh}${mm}${ss}`;
      }
      return sVal.replace(/\D/g, '');
    };

    const getDisplayValue = (row: any, param: string) => {
      if (param === "Matchmaking Type") {
        const type = String(row['contacts_type']);
        if (type === '50') return 'ASTBUY';
        if (type === '51') return 'DIR';
        if (type === '54') return 'BL PURCHASE';
        return '-';
      }

      let val = row[param];
      if (val === null || val === undefined) return '-';
      if (typeof val === 'boolean') return val ? 'YES' : 'NO';
      if (param === 'insertion_time' && val.value) val = val.value;

      if (param === 'datevalue' && typeof val === 'string' && val.length === 14) {
        const yy = val.substring(2, 4);
        const m = val.substring(4, 6);
        const d = val.substring(6, 8);
        const hh = val.substring(8, 10);
        const mm = val.substring(10, 12);
        const ss = val.substring(12, 14);
        return `${d}-${m}-${yy} ${hh}:${mm}:${ss}`;
      }
      
      if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : '-';
      if (val.values && Array.isArray(val.values)) return val.values.length > 0 ? val.values.join(', ') : '-';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    };

    const parseMerpDate = (dateStr: string) => {
      try {
        return new Date(dateStr).getTime();
      } catch {
        return Infinity;
      }
    };

    const runMismatchAnalysis = async (glIds: string[]) => {
      if (isMismatchAnalyzing) return;
      setIsMismatchAnalyzing(true);

      const batchSize = 3;
      const idsToAnalyze = [...glIds];

      for (let i = 0; i < idsToAnalyze.length; i += batchSize) {
        const batch = idsToAnalyze.slice(i, i + batchSize);
        
        // Mark batch as processing
        setMismatchAnalysisStatus(prev => {
          const next = { ...prev };
          batch.forEach(id => { next[id] = 'processing'; });
          return next;
        });

        await Promise.all(batch.map(async (glId) => {
          try {
            // Ensure we have Company Overview data. If not, fetch it first.
            const overview = sessionOverviews[glId]?.merp;
            let approvedProducts = overview?.product_data?.approved_products?.names || [];
            
            if (!approvedProducts || approvedProducts.length === 0) {
              const overviewRes = await fetch(`${BRIDGE_HOST}:5007/overview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ glid: glId, AK: settings.authToken })
              });
              if (overviewRes.ok) {
                const d = await overviewRes.json();
                const merpData = d.data || null;
                approvedProducts = merpData?.product_data?.approved_products?.names || [];
                // Update cache
                setSessionOverviews(prev => ({
                  ...prev,
                  [glId]: { ...prev[glId], merp: merpData }
                }));
              }
            }

            if (!approvedProducts || approvedProducts.length === 0) {
              setMismatchAnalysisStatus(prev => ({ ...prev, [glId]: 'Mismatch Found' }));
              return;
            }

            const result = await analyzeProductMismatch(settings.productName, approvedProducts);
            setMismatchAnalysisStatus(prev => ({ 
              ...prev, 
              [glId]: result === 'Mismatch' ? 'Mismatch Found' : 'No Mismatch' 
            }));
          } catch (error) {
            console.error(`Mismatch analysis failed for ${glId}:`, error);
            setMismatchAnalysisStatus(prev => ({ ...prev, [glId]: 'Mismatch Found' }));
          }
        }));
      }
      setIsMismatchAnalyzing(false);
    };

    const handleReanalyze = async () => {
      if (!cslTableData || !filteredMatchmakingData) return;
      
      setIsAnalyzingGLIDs(true);
      setShowReanalyzeButton(false);
      setAnalysisProgress(10);
      
      try {
        const progressTimer = setInterval(() => {
          setAnalysisProgress(prev => Math.min(prev + 15, 90));
        }, 400);

        const involved = await identifyInvolvedGLIDs(cslTableData, filteredMatchmakingData, settings.productName);
        
        const detailedSuspects = [];
        const servicesLogMap: Record<string, any> = { ...rawServicesResponse };
        const categoryLogMap: Record<string, any> = { ...rawCategoryResponse };
        const complaintsLogMap: Record<string, any> = { ...rawComplaintsResponse };
        const ratingsLogMap: Record<string, any> = { ...rawRatingsResponse };

        for (let i = 0; i < involved.length; i++) {
          const item = involved[i];
          let servicesData: any = { servicesAvailed: [], paidSince: '-' };
          let bsComplaints: number | null = null; 
          let supplierRating: number | null = null;

          // Fetch Active Services (5002)
          try {
            const srvRes = await fetch(`${BRIDGE_HOST}:5002/services`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ glid: item.glId, AK: settings.authToken })
            });
            if (srvRes.ok) {
              const srvData = await srvRes.json();
              servicesLogMap[item.glId] = srvData;
              const details = srvData?.data?.service_details || [];
              const uniqueServices = Array.from(new Set(details.map((d: any) => d.SERVICE_NAME))) as string[];
              let earliestDate = '-';
              if (details.length > 0) {
                const sorted = details.sort((a: any, b: any) => parseMerpDate(a.STARTDATE) - parseMerpDate(b.STARTDATE));
                earliestDate = sorted[0].STARTDATE;
              }
              servicesData = { servicesAvailed: uniqueServices, paidSince: earliestDate };
            }
          } catch {}

          // Fetch Category Report (5003)
          try {
            const catRes = await fetch(`${BRIDGE_HOST}:5003/category`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ glId: item.glId })
            });
            if (catRes.ok) {
              const catData = await catRes.json();
              categoryLogMap[item.glId] = catData;
            }
          } catch {}

          // Fetch BS Complaints (5004 - Redshift)
          try {
            const compRes = await fetch(`${BRIDGE_HOST}:5004/complaints`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ glId: item.glId })
            });
            if (compRes.ok) {
              const compData = await compRes.json();
              complaintsLogMap[item.glId] = compData;
              bsComplaints = compData?.count !== undefined ? compData.count : 0;
            } else { bsComplaints = 0; }
          } catch { bsComplaints = 0; }

          // Fetch Supplier Ratings (5005)
          try {
            const ratRes = await fetch(`${BRIDGE_HOST}:5005/rating`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ glId: item.glId, AK: settings.authToken })
            });
            if (ratRes.ok) {
              const ratData = await ratRes.json();
              ratingsLogMap[item.glId] = ratData;
              supplierRating = ratData?.avg_rating !== undefined ? ratData.avg_rating : 0;
            } else { supplierRating = 0; }
          } catch { supplierRating = 0; }

          detailedSuspects.push({
            ...item,
            ...servicesData,
            productMismatched: 'pending',
            bsComplaints: bsComplaints,
            supplierRating: supplierRating
          });
        }

        setRawServicesResponse(servicesLogMap);
        setRawCategoryResponse(categoryLogMap);
        setRawComplaintsResponse(complaintsLogMap);
        setRawRatingsResponse(ratingsLogMap);
        clearInterval(progressTimer);
        setAnalysisProgress(100);
        setInvolvedGLIDs(detailedSuspects);
        
        // Initialize mismatch status and trigger analysis
        const initialStatus: Record<string, any> = {};
        detailedSuspects.forEach(s => { initialStatus[s.glId] = 'pending'; });
        setMismatchAnalysisStatus(initialStatus);
        runMismatchAnalysis(detailedSuspects.map(s => s.glId));

        setTimeout(() => setIsAnalyzingGLIDs(false), 500);
      } catch (err: any) {
        setError(err.message || 'Error during re-analysis.');
        setIsAnalyzingGLIDs(false);
      }
    };

    const handleDeleteMatchmakingRow = (itemToDelete: any) => {
      setMatchmakingData(prev => prev ? prev.filter(item => item !== itemToDelete) : null);
    };

    const [isFraudSearching, setIsFraudSearching] = useState(false);

    const timeOptions = useMemo(() => {
      const options = [];
      for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) { // 30 min intervals for easier selection
          const hh = String(h).padStart(2, '0');
          const mm = String(m).padStart(2, '0');
          options.push(`${hh}:${mm}:00`);
        }
      }
      // Add 23:59:59 specifically for end time
      if (!options.includes('23:59:59')) options.push('23:59:59');
      return options.sort();
    }, []);

    const handleFraudSearch = async () => {
      if (!settings.disputedContactNumber || !settings.authToken) {
        setError("Disputed Contact Number and Auth Token are required for Fraud Search.");
        return;
      }
      
      setIsFraudSearching(true);
      setLmsFraudLogs(null);
      setRawFraudResponse(null);
      
      try {
        const fraudRes = await fetch(`${BRIDGE_HOST}:5006/fraud`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attrVal: settings.disputedContactNumber,
            AK: settings.authToken
          })
        });
        
        if (fraudRes.ok) {
          const fraudData = await fraudRes.json();
          setRawFraudResponse(fraudData);
          setLmsFraudLogs(fraudData.logs || []);
        } else {
          const errText = await fraudRes.text();
          throw new Error(`Fraud Bridge failed: ${errText}`);
        }
      } catch (e: any) {
        console.error("Fraud Search Error:", e);
        setError(e.message || "Failed to fetch fraud data.");
      } finally {
        setIsFraudSearching(false);
      }
    };

    const [cslPagination, setCslPagination] = useState({
      nextStartTime: '',
      nextEndTime: '',
      firstSrch: '1',
      hasMore: false,
      isFetchingMore: false
    });

    const handleCslNext = async () => {
      if (!cslPagination.hasMore || cslPagination.isFetchingMore) return;

      setCslPagination(prev => ({ ...prev, isFetchingMore: true }));
      
      console.log(`[*] CSL Next Request: startTime=${cslPagination.nextStartTime}, endTime=${cslPagination.nextEndTime}`);
      try {
        const cslResponse = await fetch(`${BRIDGE_HOST}:5000/fetch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            glId: settings.glId,
            startTime: cslPagination.nextStartTime,
            endTime: cslPagination.nextEndTime,
            AK: settings.authToken
          })
        });

        if (!cslResponse.ok) {
          throw new Error("Failed to fetch next CSL batch");
        }

        const cslData = await cslResponse.json();
        const batchLogs: any[] = cslData?.activity ? Object.values(cslData.activity).flat() : [];
        
        if (batchLogs.length > 0) {
          // Deduplication to prevent overlapping records at batch boundaries
          const existingIds = new Set(cslTableData?.map(log => log.fk_activity_id || `${log.datevalue}-${log.remote_ip}-${log.request_url}`) || []);
          const uniqueNewLogs = batchLogs.filter(log => {
            const id = log.fk_activity_id || `${log.datevalue}-${log.remote_ip}-${log.request_url}`;
            return !existingIds.has(id);
          });

          setCslTableData(prev => [...(prev || []), ...uniqueNewLogs]);
          
          if (batchLogs.length === 100) {
            const lastDateRaw = batchLogs[batchLogs.length - 1]?.datevalue;
            const lastDate = unformatDateValue(lastDateRaw);
            setCslPagination({
              nextStartTime: lastDate,
              nextEndTime: cslPagination.nextEndTime,
              firstSrch: "",
              hasMore: true,
              isFetchingMore: false
            });
          } else {
            setCslPagination(prev => ({ ...prev, hasMore: false, isFetchingMore: false }));
          }
        } else {
          setCslPagination(prev => ({ ...prev, hasMore: false, isFetchingMore: false }));
        }
      } catch (err: any) {
        setError(err.message);
        setCslPagination(prev => ({ ...prev, isFetchingMore: false }));
      }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const MAX_SIZE = 10 * 1024 * 1024; // Increased to 10MB to accommodate zip contents
      const currentTotalSize = attachedFiles.reduce((sum, f) => sum + f.size, 0);
      const incomingFiles = Array.from(files) as File[];
      
      const newFiles: { data: string, mimeType: string, name: string, size: number }[] = [];

      const processFile = async (file: File) => {
        if (file.name.toLowerCase().endsWith('.zip')) {
          try {
            const zip = new JSZip();
            const contents = await zip.loadAsync(file);
            const zipEntries = Object.keys(contents.files).filter(name => !contents.files[name].dir);
            
            for (const entryName of zipEntries) {
              const zipFile = contents.files[entryName];
              const blob = await zipFile.async('blob');
              const extractedFile = new File([blob], entryName, { type: blob.type || 'application/octet-stream' });
              
              // Only process supported image/pdf types from zip (simplification)
              if (extractedFile.type.startsWith('image/') || extractedFile.type === 'application/pdf') {
                await readFile(extractedFile);
              }
            }
          } catch (err) {
            console.error("Error unzipping file:", err);
            setError(`Failed to process zip file: ${file.name}`);
          }
        } else {
          await readFile(file);
        }
      };

      const readFile = (file: File): Promise<void> => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              newFiles.push({
                data: event.target.result as string,
                mimeType: file.type || 'application/octet-stream',
                name: file.name,
                size: file.size
              });
            }
            resolve();
          };
          reader.onerror = () => resolve();
          reader.readAsDataURL(file);
        });
      };

      // Process all selected files
      await Promise.all(incomingFiles.map(f => processFile(f)));

      const incomingSize = newFiles.reduce((sum, f) => sum + f.size, 0);
      if (currentTotalSize + incomingSize > MAX_SIZE) {
        setError(`Total file size exceeds 10MB limit. (Current: ${(currentTotalSize / 1024 / 1024).toFixed(2)}MB, New: ${(incomingSize / 1024 / 1024).toFixed(2)}MB)`);
        e.target.value = '';
        return;
      }

      if (newFiles.length > 0) {
        setAttachedFiles(prev => [...prev, ...newFiles]);
      }
      
      e.target.value = '';
    };

    const handleScanDocuments = async () => {
      if (attachedFiles.length === 0) {
        setError("Please attach at least one document to scan.");
        return;
      }

      setIsScanning(true);
      setScanProgress(0);
      setScanResults(null);
      setError(null);

      // Simulated progress bar for better UX
      const progressInterval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 15;
        });
      }, 400);

      try {
        const results = await scanDocumentsWithGemini(attachedFiles);
        setScanResults(results);
        setScanProgress(100);
      } catch (err: any) {
        console.error("Scan Error:", err);
        setError(err.message);
      } finally {
        clearInterval(progressInterval);
        setTimeout(() => setIsScanning(false), 500);
      }
    };

    const handleFetch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSyncing) return;

      setIsSyncing(true);
      setError(null);
      setRawCslResponse(null);
      setRawMatchResponse(null);
      setCslTableData(null);
      setMatchmakingData(null);
      setSessionOverviews({});
      setAdditionalComments('');
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      
      const startFormatted = settings.startDate.replace(/-/g, '') + settings.startTime.replace(/:/g, '');
      const endFormatted = settings.endDate.replace(/-/g, '') + settings.endTime.replace(/:/g, '');

      try {
        // 1. Fetch CSL (First Batch)
        try {
          const cslResponse = await fetch(`${BRIDGE_HOST}:5000/fetch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              glId: settings.glId,
              startTime: startFormatted,
              endTime: endFormatted,
              AK: settings.authToken
            })
          });

          if (cslResponse.ok) {
            const cslData = await cslResponse.json();
            if (cslData && !cslData.error) {
              setRawCslResponse(cslData);
              let batchLogs: any[] = [];
              if (cslData?.activity) {
                batchLogs = Object.values(cslData.activity).flat().filter(l => l && typeof l === 'object');
              }
              setCslTableData(batchLogs);

              if (batchLogs.length === 100) {
                const lastDateRaw = batchLogs[batchLogs.length - 1]?.datevalue;
                const lastDate = unformatDateValue(lastDateRaw);
                setCslPagination({
                  nextStartTime: lastDate,
                  nextEndTime: endFormatted,
                  firstSrch: "",
                  hasMore: true,
                  isFetchingMore: false
                });
              } else {
                setCslPagination(prev => ({ ...prev, hasMore: false }));
              }
            } else if (cslData?.error) {
              console.error(`CSL API Error: ${cslData.error}`);
            }
          } else {
            console.error("CSL Bridge (5000) failed.");
          }
        } catch (cslErr) {
          console.error("CSL Fetch Error:", cslErr);
        }

        // 2. Fetch Matchmaking
        try {
          const matchResponse = await fetch(`${BRIDGE_HOST}:5001/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              glusrid: settings.glId,
              q: settings.productName,
              AK: settings.authToken
            })
          });
          if (matchResponse.ok) {
            const matchData = await matchResponse.json();
            setRawMatchResponse(matchData);
            const rawRecords = matchData?.response?.contacts || matchData?.data?.contacts || matchData?.contacts || [];
            const finalMatchRecords = Array.isArray(rawRecords) ? rawRecords.filter(r => r && typeof r === 'object') : [];
            setMatchmakingData(finalMatchRecords);
          } else {
            console.error("Matchmaking Bridge (5001) failed.");
          }
        } catch (matchErr) {
          console.error("Matchmaking Fetch Error:", matchErr);
        }

      } catch (err: any) {
        setError(err.message || 'Error during fetch.');
      } finally {
        setIsSyncing(false);
      }
    };

    const handleAnalyse = async () => {
      if (!cslTableData || !matchmakingData) {
        setError("Please fetch data first before starting analysis.");
        return;
      }

      if (!settings.productName) {
        setError("Product Name (q) is required for analysis.");
        return;
      }

      setIsAnalyzingGLIDs(true);
      setError(null);
      setInvolvedGLIDs(null);
      setAnalysisProgress(10);
      
      const progressTimer = setInterval(() => {
        setAnalysisProgress(prev => Math.min(prev + 15, 90));
      }, 400);

      try {
        const involvedRaw = await identifyInvolvedGLIDs(cslTableData, filteredMatchmakingData || [], settings.productName);
        const involved = Array.isArray(involvedRaw) ? involvedRaw.filter(i => i && i.glId) : [];
        
        const detailedSuspects = [];
        const servicesLogMap: Record<string, any> = {};
        const categoryLogMap: Record<string, any> = {};
        const complaintsLogMap: Record<string, any> = {};
        const ratingsLogMap: Record<string, any> = {};

        for (let i = 0; i < involved.length; i++) {
          const item = involved[i];
          
          let servicesData: any = { servicesAvailed: [], paidSince: '-' };
          let bsComplaints: number | null = null; 
          let supplierRating: number | null = null;

          // Fetch Active Services (5002)
          try {
            const srvRes = await fetch(`${BRIDGE_HOST}:5002/services`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ glid: item.glId, AK: settings.authToken })
            });
            if (srvRes.ok) {
              const srvData = await srvRes.json();
              servicesLogMap[item.glId] = srvData;
              const details = srvData?.data?.service_details || [];
              const uniqueServices = Array.from(new Set(details.map((d: any) => d.SERVICE_NAME))) as string[];
              let earliestDate = '-';
              if (details.length > 0) {
                const sorted = details.sort((a: any, b: any) => parseMerpDate(a.STARTDATE) - parseMerpDate(b.STARTDATE));
                earliestDate = sorted[0].STARTDATE;
              }
              servicesData = { servicesAvailed: uniqueServices, paidSince: earliestDate };
            }
          } catch {}

          // Fetch Category Report (5003)
          try {
            const catRes = await fetch(`${BRIDGE_HOST}:5003/category`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ glId: item.glId })
            });
            if (catRes.ok) {
              const catData = await catRes.json();
              categoryLogMap[item.glId] = catData;
            }
          } catch {}

          // Fetch BS Complaints (5004 - Redshift)
          try {
            const compRes = await fetch(`${BRIDGE_HOST}:5004/complaints`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ glId: item.glId })
            });
            if (compRes.ok) {
              const compData = await compRes.json();
              complaintsLogMap[item.glId] = compData;
              bsComplaints = compData?.count !== undefined ? compData.count : 0;
            } else { bsComplaints = 0; }
          } catch { bsComplaints = 0; }

          // Fetch Supplier Ratings (5005)
          try {
            const ratRes = await fetch(`${BRIDGE_HOST}:5005/rating`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ glId: item.glId, AK: settings.authToken })
            });
            if (ratRes.ok) {
              const ratData = await ratRes.json();
              ratingsLogMap[item.glId] = ratData;
              supplierRating = ratData?.avg_rating !== undefined ? ratData.avg_rating : 0;
            } else { supplierRating = 0; }
          } catch { supplierRating = 0; }

          // [ADDED] Fetch Company Overview Background (Silent)
          try {
            const overviewRes = await fetch(`${BRIDGE_HOST}:5007/overview`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ glid: item.glId, AK: settings.authToken })
            }).then(r => r.ok ? r.json() : null);
            
            const redshiftRes = await fetch(`${BRIDGE_HOST}:5004/redshift_overview`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ glId: item.glId })
            }).then(r => r.ok ? r.json() : null);
            
            const summaryRes = await fetch(`${BRIDGE_HOST}:5008/summary`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ glid: item.glId })
            }).then(r => r.ok ? r.json() : null);

            const mcatRes = await fetch(`${BRIDGE_HOST}:5010/mcat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ glId: item.glId })
            }).then(r => r.ok ? r.json() : null);

            const bsCompRes = await fetch(`${BRIDGE_HOST}:5004/bs_complaints`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ glId: item.glId })
            }).then(r => r.ok ? r.json() : null);

            if (overviewRes) {
              const merpData = overviewRes.data || null;
              setSessionOverviews(prev => ({
                ...prev,
                [item.glId]: {
                  merp: merpData,
                  redshift: redshiftRes || null,
                  summary: summaryRes?.parsed_response?.top_bar_data?.[0] || null,
                  mcat: mcatRes?.mcat_data || [],
                  latlong_status: bsCompRes?.latlong_status || 'Not Verified',
                  address_status: bsCompRes?.address_status || 'Not Verified'
                }
              }));
              
              if (merpData?.glusr_data?.companyname) {
                item.companyName = merpData.glusr_data.companyname;
              }
            }
          } catch (covErr) {
            console.error(`Silent Overview Error for ${item.glId}:`, covErr);
          }

          detailedSuspects.push({
            ...item,
            ...servicesData,
            productMismatched: 'pending',
            bsComplaints: bsComplaints,
            supplierRating: supplierRating
          });
        }

        setRawServicesResponse(servicesLogMap);
        setRawCategoryResponse(categoryLogMap);
        setRawComplaintsResponse(complaintsLogMap);
        setRawRatingsResponse(ratingsLogMap);
        clearInterval(progressTimer);
        setAnalysisProgress(100);
        setInvolvedGLIDs(detailedSuspects);

        // Initialize mismatch status and trigger analysis
        const initialStatus: Record<string, any> = {};
        detailedSuspects.forEach(s => { initialStatus[s.glId] = 'pending'; });
        setMismatchAnalysisStatus(initialStatus);
        runMismatchAnalysis(detailedSuspects.map(s => s.glId));

        setTimeout(() => setIsAnalyzingGLIDs(false), 500);
      } catch (err: any) {
        setError(err.message || 'Error during analysis.');
        setIsAnalyzingGLIDs(false);
      } finally {
        clearInterval(progressTimer);
      }
    };

    const isFullyOnline = backendStatus.csl && backendStatus.match && backendStatus.services && backendStatus.category && backendStatus.complaints && backendStatus.ratings && backendStatus.fraud && backendStatus.overview && backendStatus.summary && backendStatus.history;

    if (!isAuthenticated) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-indigo-100 selection:text-indigo-900">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white w-full max-w-md rounded-[3rem] shadow-[0_40px_100px_-15px_rgba(0,0,0,0.08)] border border-slate-200/60 overflow-hidden"
          >
            <div className="p-10 pt-14">
              <div className="flex flex-col items-center mb-12">
                <motion.div 
                  whileHover={{ rotate: 0, scale: 1.05 }}
                  initial={{ rotate: 3 }}
                  className="bg-gradient-to-br from-indigo-600 to-violet-700 h-20 w-20 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-200 transition-all duration-500 mb-8"
                >
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                </motion.div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Proxylysis Login</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-3">Proxylysis Intel Network</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2.5">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Official Email</label>
                  <div className="relative">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206"></path></svg>
                    </div>
                    <input 
                      name="email"
                      type="email" 
                      required
                      placeholder="name@indiamart.com" 
                      className="w-full bg-slate-50 border border-slate-200/80 rounded-[1.5rem] pl-14 pr-6 py-5 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300" 
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Password</label>
                  <div className="relative">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                    </div>
                    <input 
                      name="password"
                      type="password" 
                      required
                      placeholder="••••••••" 
                      className="w-full bg-slate-50 border border-slate-200/80 rounded-[1.5rem] pl-14 pr-6 py-5 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300" 
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {loginError && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0, y: -10 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -10 }}
                      className="bg-rose-50 border border-rose-100/60 text-rose-600 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3"
                    >
                      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                      {loginError}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button 
                  type="submit"
                  className="w-full py-5 bg-slate-900 hover:bg-black text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.3em] shadow-[0_20px_40px_-10px_rgba(15,23,42,0.3)] transform transition-all active:scale-[0.98] hover:-translate-y-0.5"
                >
                  Verify Identity
                </button>
              </form>
            </div>
            <div className="bg-slate-50/80 p-8 border-t border-slate-100 flex flex-col items-center gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">Proprietary Audit Technology</span>
              <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest">© 2026 IndiaMart InterMesh Ltd.</span>
            </div>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans">
        {/* Sticky Top Bar */}
        <div className="sticky top-0 z-[60] bg-white/70 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
          <div className="max-w-[1800px] mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 transform rotate-3 hover:rotate-0 transition-transform duration-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase leading-none">Proxylysis</h1>
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] mt-1">Intelligence & Audit Engine</span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Network IP */}
              <div className="hidden md:flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-slate-100/80 border border-slate-200 px-4 py-2 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                IP: <span className="text-slate-900 ml-1">{networkIp}</span>
              </div>

              {/* Systems Online Consolidated */}
              <div className="relative group">
                <div className={`flex items-center gap-2.5 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border cursor-help transition-all duration-300 ${isFullyOnline ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'}`}>
                  <div className={`w-2 h-2 rounded-full animate-pulse ${isFullyOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                  {isFullyOnline ? 'All Systems Active' : 'System Alert'}
                </div>
                
                {/* Backend Status Popup */}
                <div className="absolute right-0 top-full mt-3 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[70] transform translate-y-2 group-hover:translate-y-0">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 pb-2 border-b border-slate-100">Service Connectivity</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'CSL', port: 5000, status: backendStatus.csl, color: 'bg-blue-500' },
                      { id: 'LMS', port: 5001, status: backendStatus.match, color: 'bg-indigo-500' },
                      { id: 'MERP', port: 5002, status: backendStatus.services, color: 'bg-violet-500' },
                      { id: 'CAT', port: 5003, status: backendStatus.category, color: 'bg-purple-500' },
                      { id: 'REDSHIFT', port: 5004, status: backendStatus.complaints, color: 'bg-rose-500' },
                      { id: 'RATINGS', port: 5005, status: backendStatus.ratings, color: 'bg-amber-500' },
                      { id: 'FRAUD', port: 5006, status: backendStatus.fraud, color: 'bg-pink-500' },
                      { id: 'OVERVIEW', port: 5007, status: backendStatus.overview, color: 'bg-cyan-500' },
                      { id: 'SUMMARY', port: 5008, status: backendStatus.summary, color: 'bg-teal-500' },
                      { id: 'SHEETS', port: 'Cloud', status: true, color: 'bg-green-600' },
                    ].map((svc) => (
                      <div key={svc.id} className="flex items-center justify-between group/item">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${svc.status ? svc.color : 'bg-slate-300'}`}></div>
                          <span className="text-[11px] font-bold text-slate-600 group-hover/item:text-slate-900 transition-colors">{svc.id}</span>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${svc.status ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                          {svc.status ? `OK` : 'OFFLINE'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Report Number Button */}
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    fetchHistory();
                    setIsHistoryModalOpen(true);
                  }}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all transform hover:scale-105 active:scale-95 border border-slate-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  History
                </button>
                <button 
                  onClick={() => setIsTokenAnalysisOpen(true)}
                  className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all transform hover:scale-105 active:scale-95 border border-indigo-200"
                >
                  <Coins className="w-4 h-4" />
                  Token Analysis
                </button>
                {involvedGLIDs && involvedGLIDs.length > 0 && (
                  <>
                    <button 
                      onClick={handleSaveSession}
                      disabled={isSavingSession}
                      className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all transform hover:scale-105 active:scale-95 border border-emerald-200"
                    >
                      {isSavingSession ? (
                        <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                      )}
                      Save Session
                    </button>
                    <button 
                      onClick={() => {
                        setIsExportModalOpen(true);
                        // Default select all GLIDs
                        setSelectedSuspectGLIDs(involvedGLIDs.filter(s => s && s.glId).map(s => s.glId));
                      }}
                      className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-indigo-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                      Export Data
                    </button>
                  </>
                )}
                <a 
                  href="https://cybercrime.gov.in/Webform/Crime_AuthoLogin.aspx?rnt=5" 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-rose-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  Report Fraud
                </a>
                <div className="h-8 w-px bg-slate-200 mx-2"></div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Operator</span>
                    <span className="text-[10px] font-bold text-slate-900 truncate max-w-[120px]">{authEmail.split('@')[0].replace('.', ' ')}</span>
                  </div>
                  <button 
                    onClick={() => {
                      setIsAuthenticated(false);
                      setAuthEmail('');
                    }}
                    className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100 group"
                    title="Logout"
                  >
                    <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[1800px] mx-auto p-4 md:p-6">
          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-600 px-4 py-2.5 rounded-lg text-[10px] font-bold flex items-center gap-3">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-3 space-y-8">
              <section className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500">
                <div className="flex items-center gap-4 mb-8 pb-4 border-b border-slate-100">
                  <div className="p-3 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Parameters</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Intelligence Config</p>
                  </div>
                </div>
                <form onSubmit={handleFetch} className="flex flex-col gap-5">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">GLusr_ID</label>
                    <input type="text" value={settings.glId} onChange={e => setSettings({...settings, glId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Product Name (q)</label>
                    <input type="text" placeholder="e.g. Solar Panels" value={settings.productName} onChange={e => setSettings({...settings, productName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Auth Token (AK)</label>
                    <input type="text" placeholder="Enter Auth Token (AK)" value={settings.authToken} onChange={e => setSettings({...settings, authToken: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Start Date</label>
                      <input type="date" value={settings.startDate} onChange={e => setSettings({...settings, startDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[11px] font-bold text-slate-600 outline-none focus:ring-4 focus:ring-indigo-500/10" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Start Time</label>
                      <select 
                        value={settings.startTime} 
                        onChange={e => setSettings({...settings, startTime: e.target.value})} 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[11px] font-bold text-slate-600 outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none cursor-pointer"
                      >
                        {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">End Date</label>
                      <input type="date" value={settings.endDate} onChange={e => setSettings({...settings, endDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[11px] font-bold text-slate-600 outline-none focus:ring-4 focus:ring-indigo-500/10" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">End Time</label>
                      <select 
                        value={settings.endTime} 
                        onChange={e => setSettings({...settings, endTime: e.target.value})} 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[11px] font-bold text-slate-600 outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none cursor-pointer"
                      >
                        {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Disputed Amount (₹)</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">₹</span>
                      <input 
                        type="number" 
                        placeholder="0.00" 
                        value={settings.disputedAmount} 
                        onChange={e => setSettings({...settings, disputedAmount: e.target.value})} 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-5 py-3 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700" 
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 mt-4">
                    <div className="flex justify-between items-center mb-4">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Documents</label>
                      <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">MAX 5MB</span>
                    </div>
                    <div className="flex flex-col gap-4">
                      <input 
                        type="file" 
                        multiple 
                        onChange={handleFileChange}
                        className="hidden" 
                        id="doc-upload"
                        accept="image/*,application/pdf"
                      />
                      <label 
                        htmlFor="doc-upload"
                        className="flex items-center justify-center gap-4 px-4 py-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all group"
                      >
                        <div className="p-2 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                          <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                        </div>
                        <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest group-hover:text-indigo-600">Upload Evidence</span>
                      </label>

                      {attachedFiles.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <div className="grid grid-cols-1 gap-2">
                            {attachedFiles.slice(0, 3).map((f, i) => (
                              <div key={i} className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl text-[10px] font-bold text-slate-700 border border-slate-100 shadow-sm group">
                                <div className="flex items-center gap-3 truncate">
                                  <div className="p-1.5 bg-slate-50 rounded-lg">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                  </div>
                                  <span className="truncate">{f.name}</span>
                                </div>
                                <button type="button" onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"></path></svg>
                                </button>
                              </div>
                            ))}
                          </div>
                          
                          {attachedFiles.length > 3 && (
                            <button 
                              type="button"
                              onClick={() => setIsFileListModalOpen(true)}
                              className="w-full py-2 bg-slate-50 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-all"
                            >
                              + {attachedFiles.length - 3} More Files (View All)
                            </button>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleScanDocuments}
                        disabled={isScanning || attachedFiles.length === 0}
                        className={`flex items-center justify-center gap-3 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${isScanning || attachedFiles.length === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 shadow-xl shadow-indigo-100 active:scale-95'}`}
                      >
                        {isScanning ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Neural Scanning...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                            Scan & Extract
                          </>
                        )}
                      </button>

                      {isScanning && (
                        <div className="space-y-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                          <div className="flex justify-between text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                            <span>AI OCR Engine</span>
                            <span>{Math.round(scanProgress)}%</span>
                          </div>
                          <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-indigo-100">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300 shadow-[0_0_12px_rgba(99,102,241,0.4)]" style={{ width: `${scanProgress}%` }}></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-8">
                    <button 
                      type="button"
                      onClick={handleFetch}
                      disabled={isSyncing}
                      className={`py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] text-white transition-all transform active:scale-95 shadow-2xl ${isSyncing ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-black shadow-slate-300'}`}
                    >
                      {isSyncing ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Fetching...
                        </div>
                      ) : 'Fetch Data'}
                    </button>
                    <button 
                      type="button"
                      onClick={handleAnalyse}
                      disabled={isAnalyzingGLIDs || !cslTableData || !matchmakingData}
                      className={`py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] text-white transition-all transform active:scale-95 shadow-2xl ${isAnalyzingGLIDs || !cslTableData || !matchmakingData ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-violet-700 hover:from-indigo-700 hover:to-violet-800 shadow-indigo-200'}`}
                    >
                      {isAnalyzingGLIDs ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Analysing...
                        </div>
                      ) : 'Analyse Data'}
                    </button>
                  </div>

                  <button 
                    type="button"
                    onClick={() => setIsStreamsVisible(!isStreamsVisible)}
                    className={`w-full mt-4 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all transform active:scale-95 shadow-lg border flex items-center justify-center gap-2 ${isStreamsVisible ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                  >
                    {isStreamsVisible ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Hide Raw Data Streams
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Show Raw Data Streams
                      </>
                    )}
                  </button>
                </form>
              </section>

              {/* Document Scan Results Section */}
              {scanResults && (
                <section className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      </div>
                      <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Extracted Data</h2>
                    </div>
                    <button onClick={() => setScanResults(null)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    {[
                      { label: 'Names', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', data: scanResults.names, color: 'text-blue-500', bg: 'bg-blue-50' },
                      { label: 'Phone Numbers', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', data: scanResults.phoneNumbers, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                      { label: 'Emails', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', data: scanResults.emails, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                      { label: 'UPI ID of Receiver', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', data: scanResults.upiIds, color: 'text-violet-500', bg: 'bg-violet-50' },
                      { label: 'Address', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z', data: scanResults.addresses, color: 'text-rose-500', bg: 'bg-rose-50' },
                      { label: 'Invoice Dates', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', data: scanResults.invoiceDates || [], color: 'text-amber-500', bg: 'bg-amber-50' },
                    ].map((group, idx) => (
                      <div key={idx} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded-md ${group.bg} ${group.color}`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={group.icon}></path></svg>
                          </div>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{group.label}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.data && group.data.length > 0 ? (
                            group.data.map((item, i) => (
                              <span key={i} className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 text-[10px] font-bold text-slate-700 shadow-sm hover:border-indigo-200 hover:text-indigo-600 transition-all">
                                {item}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] font-bold text-slate-300 italic ml-1">No data detected</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {isStreamsVisible && (
                <section className="bg-slate-900 rounded-[2rem] border border-slate-800 p-6 shadow-2xl space-y-6">
                  <div className="flex flex-col h-[200px]">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                      MATCHMAKING STREAM
                    </h3>
                    <div className="flex-1 overflow-auto custom-scrollbar-dark rounded-2xl bg-black/40 p-3 border border-slate-800/50">
                      <pre className="text-blue-400 font-mono text-[10px] leading-relaxed">
                        {rawMatchResponse ? JSON.stringify(rawMatchResponse, null, 2) : '// Awaiting sync...'}
                      </pre>
                    </div>
                  </div>
                  <div className="flex flex-col h-[200px]">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
                      SERVICES STREAM
                    </h3>
                    <div className="flex-1 overflow-auto custom-scrollbar-dark rounded-2xl bg-black/40 p-3 border border-slate-800/50">
                      <pre className="text-rose-400 font-mono text-[10px] leading-relaxed">
                        {rawServicesResponse ? JSON.stringify(rawServicesResponse, null, 2) : '// Awaiting analysis...'}
                      </pre>
                    </div>
                  </div>
                  <div className="flex flex-col h-[200px]">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                      CATEGORY STREAM
                    </h3>
                    <div className="flex-1 overflow-auto custom-scrollbar-dark rounded-2xl bg-black/40 p-3 border border-slate-800/50">
                      <pre className="text-amber-400 font-mono text-[10px] leading-relaxed">
                        {rawCategoryResponse ? JSON.stringify(rawCategoryResponse, null, 2) : '// Awaiting report...'}
                      </pre>
                    </div>
                  </div>
                  <div className="flex flex-col h-[200px]">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></div>
                      COMPLAINTS STREAM
                    </h3>
                    <div className="flex-1 overflow-auto custom-scrollbar-dark rounded-2xl bg-black/40 p-3 border border-slate-800/50">
                      <pre className="text-cyan-400 font-mono text-[10px] leading-relaxed">
                        {rawComplaintsResponse ? JSON.stringify(rawComplaintsResponse, null, 2) : '// Awaiting query...'}
                      </pre>
                    </div>
                  </div>
                  <div className="flex flex-col h-[200px]">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                      RATINGS STREAM
                    </h3>
                    <div className="flex-1 overflow-auto custom-scrollbar-dark rounded-2xl bg-black/40 p-3 border border-slate-800/50">
                      <pre className="text-indigo-400 font-mono text-[10px] leading-relaxed">
                        {rawRatingsResponse ? JSON.stringify(rawRatingsResponse, null, 2) : '// Awaiting ratings...'}
                      </pre>
                    </div>
                  </div>
                  <div className="flex flex-col h-[200px]">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-pink-500 rounded-full"></div>
                      FRAUD STREAM
                    </h3>
                    <div className="flex-1 overflow-auto custom-scrollbar-dark rounded-2xl bg-black/40 p-3 border border-slate-800/50">
                      <pre className="text-pink-400 font-mono text-[10px] leading-relaxed">
                        {rawFraudResponse ? JSON.stringify(rawFraudResponse, null, 2) : '// Awaiting fraud data...'}
                      </pre>
                    </div>
                  </div>
                </section>
              )}
            </div>

            <div className="lg:col-span-9 space-y-8">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[900px]">
                <div className="border-b border-slate-100 px-8 py-6 flex items-center justify-between bg-gradient-to-r from-slate-50/50 to-white">
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Operational Workspace</h2>
                  </div>
                  <div className="flex items-center gap-4">
                    {showReanalyzeButton && !isAnalyzingGLIDs && !isSyncing && (
                      <button 
                        onClick={handleReanalyze}
                        className="flex items-center gap-3 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all transform active:scale-95"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a2 2 0 00-1.96 1.414l-.598 2.39a2 2 0 002.564 2.457l2.39-.598a2 2 0 001.414-1.96l-.477-2.387a2 2 0 00-.547-1.022zm0 0l-5.428-5.428m0 0l-5.428-5.428a2 2 0 10-2.828 2.828l5.428 5.428m0 0l-5.428 5.428a2 2 0 102.828 2.828l5.428-5.428z"></path></svg>
                        Neural Re-Analysis
                      </button>
                    )}
                    {(isSyncing || isAnalyzingGLIDs) && (
                      <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Processing Intelligence...</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 p-8 space-y-12 overflow-y-auto custom-scrollbar max-h-[1000px]">
                  
                  {/* 1. CSL Activity Timeline */}
                  <section className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                          <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                          </div>
                          User Activity Timeline (CSL)
                          {cslTableData && (
                            <span className="ml-2 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black border border-blue-100">
                              {cslTableData.length} Records
                            </span>
                          )}
                        </h3>
                        <p className="text-xs font-medium text-slate-400 ml-10">Live interaction stream from central services</p>
                      </div>
                      
                      <div className="relative" ref={columnSelectorRef}>
                        <button 
                          onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)}
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
                          Columns
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md text-[9px] font-black">{visibleCslColumns.length}/{cslParameters.length}</span>
                        </button>

                        {isColumnSelectorOpen && (
                          <div className="absolute right-0 mt-3 w-[600px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-6 transform origin-top-right transition-all">
                            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
                              <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Visibility Controls</span>
                              <div className="flex gap-3">
                                  <button onClick={() => setVisibleCslColumns(cslParameters)} className="text-[10px] font-black text-indigo-600 uppercase hover:underline tracking-widest">Select All</button>
                                  <button onClick={() => setVisibleCslColumns([])} className="text-[10px] font-black text-rose-600 uppercase hover:underline tracking-widest">Clear All</button>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-y-3 gap-x-6 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                              {cslParameters.map(param => (
                                <label key={param} className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-slate-50 rounded-xl transition-colors">
                                  <input 
                                    type="checkbox" 
                                    checked={visibleCslColumns.includes(param)}
                                    onChange={() => toggleCslColumn(param)}
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                                  />
                                  <span className={`text-[11px] font-bold truncate ${visibleCslColumns.includes(param) ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-500'}`}>
                                    {param}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm max-h-[600px] flex flex-col">
                      <div className="overflow-auto custom-scrollbar flex-1">
                        {cslTableData !== null ? (
                          <>
                            <table className="w-full text-left border-collapse" style={{ minWidth: `${(visibleCslColumns.length * 180) + 64}px` }}>
                              <thead className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[11px] font-black uppercase tracking-widest">
                                <tr>
                                  <th className="px-6 py-4 border-r border-white/10 text-center w-20">#</th>
                                  {cslParameters.map((param) => visibleCslColumns.includes(param) && (
                                    <th key={param} className="px-6 py-4 border-r border-white/10 whitespace-nowrap">{param}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-xs text-slate-600 font-bold">
                                {cslTableData.length > 0 ? (
                                  cslTableData.map((row, i) => (
                                    <tr key={i} className="hover:bg-blue-50/30 transition-colors group">
                                      <td className="px-6 py-4 border-r border-slate-100 text-center font-black bg-slate-50/50 text-slate-400 group-hover:text-blue-600">{i + 1}</td>
                                      {cslParameters.map((param) => visibleCslColumns.includes(param) && (
                                        <td key={param} className="px-6 py-4 border-r border-slate-100 truncate max-w-[400px] group-hover:text-slate-900" title={getDisplayValue(row, param)}>
                                          {getDisplayValue(row, param)}
                                        </td>
                                      ))}
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={visibleCslColumns.length + 1} className="py-20 text-center text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                      No Activity Found in Sync Window
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                            {cslPagination.hasMore && (
                              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-center">
                                <button 
                                  onClick={handleCslNext}
                                  disabled={cslPagination.isFetchingMore}
                                  className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-indigo-100 transition-all disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                  {cslPagination.isFetchingMore ? (
                                    <>
                                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                      Fetching Next Batch...
                                    </>
                                  ) : (
                                    'Load Next 100 Records'
                                  )}
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="py-20 text-center text-[10px] font-black uppercase text-slate-300 tracking-widest">Execute sync to populate logs</div>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* 2. Matchmaking Table */}
                  <section className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                          <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                          </div>
                          Matchmaking Intelligence
                          {filteredMatchmakingData && (
                            <span className="ml-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black border border-indigo-100">
                              {filteredMatchmakingData.length} Connections
                            </span>
                          )}
                        </h3>
                        <p className="text-xs font-medium text-slate-400 ml-10">Buyer-Seller connection analysis & lead routing</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Filter Range</span>
                              <input 
                                  type="date" 
                                  value={matchFilterStartDate} 
                                  onChange={(e) => setMatchFilterStartDate(e.target.value)}
                                  className="text-[10px] font-bold text-slate-700 bg-transparent border-none outline-none focus:ring-0 p-0" 
                              />
                              <span className="text-slate-300 font-black">/</span>
                              <input 
                                  type="date" 
                                  value={matchFilterEndDate} 
                                  onChange={(e) => setMatchFilterEndDate(e.target.value)}
                                  className="text-[10px] font-bold text-slate-700 bg-transparent border-none outline-none focus:ring-0 p-0" 
                              />
                            </div>

                            <div className="relative" ref={matchColumnSelectorRef}>
                              <button 
                                onClick={() => setIsMatchColumnSelectorOpen(!isMatchColumnSelectorOpen)}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all shadow-sm"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
                                Columns
                                <span className="bg-slate-100 px-2 py-0.5 rounded-md text-[9px] font-black">{visibleMatchColumns.length}/{matchParameters.length}</span>
                              </button>

                              {isMatchColumnSelectorOpen && (
                                <div className="absolute right-0 mt-3 w-[600px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-6 transform origin-top-right transition-all">
                                  <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
                                    <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Visibility Controls</span>
                                    <div className="flex gap-3">
                                        <button onClick={() => setVisibleMatchColumns(matchParameters)} className="text-[10px] font-black text-indigo-600 uppercase hover:underline tracking-widest">Select All</button>
                                        <button onClick={() => setVisibleMatchColumns([])} className="text-[10px] font-black text-rose-600 uppercase hover:underline tracking-widest">Clear All</button>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-y-3 gap-x-6 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                    {matchParameters.map(param => (
                                      <label key={param} className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-slate-50 rounded-xl transition-colors">
                                        <input 
                                          type="checkbox" 
                                          checked={visibleMatchColumns.includes(param)}
                                          onChange={() => toggleMatchColumn(param)}
                                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                                        />
                                        <span className={`text-[11px] font-bold truncate ${visibleMatchColumns.includes(param) ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-500'}`}>
                                          {param}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                      <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm max-h-[450px] flex flex-col animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="overflow-x-auto custom-scrollbar">
                          {filteredMatchmakingData !== null ? (
                            <table className="w-full text-left border-collapse" style={{ minWidth: `${(visibleMatchColumns.length * 180) + 64}px` }}>
                              <thead className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[11px] font-black uppercase tracking-widest">
                                <tr>
                                  <th className="px-6 py-4 border-r border-white/10 text-center w-20">#</th>
                                  <th className="px-6 py-4 border-r border-white/10 text-center w-20">Actions</th>
                                  {matchParameters.map((param) => visibleMatchColumns.includes(param) && (
                                    <th key={param} className="px-6 py-4 border-r border-white/10 whitespace-nowrap">{param}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-xs text-slate-600 font-bold">
                                {filteredMatchmakingData.length > 0 ? (
                                  filteredMatchmakingData.map((rec, i) => (
                                    <tr key={i} className="hover:bg-indigo-50/30 transition-colors group">
                                      <td className="px-6 py-4 border-r border-slate-100 text-center font-black bg-slate-50/50 text-slate-400 group-hover:text-indigo-600">{i + 1}</td>
                                      <td className="px-6 py-4 border-r border-slate-100 text-center">
                                        <button 
                                          onClick={() => handleDeleteMatchmakingRow(rec)}
                                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                          title="Delete Row"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </td>
                                      {matchParameters.map((param) => visibleMatchColumns.includes(param) && (
                                        <td key={param} className="px-6 py-4 border-r border-slate-100 truncate max-w-[350px] group-hover:text-slate-900" title={getDisplayValue(rec, param)}>
                                          {param === 'starred_lead_color' && rec[param] ? (
                                            <div className="flex items-center gap-2">
                                              <div className="w-3 h-3 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: String(rec[param]) }}></div>
                                              <span className="font-mono text-[10px]">{String(rec[param])}</span>
                                            </div>
                                          ) : (
                                            getDisplayValue(rec, param)
                                          )}
                                        </td>
                                      ))}
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={visibleMatchColumns.length + 2} className="py-24 text-center">
                                      <div className="flex flex-col items-center gap-4 opacity-20">
                                        <svg className="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                        <span className="text-xs font-black uppercase tracking-widest">No Intelligence Records</span>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          ) : (
                            <div className="py-24 text-center">
                              <div className="flex flex-col items-center gap-4 opacity-20">
                                <svg className="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"></path></svg>
                                <span className="text-xs font-black uppercase tracking-widest">Execute Sync to Populate Intelligence</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                  </section>

                  {/* 3. AI Suspect Analysis: GL ID Involved for Product */}
                  <section className="mt-12 pt-12 border-t border-slate-100">
                    <div className="flex flex-col gap-8">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-4">
                            <div className="w-3 h-3 bg-rose-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.6)]"></div>
                            Network Suspect Intelligence
                            {involvedGLIDs && involvedGLIDs.length > 0 && (
                              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all duration-500 ${cachedCount === involvedGLIDs.length ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${cachedCount === involvedGLIDs.length ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                                {cachedCount === involvedGLIDs.length ? 'Intelligence Cached' : `Fetching Overviews: ${cachedCount}/${involvedGLIDs.length}`}
                              </div>
                            )}
                          </h3>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Automated fraud detection for {settings.productName || 'Product'}</p>
                        </div>
                        {(isAnalyzingGLIDs || isSyncing) && (
                          <div className="flex flex-col items-end gap-3 bg-rose-50 px-6 py-3 rounded-2xl border border-rose-100">
                              <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Neural Scan: {analysisProgress}%</span>
                              <div className="w-48 h-2 bg-white rounded-full overflow-hidden border border-rose-100">
                                <div className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-300 shadow-[0_0_10px_rgba(244,63,94,0.4)]" style={{ width: `${analysisProgress}%` }}></div>
                              </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                        <div className="relative flex-1">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                          </div>
                          <input 
                            type="text" 
                            placeholder="Search by GL ID, Seller Name or Service..." 
                            value={suspectSearchQuery}
                            onChange={(e) => setSuspectSearchQuery(e.target.value)}
                            className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all"
                          />
                        </div>
                        {suspectSearchQuery && (
                          <button 
                            onClick={() => setSuspectSearchQuery('')}
                            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <div className="border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/40 bg-white">
                        {involvedGLIDs ? (
                          <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                              <thead className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest">
                                  <tr>
                                    <th className="px-8 py-6 border-r border-white/5 w-20 text-center">#</th>
                                    <th className="px-8 py-6 border-r border-white/5">Involved GL ID</th>
                                    <th className="px-8 py-6 border-r border-white/5">Company Name</th>
                                    <th className="px-8 py-6 border-r border-white/5">Last Product</th>
                                    <th className="px-8 py-6 border-r border-white/5">Services</th>
                                    <th 
                                      className="px-8 py-6 border-r border-white/5 cursor-pointer hover:bg-slate-800 transition-colors group/header"
                                      onClick={() => {
                                        if (suspectSortBy === 'paidSince') {
                                          setSuspectSortOrder(suspectSortOrder === 'asc' ? 'desc' : 'asc');
                                        } else {
                                          setSuspectSortBy('paidSince');
                                          setSuspectSortOrder('asc');
                                        }
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        Paid Since
                                        <ArrowUpDown size={12} className={`transition-opacity ${suspectSortBy === 'paidSince' ? 'opacity-100' : 'opacity-30 group-hover/header:opacity-100'}`} />
                                      </div>
                                    </th>
                                    <th className="px-8 py-6 border-r border-white/5">Mismatched</th>
                                    <th 
                                      className="px-8 py-6 border-r border-white/5 cursor-pointer hover:bg-slate-800 transition-colors group/header"
                                      onClick={() => {
                                        if (suspectSortBy === 'ratings') {
                                          setSuspectSortOrder(suspectSortOrder === 'asc' ? 'desc' : 'asc');
                                        } else {
                                          setSuspectSortBy('ratings');
                                          setSuspectSortOrder('asc');
                                        }
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        Ratings
                                        <ArrowUpDown size={12} className={`transition-opacity ${suspectSortBy === 'ratings' ? 'opacity-100' : 'opacity-30 group-hover/header:opacity-100'}`} />
                                      </div>
                                    </th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-600">
                                {sortedInvolvedGLIDs && sortedInvolvedGLIDs.length > 0 ? (
                                  sortedInvolvedGLIDs.map((row, i) => (
                                    <tr key={i} className={`hover:bg-rose-50/30 transition-all group ${isGlidSuspect(row.glId, row) ? 'bg-rose-50/50' : ''}`}>
                                      <td className={`px-8 py-6 border-r border-slate-50 text-center font-black group-hover:text-rose-600 ${isGlidSuspect(row.glId, row) ? 'text-rose-600' : 'text-slate-400'}`}>{i + 1}</td>
                                      <td className="px-8 py-6 border-r border-slate-50">
                                        <button 
                                          onClick={() => fetchCompanyOverview(row.glId)} 
                                          className={`font-black transition-colors hover:underline ${isGlidSuspect(row.glId, row) ? 'text-rose-600 hover:text-rose-800' : 'text-indigo-600 hover:text-indigo-800'}`}
                                        >
                                          {row.glId}
                                        </button>
                                      </td>
                                      <td className="px-8 py-6 border-r border-slate-50 truncate max-w-[250px] group-hover:text-slate-900 font-black text-slate-700">
                                        {row.companyName || sessionOverviews[row.glId]?.merp?.glusr_data?.companyname || '-'}
                                      </td>
                                      <td className="px-8 py-6 border-r border-slate-50 truncate max-w-[200px] group-hover:text-slate-900">{row.lastProductMatch || row.lastProduct || '-'}</td>
                                      <td className="px-8 py-6 border-r border-slate-50 group-hover:text-slate-900">
                                        {Array.isArray(row.servicesAvailed) ? row.servicesAvailed.join(', ') : (row.servicesAvailed || '-')}
                                      </td>
                                      <td className="px-8 py-6 border-r border-slate-50 group-hover:text-slate-900">{row.paidSince || '-'}</td>
                                      <td className="px-8 py-6 border-r border-slate-50">
                                        {mismatchAnalysisStatus[row.glId] === 'processing' ? (
                                          <div className="flex items-center gap-3">
                                            <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest animate-pulse">Analyzing...</span>
                                          </div>
                                        ) : mismatchAnalysisStatus[row.glId] === 'pending' ? (
                                          <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 bg-slate-200 rounded-full animate-pulse"></div>
                                            <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest">Queued</span>
                                          </div>
                                        ) : (
                                          <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm transition-all duration-300 ${
                                            mismatchAnalysisStatus[row.glId] === 'Mismatch Found' 
                                              ? 'bg-rose-50 text-rose-600 border-rose-100 shadow-rose-50' 
                                              : (mismatchAnalysisStatus[row.glId] === 'No Mismatch'
                                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-50'
                                                  : 'bg-slate-50 text-slate-400 border-slate-100')
                                          }`}>
                                            {mismatchAnalysisStatus[row.glId] || 'Pending'}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-8 py-6 border-r border-slate-50 text-center font-black">
                                        <span className="text-amber-600 flex items-center justify-center gap-1">
                                          {row.supplierRating !== undefined ? row.supplierRating : (row.supplierRatings || '-')}
                                          <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={7} className="py-32 text-center">
                                      <div className="flex flex-col items-center gap-6 opacity-30">
                                        <div className="p-4 bg-slate-100 rounded-full">
                                          <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                                        </div>
                                        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Initialize Analysis Engine</span>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="py-32 text-center">
                            <div className="flex flex-col items-center gap-6 opacity-30">
                              <div className="p-4 bg-slate-100 rounded-full animate-pulse">
                                <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                              </div>
                              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Awaiting Analysis Stream</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Additional Comments Section */}
                  <section className="mt-12 pt-12 border-t border-slate-100">
                    <div className="flex flex-col gap-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-4">
                            <div className="w-3 h-3 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.4)]"></div>
                            Additional Comments & Evidence
                          </h3>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Store manual findings, notes, and screenshots for this session</p>
                        </div>
                      </div>

                      <div className="flex flex-col border-2 border-slate-200 rounded-[2.5rem] overflow-hidden bg-white focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-50 transition-all shadow-sm">
                        {/* Gmail-like Toolbar */}
                        <div className="flex items-center gap-1 p-3 bg-slate-50 border-b border-slate-200 flex-wrap">
                          <button onClick={() => execCommand('bold')} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-600" title="Bold"><Bold size={18} /></button>
                          <button onClick={() => execCommand('italic')} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-600" title="Italic"><Italic size={18} /></button>
                          <button onClick={() => execCommand('underline')} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-600" title="Underline"><Underline size={18} /></button>
                          <div className="w-px h-6 bg-slate-300 mx-1"></div>
                          <button onClick={() => execCommand('insertUnorderedList')} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-600" title="Bullet List"><List size={18} /></button>
                          <button onClick={() => execCommand('insertOrderedList')} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-600" title="Numbered List"><ListOrdered size={18} /></button>
                          <div className="w-px h-6 bg-slate-300 mx-1"></div>
                          <button onClick={() => {
                            const url = prompt('Enter the URL:');
                            if (url) execCommand('createLink', url);
                          }} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-600" title="Insert Link"><LinkIcon size={18} /></button>
                          <button onClick={() => document.getElementById('comment-image-upload')?.click()} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-600" title="Insert Image"><ImageIcon size={18} /></button>
                          <div className="flex-1"></div>
                          <button onClick={() => {
                            if (confirm('Clear all comments and evidence?')) {
                              setAdditionalComments('');
                              if (editorRef.current) editorRef.current.innerHTML = '';
                            }
                          }} className="p-2 hover:bg-rose-100 text-rose-500 rounded-xl transition-colors" title="Clear All"><Eraser size={18} /></button>
                        </div>

                        {/* Editor Area */}
                        <div className="relative">
                          <div 
                            ref={editorRef}
                            contentEditable
                            onInput={(e) => setAdditionalComments(e.currentTarget.innerHTML)}
                            onPaste={(e) => {
                              const items = e.clipboardData.items;
                              for (let i = 0; i < items.length; i++) {
                                if (items[i].type.indexOf("image") !== -1) {
                                  e.preventDefault();
                                  const blob = items[i].getAsFile();
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    const img = `<img src="${event.target?.result}" class="max-w-full h-auto rounded-2xl my-6 border-4 border-white shadow-2xl ring-1 ring-slate-200" />`;
                                    execCommand('insertHTML', img);
                                  };
                                  if (blob) reader.readAsDataURL(blob);
                                }
                              }
                            }}
                            className="w-full min-h-[400px] p-10 outline-none text-slate-700 font-medium text-base leading-relaxed custom-scrollbar overflow-y-auto"
                          />
                          {!additionalComments && (
                            <div className="absolute top-10 left-10 text-slate-300 pointer-events-none text-sm font-bold uppercase tracking-widest opacity-50">
                              Type your observations here... (You can paste images directly)
                            </div>
                          )}
                        </div>
                      </div>
                      <input 
                        type="file" 
                        id="comment-image-upload" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const img = `<img src="${event.target?.result}" class="max-w-full h-auto rounded-2xl my-6 border-4 border-white shadow-2xl ring-1 ring-slate-200" />`;
                              execCommand('insertHTML', img);
                            };
                            reader.readAsDataURL(file);
                          }
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </section>

                  {/* 4. LMS Fraud Detection Data Section */}
                  <section className="mt-12 pt-12 border-t border-slate-100">
                    <div className="flex flex-col gap-8">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-4">
                            <div className="w-3 h-3 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.6)]"></div>
                            Fraud Network Analysis
                          </h3>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">LMS Interaction Logs & Disputed Contacts</p>
                        </div>
                        
                        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-200 shadow-inner">
                          <div className="relative">
                            <input 
                              type="text" 
                              placeholder="Enter Disputed Contact Number" 
                              value={settings.disputedContactNumber || ''} 
                              onChange={e => setSettings({...settings, disputedContactNumber: e.target.value})} 
                              className="bg-white border border-slate-200 rounded-xl px-5 py-3 text-xs font-bold w-[300px] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                            />
                          </div>
                          <button 
                            onClick={handleFraudSearch}
                            disabled={isFraudSearching || !settings.disputedContactNumber}
                            className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-white transition-all flex items-center gap-3 shadow-xl ${isFraudSearching || !settings.disputedContactNumber ? 'bg-slate-200 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 active:scale-95'}`}
                          >
                            {isFraudSearching ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Scanning...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                Audit Network
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div className="border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/40 bg-white min-h-[200px]">
                        {lmsFraudLogs ? (
                            <div className="overflow-x-auto custom-scrollbar">
                              <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest">
                                  <tr>
                                    <th className="px-8 py-6 border-r border-white/5 w-20 text-center">#</th>
                                    <th className="px-8 py-6 border-r border-white/5">Receiver Id</th>
                                    <th className="px-8 py-6 border-r border-white/5">Sender Id</th>
                                    <th className="px-8 py-6">Timestamp</th>
                                  </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-slate-600 divide-y divide-slate-100">
                                  {lmsFraudLogs.length > 0 ? (
                                    lmsFraudLogs.map((log, i) => (
                                      <tr key={i} className="hover:bg-indigo-50/30 transition-all group">
                                        <td className="px-8 py-5 border-r border-slate-50 text-center bg-slate-50/30 text-slate-400 group-hover:text-indigo-600">{i + 1}</td>
                                        <td className="px-8 py-5 border-r border-slate-50 group-hover:text-slate-900">{log.receiver_id || '-'}</td>
                                        <td className="px-8 py-5 border-r border-slate-50 group-hover:text-slate-900">{log.sender_id || '-'}</td>
                                        <td className="px-8 py-5 font-mono text-slate-500 group-hover:text-slate-900">{log.timestamp || '-'}</td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={4} className="py-32 text-center">
                                        <div className="flex flex-col items-center gap-6 opacity-30">
                                          <div className="p-4 bg-slate-100 rounded-full">
                                            <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                          </div>
                                          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">No Interaction Logs Found for {settings.disputedContactNumber}</span>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          ) : isFraudSearching ? (
                            <div className="flex flex-col items-center justify-center py-32 gap-6">
                              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Scanning Fraud Network...</span>
                            </div>
                          ) : (
                            <div className="py-32 text-center">
                              <div className="flex flex-col items-center gap-6 opacity-30">
                                <div className="p-4 bg-slate-100 rounded-full">
                                  <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Enter Disputed Contact to initiate Audit</span>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  </section>

                </div>
              </div>
            </div>
          </div>
        </div>

        {/* File List Modal */}
        {isFileListModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsFileListModalOpen(false)}></div>
            <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Attached Evidence</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{attachedFiles.length} files total</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsFileListModalOpen(false)}
                  className="p-3 hover:bg-slate-200 rounded-2xl transition-colors text-slate-400"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              
              <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 gap-3">
                  {attachedFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 px-6 py-4 rounded-2xl text-xs font-bold text-slate-700 border border-slate-100 group hover:border-indigo-200 hover:bg-white transition-all">
                      <div className="flex items-center gap-4 truncate">
                        <div className="p-2 bg-white rounded-xl shadow-sm">
                          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        </div>
                        <div className="flex flex-col truncate">
                          <span className="truncate text-slate-900">{f.name}</span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-widest">{(f.size / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => {
                          setAttachedFiles(prev => prev.filter((_, idx) => idx !== i));
                          if (attachedFiles.length <= 1) setIsFileListModalOpen(false);
                        }} 
                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"></path></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setIsFileListModalOpen(false)}
                  className="px-8 py-4 bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-200"
                >
                  Close Manager
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {isExportModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isExporting && setIsExportModalOpen(false)}></div>
            <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Export Intelligence</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select data modules to include</p>
                  </div>
                </div>
                <button onClick={() => setIsExportModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { id: 'initialParameters', label: 'Initial Parameters', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
                    { id: 'extractedData', label: 'Extracted Data from Docs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', disabled: !scanResults },
                    { id: 'userActivity', label: 'User Activity Timeline (CSL)', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                    { id: 'matchmaking', label: 'Matchmaking Intelligence', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
                    { id: 'networkSuspect', label: 'Network Suspect Intelligence', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
                  ].map((opt) => (
                    <div key={opt.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${opt.disabled ? 'opacity-40 grayscale cursor-not-allowed bg-slate-50 border-slate-100' : 'bg-white border-slate-200 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/5 cursor-pointer'}`}
                      onClick={() => !opt.disabled && setExportOptions({...exportOptions, [opt.id as keyof typeof exportOptions]: !exportOptions[opt.id as keyof typeof exportOptions]})}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl ${exportOptions[opt.id as keyof typeof exportOptions] ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={opt.icon}></path></svg>
                        </div>
                        <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{opt.label}</span>
                      </div>
                      {!opt.disabled && (
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${exportOptions[opt.id as keyof typeof exportOptions] ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200'}`}>
                          {exportOptions[opt.id as keyof typeof exportOptions] && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {exportOptions.networkSuspect && involvedGLIDs && involvedGLIDs.length > 0 && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select GLIDs to include Overviews</label>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-h-40 overflow-y-auto custom-scrollbar grid grid-cols-2 gap-2">
                      {involvedGLIDs.filter(s => s && s.glId).map((s) => (
                        <label key={s.glId} className="flex items-center gap-3 p-2 hover:bg-white rounded-xl transition-all cursor-pointer border border-transparent hover:border-slate-200">
                          <input 
                            type="checkbox" 
                            checked={selectedSuspectGLIDs.includes(s.glId)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedSuspectGLIDs([...selectedSuspectGLIDs, s.glId]);
                              else setSelectedSuspectGLIDs(selectedSuspectGLIDs.filter(id => id !== s.glId));
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-[11px] font-bold text-slate-600">{s.glId}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button 
                  onClick={() => setIsExportModalOpen(false)}
                  disabled={isExporting}
                  className="flex-1 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex-[2] px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  {isExporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Generating Excel...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                      Export Now
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Company Overview Side Pane */}
        {isOverviewPaneOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsOverviewPaneOpen(false)}></div>
            <div className="relative w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col animate-slide-in-right">
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                <div className="flex flex-col">
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Company Overview in 30 Days</h2>
                  <span className="text-[10px] font-bold text-slate-400">GL ID: {selectedGlId}</span>
                </div>
                <button 
                  onClick={() => setIsOverviewPaneOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                {isMerpLoading ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-4">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Basic Info...</span>
                  </div>
                ) : companyOverviewData ? (
                  <>
                    {/* Basic Info Grid */}
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-tight">Company Name</label>
                        <p className="text-sm font-bold text-slate-900 leading-tight">{companyOverviewData.glusr_data?.companyname || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-tight">Contact Person</label>
                        <p className="text-sm font-bold text-slate-900 leading-tight">{companyOverviewData.glusr_data?.contactperson || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-tight">Primary Contact</label>
                        <p className="text-sm font-bold text-indigo-600">
                          {companyOverviewData.client_contact_numbers?.[0]?.value || '-'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-tight">Customer Type</label>
                        <p className="text-sm font-bold text-slate-900">{companyOverviewData.glusr_data?.cust_type || '-'}</p>
                      </div>
                    </div>

                    {/* Performance Stats */}
                    <div className="grid grid-cols-4 gap-4 bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100 shadow-sm">
                      <div className="text-center">
                        <label className="text-[10px] font-black text-indigo-400 uppercase block mb-1">CQS</label>
                        <span className="text-sm font-black text-indigo-700">{companyOverviewData.csd_data?.CQS || '-'}</span>
                      </div>
                      <div className="text-center border-l border-indigo-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Enquiry</label>
                        <span className="text-sm font-black text-slate-900">{companyOverviewData.csd_data?.Enquiry || '-'}</span>
                      </div>
                      <div className="text-center border-l border-indigo-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Replies</label>
                        <span className="text-sm font-black text-slate-900">{companyOverviewData.csd_data?.Replies || '-'}</span>
                      </div>
                      <div className="text-center border-l border-indigo-100">
                        <label className="text-[10px] font-black text-amber-500 uppercase block mb-1">Rating</label>
                        <span className="text-sm font-black text-amber-600">{companyOverviewData.csd_data?.supplier_rating || '-'}</span>
                      </div>
                    </div>

                    {/* Location & GST */}
                    <div className="space-y-4">
                      <div className="p-5 border border-slate-100 rounded-2xl space-y-4 bg-white shadow-sm">
                        <div className="flex items-start gap-4">
                          <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                          </div>
                          <div className="flex-1">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Address</label>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs font-bold text-slate-700 leading-relaxed">
                                {companyOverviewData.glusr_data?.address}, {companyOverviewData.glusr_data?.city}, {companyOverviewData.glusr_data?.stateCode}
                              </p>
                              {isLatlongLoading ? (
                                <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <div className="flex gap-2">
                                  {latlongStatusData && (
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${latlongStatusData === 'LatLong Verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                      {latlongStatusData}
                                    </span>
                                  )}
                                  {addressStatusData && (
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${addressStatusData === 'Address Verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                      {addressStatusData}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-4 mt-2.5">
                              <span className="text-[11px] font-mono font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded">Lat: {companyOverviewData.glusr_data?.latitude}</span>
                              <span className="text-[11px] font-mono font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded">Long: {companyOverviewData.glusr_data?.longitude}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                          <div className="flex flex-col">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">GST Status</label>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-sm font-black text-slate-900">{companyOverviewData.gst_data?.[0]?.gst || 'No GST'}</span>
                              {(() => {
                                const vid = companyOverviewData.gst_data?.[0]?.verification_id;
                                if (vid === "3") return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-lg uppercase shadow-sm">OTP Verified</span>;
                                if (vid === "2") return <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-[9px] font-black rounded-lg uppercase shadow-sm">Tactical Verified</span>;
                                if (!vid) return <span className="px-2.5 py-1 bg-rose-100 text-rose-700 text-[9px] font-black rounded-lg uppercase shadow-sm">No GST</span>;
                                return null;
                              })()}
                            </div>
                          </div>
                          <div className="flex flex-col text-right">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Mobile App</label>
                            <span className={`text-xs font-black uppercase mt-0.5 ${companyOverviewData.paid_company?.[0]?.mobile_app_active === 'Active' ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {companyOverviewData.paid_company?.[0]?.mobile_app_active || 'Inactive'}
                            </span>
                          </div>
                        </div>
                        <div className="pt-3 border-t border-slate-50">
                          <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">PNS Rate</label>
                          <p className="text-sm font-bold text-slate-900 mt-0.5">{companyOverviewData.paid_company?.[0]?.PNS_rate || '-'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Website */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Website URL</label>
                      <a href={companyOverviewData.glusr_data?.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-2 group">
                        {companyOverviewData.glusr_data?.url || '-'}
                        <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                      </a>
                    </div>

                    {/* Top Bar Summary Metrics */}
                    <div className="space-y-4">
                      <label className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
                        Performance Summary (7D / 1M / 3M)
                      </label>
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm min-h-[100px] flex flex-col">
                        {isSummaryLoading ? (
                          <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fetching Performance...</span>
                          </div>
                        ) : (
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-indigo-600 text-[11px] font-black text-white uppercase">
                              <tr>
                                <th className="px-5 py-3">Parameter</th>
                                <th className="px-5 py-3 text-center bg-indigo-700/30">7D</th>
                                <th className="px-5 py-3 text-center bg-indigo-700/50">1M</th>
                                <th className="px-5 py-3 text-center bg-indigo-700/70">3M</th>
                              </tr>
                            </thead>
                            <tbody className="text-xs font-bold text-slate-600 divide-y divide-slate-100">
                              {[
                                { label: 'Enquiries', keys: ['enq_lw', 'enq_lm', 'enq_lq'], color: 'bg-blue-50/30' },
                                { label: 'LMS Replies', keys: ['qry_reply_lw', 'qry_reply_lm', 'qry_reply_lq'], color: 'bg-emerald-50/30' },
                                { label: 'Calls%', keys: ['pns_lw', 'pns_lm', 'pns_lq'], color: 'bg-violet-50/30' },
                                { label: 'BL Purchase Frequency', keys: ['bl_lw', 'bl_lm', 'bl_lq'], color: 'bg-amber-50/30' },
                                { label: 'Call Backs', keys: ['c2c_cnt_lw', 'c2c_cnt_lm', 'c2c_cnt_lq'], color: 'bg-rose-50/30' },
                                { label: 'BL ACTIVE', keys: ['bl_cat_dau_1w', 'bl_cat_dau_1m', 'bl_cat_dau_1q'], color: 'bg-cyan-50/30' },
                                { label: 'Lead Manager', keys: ['lms_lw', 'lms_lm', 'lms_lq'], color: 'bg-indigo-50/30' },
                                { label: 'Product Added', keys: ['prd_add_lw', 'prd_add_lm', 'prd_add_lq'], color: 'bg-teal-50/30' },
                                { label: 'Product Deactivated', keys: ['prd_deac_lw', 'prd_deac_lm', 'prd_deac_lq'], color: 'bg-slate-50/30' },
                              ].map((row, idx) => (
                                <tr key={idx} className={`hover:bg-slate-50 transition-colors ${row.color}`}>
                                  <td className="px-5 py-3 text-slate-700 font-black">{row.label}</td>
                                  <td className="px-5 py-3 text-center text-slate-900 font-black">{topBarSummaryData?.[row.keys[0]] ?? '-'}</td>
                                  <td className="px-5 py-3 text-center text-slate-900 font-black">{topBarSummaryData?.[row.keys[1]] ?? '-'}</td>
                                  <td className="px-5 py-3 text-center text-slate-900 font-black">{topBarSummaryData?.[row.keys[2]] ?? '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    {/* Tickets Summary */}
                    <div className="space-y-4">
                      <label className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1 h-4 bg-rose-500 rounded-full"></span>
                        Tickets Summary
                      </label>
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm min-h-[100px] flex flex-col">
                        {isRedshiftLoading ? (
                          <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fetching Redshift (may take ~20s)...</span>
                          </div>
                        ) : (
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-800 text-[11px] font-black text-white uppercase">
                              <tr>
                                <th className="px-5 py-3">Metric Type</th>
                                <th className="px-5 py-3 text-center">Total Tickets</th>
                              </tr>
                            </thead>
                            <tbody className="text-xs font-bold text-slate-600 divide-y divide-slate-100">
                              <tr className="hover:bg-rose-50/30 transition-colors">
                                <td className="px-5 py-3 text-slate-700 font-black">IPR Complaints</td>
                                <td className="px-5 py-3 text-center font-black text-rose-600 text-sm">{redshiftOverviewData?.ipr_complaints ?? '-'}</td>
                              </tr>
                              <tr className="hover:bg-slate-50 transition-colors">
                                <td className="px-5 py-3 text-slate-700 font-black">HRS History</td>
                                <td className="px-5 py-3 text-center font-black text-slate-900 text-sm">{redshiftOverviewData?.hrs_history ?? '-'}</td>
                              </tr>
                              <tr className="hover:bg-slate-50 transition-colors">
                                <td className="px-5 py-3 text-slate-700 font-black">Activation History</td>
                                <td className="px-5 py-3 text-center font-black text-slate-900 text-sm">{redshiftOverviewData?.activation_history ?? '-'}</td>
                              </tr>
                              <tr className="hover:bg-rose-50/30 transition-colors">
                                <td className="px-5 py-3 text-slate-700 font-black">Social Media Escalations</td>
                                <td className="px-5 py-3 text-center font-black text-rose-600 text-sm">{redshiftOverviewData?.social_media_escalations ?? '-'}</td>
                               </tr>
                               <tr className="hover:bg-slate-50 transition-colors">
                                <td className="px-5 py-3 text-slate-700 font-black">NACH Bounce</td>
                                <td className="px-5 py-3 text-center font-black text-slate-900 text-sm">{redshiftOverviewData?.nach_bounce ?? '-'}</td>
                              </tr>
                              <tr className="hover:bg-slate-50 transition-colors">
                                <td className="px-5 py-3 text-slate-700 font-black">Self Service Tickets</td>
                                <td className="px-5 py-3 text-center font-black text-slate-900 text-sm">{redshiftOverviewData?.self_service_tickets ?? '-'}</td>
                              </tr>
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    {/* BS Tickets Summary */}
                    <div className="space-y-4">
                      <label className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1 h-4 bg-amber-500 rounded-full"></span>
                        BS Tickets Summary
                      </label>
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm min-h-[100px] flex flex-col">
                        {isRedshiftLoading ? (
                          <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fetching Redshift (may take ~20s)...</span>
                          </div>
                        ) : redshiftOverviewData?.bs_tickets_summary?.error ? (
                          <div className="flex flex-col items-center justify-center py-8 px-4 gap-2 bg-rose-50/50">
                            <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span className="text-[10px] font-black text-rose-600 uppercase text-center tracking-tight">Query Error: {redshiftOverviewData.bs_tickets_summary.error}</span>
                          </div>
                        ) : (
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-800 text-[11px] font-black text-white uppercase">
                              <tr>
                                <th className="px-5 py-3">Metric Type</th>
                                <th className="px-5 py-3 text-center">Lifetime</th>
                                <th className="px-5 py-3 text-center">Last 12 Months</th>
                                <th className="px-5 py-3 text-center">WIP</th>
                              </tr>
                            </thead>
                            <tbody className="text-xs font-bold text-slate-600 divide-y divide-slate-100">
                              <tr className="hover:bg-amber-50/30 transition-colors">
                                <td className="px-5 py-3 text-slate-700 font-black">BS Tickets</td>
                                <td className="px-5 py-3 text-center font-black text-slate-900 text-sm">{redshiftOverviewData?.bs_tickets_summary?.lifetime ?? '-'}</td>
                                <td className="px-5 py-3 text-center font-black text-slate-900 text-sm">{redshiftOverviewData?.bs_tickets_summary?.last_12_months ?? '-'}</td>
                                <td className="px-5 py-3 text-center font-black text-rose-600 text-sm">{redshiftOverviewData?.bs_tickets_summary?.wip ?? '-'}</td>
                              </tr>
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    {/* Online Presence & Ratings */}
                    <div className="space-y-4">
                      <label className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                        Online Presence & Ratings
                      </label>
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-blue-600 text-[11px] font-black text-white uppercase">
                            <tr>
                              <th className="px-5 py-3">Platform</th>
                              <th className="px-5 py-3 text-center">Rating</th>
                              <th className="px-5 py-3 text-center">Link</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs font-bold text-slate-600 divide-y divide-slate-100">
                            {isPresenceLoading ? (
                              <tr>
                                <td colSpan={3} className="px-5 py-8 text-center">
                                  <div className="flex flex-col items-center gap-2">
                                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Searching Platforms...</span>
                                  </div>
                                </td>
                              </tr>
                            ) : (onlinePresenceCache[selectedGlId || ''] || []).length > 0 ? (
                              (onlinePresenceCache[selectedGlId || ''] || []).map((item, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                  <td className="px-5 py-3 text-slate-700 font-black">{item.platform}</td>
                                  <td className="px-5 py-3 text-center font-black text-blue-600">{item.rating}</td>
                                  <td className="px-5 py-3 text-center">
                                    <a href={item.link} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 transition-colors">
                                      <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                    </a>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3} className="px-5 py-4 text-center text-slate-400 italic">No online presence found</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* MCAT Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
                          MCAT Categories
                        </label>
                        <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase shadow-sm">
                          {mcatData?.length || 0} Total
                        </span>
                      </div>
                      <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar shadow-sm">
                        {isMcatLoading ? (
                          <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fetching MCAT Data...</span>
                          </div>
                        ) : (
                          <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-indigo-600 text-[11px] font-black text-white uppercase z-10">
                              <tr>
                                <th className="px-5 py-3 w-16 text-center">#</th>
                                <th className="px-5 py-3">MCAT Name</th>
                              </tr>
                            </thead>
                            <tbody className="text-xs font-bold text-slate-600 divide-y divide-slate-100">
                              {mcatData && mcatData.length > 0 ? (
                                mcatData.map((name: string, idx: number) => (
                                  <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                                    <td className="px-5 py-3 text-center text-slate-400 font-mono">{String(idx + 1).padStart(2, '0')}</td>
                                    <td className="px-5 py-3 text-slate-900 font-bold">{name}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={2} className="px-5 py-8 text-center text-slate-400 italic">No MCAT data found</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    {/* Approved Products Table */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1 h-4 bg-emerald-500 rounded-full"></span>
                          Approved Products
                        </label>
                        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase shadow-sm">
                          {companyOverviewData.product_data?.approved_products?.count || 0} Total
                        </span>
                      </div>
                      <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[400px] overflow-y-auto custom-scrollbar shadow-sm">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 bg-emerald-600 text-[11px] font-black text-white uppercase z-10">
                            <tr>
                              <th className="px-5 py-3 w-16 text-center">#</th>
                              <th className="px-5 py-3">Product Name</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs font-bold text-slate-600 divide-y divide-slate-100">
                            {companyOverviewData.product_data?.approved_products?.names?.map((name: string, idx: number) => (
                              <tr key={idx} className="hover:bg-emerald-50/30 transition-colors">
                                <td className="px-5 py-3 text-center text-slate-400 font-mono">{String(idx + 1).padStart(2, '0')}</td>
                                <td className="px-5 py-3 text-slate-900 font-bold">{name}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                    <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <p className="text-[10px] font-black uppercase tracking-widest">No Intelligence Data Available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Token Analysis Modal */}
        <AnimatePresence>
          {isTokenAnalysisOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsTokenAnalysisOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-5xl h-[80vh] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="absolute top-6 right-6 z-10">
                  <button 
                    onClick={() => setIsTokenAnalysisOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <TokenAnalysis />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* History Modal */}
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
              <div className="bg-slate-900 p-8 text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl">
                    <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-widest">Analysis History</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Stored Intelligence Sessions</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={fetchHistory}
                    disabled={isHistoryLoading}
                    className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/50 hover:text-white"
                    title="Refresh History"
                  >
                    <svg className={`w-5 h-5 ${isHistoryLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                  </button>
                  <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              </div>

              <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Search by GLID or Product Name..."
                    value={historySearchTerm}
                    onChange={(e) => setHistorySearchTerm(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-sm font-bold text-slate-700"
                  />
                  <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
              </div>
              
              <div className="p-8 max-h-[50vh] overflow-y-auto custom-scrollbar">
                {isHistoryLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Accessing Vault...</span>
                  </div>
                ) : historySessions.length > 0 ? (
                  <div className="space-y-3">
                    {historySessions
                      .filter(session => {
                        if (!session) return false;
                        const searchTerm = historySearchTerm.toLowerCase();
                        const glId = String(session.gl_id || session.id || '').toLowerCase();
                        const productName = String(session.product_name || '').toLowerCase();
                        const id = String(session.id || '').toLowerCase();
                        return glId.includes(searchTerm) || productName.includes(searchTerm) || id.includes(searchTerm);
                      })
                      .map((session) => (
                      <div key={session.id} className="group flex items-center justify-between p-5 bg-slate-50 border border-slate-200 rounded-3xl hover:border-indigo-300 hover:bg-indigo-50/30 transition-all">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-slate-900">{session.product_name || 'Generic Analysis'}</span>
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[9px] font-black rounded-md uppercase">ID: {session.id}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500">
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                              {session.gl_id}
                            </span>
                            <span>•</span>
                            <span>{new Date(session.created_at).toLocaleString()}</span>
                            {session.saved_by && (
                              <>
                                <span>•</span>
                                <span className="text-indigo-500 font-black uppercase text-[8px]">{session.saved_by.split('@')[0].replace('.', ' ')}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => loadSession(session.id)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-100"
                          >
                            Load
                          </button>
                          <button 
                            onClick={() => deleteSession(session.id)}
                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                    <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                    <p className="text-xs font-black uppercase tracking-widest">No Saved Sessions Found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes slide-in-right {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          .animate-slide-in-right {
            animation: slide-in-right 0.3s ease-out;
          }
          .custom-scrollbar-dark::-webkit-scrollbar { width: 4px; height: 4px; }
          .custom-scrollbar-dark::-webkit-scrollbar-track { background: #020617; }
          .custom-scrollbar-dark::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
          
          .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; border: 2px solid #f8fafc; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        `}</style>
      </div>
    );
  };

  export default App;