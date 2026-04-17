// Constants
const API_BASE = 'http://localhost:5000/'; // Explicitly target local backend

// Global State
let state = {
    glId: '113816',
    productName: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    matchData: [],
    cslData: [],
    mcatData: {},
    mismatchResults: {}, // glId -> 'No Mismatch' | 'Mismatch' | 'Pending'
    isLoading: false,
};

// Selectors
const analyzeBtn = document.getElementById('analyzeBtn');
const glIdInput = document.getElementById('glId');
const productNameInput = document.getElementById('productName');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const welcomeState = document.getElementById('welcomeState');
const resultsArea = document.getElementById('resultsArea');
const summaryBar = document.getElementById('summaryBar');
const glidBody = document.getElementById('glidBody');
const cslBody = document.getElementById('cslBody');
const sessionHistory = document.getElementById('sessionHistory');

// Initialize Dates
startDateInput.value = state.startDate;
endDateInput.value = state.endDate;

// --- Event Handlers ---
analyzeBtn.addEventListener('click', handleAnalyze);

async function handleAnalyze() {
    state.glId = glIdInput.value;
    state.productName = productNameInput.value;
    state.startDate = startDateInput.value;
    state.endDate = endDateInput.value;

    if (!state.glId || !state.productName) {
        showError("Please enter both GL ID and Product Name.");
        return;
    }

    setLoading(true);
    try {
        // 1. Fetch data from backend (Simplified sequence)
        const [csl, match, summary] = await Promise.all([
            fetchAPI('csl/fetch', { glId: state.glId, startDate: state.startDate, endDate: state.endDate }),
            fetchAPI('match/search', { glId: state.glId, productName: state.productName }),
            fetchAPI('summary/get', { glId: state.glId })
        ]);

        state.cslData = csl || [];
        state.matchData = match.response?.contacts || [];
        
        // 2. Clear old mismatch results
        state.mismatchResults = {};
        
        // 3. UI Transition
        welcomeState.classList.add('hidden');
        resultsArea.classList.remove('hidden');
        
        updateSummaryBar(summary);
        renderCSLTable();
        renderGLIDTable();

        // 4. Identify involved GLIDs and run Mismatch Analysis
        const involved = await fetchAPI('ai/identify_glids', { 
            logs: state.cslData, 
            matchmaking: state.matchData, 
            productName: state.productName 
        });

        if (involved.involvedGLIDs) {
            state.involvedGLIDs = involved.involvedGLIDs;
            renderGLIDTable();
            runMismatchAnalysis(involved.involvedGLIDs);
        }

    } catch (e) {
        showError("Analysis failed: " + e.message);
    } finally {
        setLoading(false);
    }
}

async function runMismatchAnalysis(glids) {
    const BATCH_SIZE = 3;
    for (let i = 0; i < glids.length; i += BATCH_SIZE) {
        const batch = glids.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (item) => {
            const gid = item.glId;
            state.mismatchResults[gid] = 'Pending';
            renderGLIDTable();

            try {
                // Fetch MCATs if not in cache
                if (!state.mcatData[gid]) {
                    const mcatRes = await fetchAPI('overview/get', { glId: gid });
                    state.mcatData[gid] = mcatRes.data?.product_data?.approved_products?.names || [];
                }

                const result = await fetchAPI('ai/mismatch_check', {
                    productName: state.productName,
                    mcatCategories: state.mcatData[gid]
                });

                state.mismatchResults[gid] = result.result || 'Mismatch';
            } catch (e) {
                state.mismatchResults[gid] = 'Error';
            }
            renderGLIDTable();
        }));
    }
}

// --- UI Rendering ---

function renderGLIDTable() {
    const list = state.involvedGLIDs || [];
    glidBody.innerHTML = list.map(item => {
        const status = state.mismatchResults[item.glId] || 'Pending';
        const statusColor = status === 'No Mismatch' ? 'text-green-600 bg-green-50' : 
                          status === 'Mismatch' ? 'text-red-600 bg-red-50' : 'text-blue-600 bg-blue-50';
        
        return `
            <tr class="hover:bg-gray-50/80 transition-colors">
                <td class="p-4 align-top">
                    <div class="font-bold text-gray-900 mb-0.5">${item.companyName || 'Unknown Corp'}</div>
                    <div class="text-xs text-gray-400 font-medium">GLID: ${item.glId}</div>
                </td>
                <td class="p-4 align-top">
                    <div class="inline-flex items-center px-2 py-1 bg-gray-100/50 rounded text-xs font-semibold text-gray-600">
                        ${item.lastProduct || 'N/A'}
                    </div>
                </td>
                <td class="p-4 align-top text-right">
                    <div class="text-sm font-black text-gray-700">${item.confidenceScore || '0%'}</div>
                </td>
                <td class="p-4 align-top">
                    <div class="flex items-center gap-2">
                        <span class="px-3 py-1.5 rounded-full text-xs font-bold ${statusColor} border border-current opacity-20"></span>
                        <span class="font-bold text-xs ${statusColor.split(' ')[0]}">${status}</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderCSLTable() {
    cslBody.innerHTML = state.cslData.slice(0, 50).map(log => `
        <tr class="hover:bg-gray-50/80 transition-colors">
            <td class="p-4 text-xs font-medium text-gray-700">${formatDateTime(log.datevalue)}</td>
            <td class="p-4">
                <div class="max-w-xs truncate text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer" title="${log.referer}">
                    ${log.referer || 'Direct Access'}
                </div>
            </td>
            <td class="p-4 text-xs font-mono text-gray-400">${log.remote_ip || '---'}</td>
        </tr>
    `).join('');
}

function updateSummaryBar(data) {
    if (!data) return;
    summaryBar.innerHTML = `
        <div class="flex flex-col">
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Leads</span>
            <span class="text-lg font-black text-gray-800">${data.total_leads || 0}</span>
        </div>
        <div class="w-px h-8 bg-gray-200"></div>
        <div class="flex flex-col">
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Products</span>
            <span class="text-lg font-black text-gray-800">${data.active_products || 0}</span>
        </div>
        <div class="w-px h-8 bg-gray-200"></div>
        <div class="flex flex-col">
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">BuyLeads</span>
            <span class="text-lg font-black text-gray-800">${data.bl_lm || 0}</span>
        </div>
    `;
}

// --- Utils ---

async function fetchAPI(endpoint, payload, method = 'POST') {
    const config = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (method === 'POST') config.body = JSON.stringify(payload);
    
    const res = await fetch(API_BASE + endpoint, config);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

function setLoading(isLoading) {
    state.isLoading = isLoading;
    analyzeBtn.disabled = isLoading;
    if (isLoading) {
        analyzeBtn.innerHTML = '<div class="loader w-5 h-5 border-2 border-white rounded-full"></div> Analyzing...';
    } else {
        analyzeBtn.innerHTML = '<i data-lucide="zap" class="w-5 h-5"></i> Run AI Analysis';
        lucide.createIcons();
    }
}

function showError(msg) {
    const toast = document.getElementById('errorToast');
    const text = document.getElementById('errorText');
    text.innerText = msg;
    toast.classList.remove('translate-y-32');
    setTimeout(() => toast.classList.add('translate-y-32'), 3000);
}

function formatDateTime(ts) {
    if (!ts || ts.length < 14) return ts;
    // yyyymmddhhmmss -> dd-mm-yy hh:mm:ss
    return `${ts.substring(6,8)}-${ts.substring(4,6)}-${ts.substring(2,4)} ${ts.substring(8,10)}:${ts.substring(10,12)}:${ts.substring(12,14)}`;
}

// Load session history on startup
async function loadHistory() {
    try {
        const list = await fetchAPI('list_sessions', {}, 'GET');
        sessionHistory.innerHTML = list.slice(0, 10).map(s => `
            <div class="bg-gray-50 hover:bg-white hover:shadow-sm border border-transparent hover:border-blue-100 p-2 rounded-lg cursor-pointer transition-all">
                <div class="text-xs font-bold text-gray-700 truncate">${s.product_name}</div>
                <div class="text-[9px] text-gray-400 font-semibold">${s.gl_id} • ${new Date(s.created_at).toLocaleDateString()}</div>
            </div>
        `).join('');
    } catch (e) {
        console.error("History load error:", e);
    }
}

loadHistory();
