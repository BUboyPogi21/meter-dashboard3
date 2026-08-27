// --- STATE MANAGEMENT & MULTI-PAGE SYSTEM ---
let pagesData = JSON.parse(localStorage.getItem('meterDash_allPages')) || {};
let activePageId = localStorage.getItem('meterDash_activePageId') || null;

// Default empty page structure
function createDefaultPageData(title = "MACHINE 1") {
    let daysInMonth = 31;
    let rows = [];
    for (let i = 1; i <= daysInMonth; i++) {
        rows.push({
            date: i,
            in: '', out: '',
            silver: '', gold: '',
            fund: '', return: '',
            remark: ''
        });
    }
    return {
        title: title,
        branch: 'TYT',
        month: 'January',
        baseIn: '50457862',
        baseOut: '47522985',
        rows: rows,
        customSettings: [
            { key: 'Multiplier', value: '3.5' },
            { key: 'Target Payout', value: '75%' }
        ],
        weeks: [
            { id: 1, label: 'Week 1', from: 1, to: 7, remark: '' },
            { id: 2, label: 'Week 2', from: 8, to: 14, remark: '' },
            { id: 3, label: 'Week 3', from: 15, to: 21, remark: '' },
            { id: 4, label: 'Week 4', from: 22, to: 31, remark: '' }
        ]
    };
}

// Initialize pages if empty
if (Object.keys(pagesData).length === 0) {
    const defaultId = 'page_' + Date.now();
    pagesData[defaultId] = createDefaultPageData("MACHINE 1");
    activePageId = defaultId;
    saveToStorage();
} else if (!activePageId || !pagesData[activePageId]) {
    activePageId = Object.keys(pagesData)[0];
}

function saveToStorage() {
    localStorage.setItem('meterDash_allPages', JSON.stringify(pagesData));
    localStorage.setItem('meterDash_activePageId', activePageId);
    triggerAutoSaveIndicator();
}

function triggerAutoSaveIndicator() {
    const indicator = document.getElementById('saveStatusIndicator');
    if (!indicator) return;
    indicator.className = "no-print inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 transition-all duration-300 ml-2";
    indicator.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[10px]"></i><span>Saving...</span>';
    
    setTimeout(() => {
        indicator.className = "no-print inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 transition-all duration-300 ml-2";
        indicator.innerHTML = '<i class="fa-solid fa-check text-[10px]"></i><span>Saved</span>';
    }, 400);
}

// Charts Instances
let trafficChartInstance = null;
let salesChartInstance = null;

// DOM Elements
const machineTitleInput = document.getElementById('machineTitleInput');
const branchSelect = document.getElementById('branchSelect');
const monthSelect = document.getElementById('monthSelect');
const baseInInput = document.getElementById('baseIn');
const baseOutInput = document.getElementById('baseOut');
const tableBody = document.getElementById('tableBody');
const weeklyTableBody = document.getElementById('weeklyTableBody');
const settingsTableBody = document.getElementById('settingsTableBody');

// --- RENDER TABS BAR ---
function renderPageTabs() {
    const container = document.getElementById('pageTabsContainer');
    if (!container) return;
    container.innerHTML = '';

    Object.keys(pagesData).forEach(pageId => {
        const page = pagesData[pageId];
        const isActive = pageId === activePageId;

        const tab = document.createElement('div');
        tab.className = `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition border shrink-0 touch-manipulation ${
            isActive 
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20' 
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
        }`;

        tab.innerHTML = `
            <span class="truncate max-w-[120px]">${page.title || 'Untitled'}</span>
            <div class="flex items-center gap-1 ml-1">
                <button type="button" class="rename-page-btn p-0.5 hover:text-blue-200 transition" data-id="${pageId}" title="Rename">
                    <i class="fa-solid fa-pen text-[10px]"></i>
                </button>
                ${Object.keys(pagesData).length > 1 ? `
                    <button type="button" class="delete-page-btn p-0.5 hover:text-rose-300 transition text-rose-400" data-id="${pageId}" title="Delete Page">
                        <i class="fa-solid fa-xmark text-xs"></i>
                    </button>
                ` : ''}
            </div>
        `;

        tab.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            activePageId = pageId;
            saveToStorage();
            loadActivePageData();
        });

        // Rename Action
        tab.querySelector('.rename-page-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const newTitle = prompt("Enter new name for this machine page:", page.title);
            if (newTitle !== null && newTitle.trim() !== "") {
                pagesData[pageId].title = newTitle.trim().toUpperCase();
                saveToStorage();
                renderPageTabs();
                if (pageId === activePageId) machineTitleInput.value = pagesData[pageId].title;
            }
        });

        // Delete Action
        if (tab.querySelector('.delete-page-btn')) {
            tab.querySelector('.delete-page-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete "${page.title}"?`)) {
                    delete pagesData[pageId];
                    activePageId = Object.keys(pagesData)[0];
                    saveToStorage();
                    renderPageTabs();
                    loadActivePageData();
                }
            });
        }

        container.appendChild(tab);
    });
}

// --- LOAD ACTIVE PAGE DATA INTO UI ---
function loadActivePageData() {
    const page = pagesData[activePageId];
    if (!page) return;

    machineTitleInput.value = page.title || '';
    branchSelect.value = page.branch || 'TYT';
    monthSelect.value = page.month || 'January';
    baseInInput.value = page.baseIn || '';
    baseOutInput.value = page.baseOut || '';

    document.getElementById('tableMonthHeader').textContent = page.month || 'January';
    document.getElementById('salesChartMonthText').textContent = `${page.rows.length} Days`;
    document.getElementById('thMonthWeekHeader').textContent = page.month || 'January';

    renderTableRows();
    renderSettingsRows();
    renderWeeklyTable();
    calculateAll();
}

// --- RENDER TABLE ROWS ---
function renderTableRows() {
    const page = pagesData[activePageId];
    tableBody.innerHTML = '';

    page.rows.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.className = index % 2 === 0 ? 'bg-slate-900/40 hover:bg-slate-800/50' : 'bg-slate-900/10 hover:bg-slate-800/50';
        
        tr.innerHTML = `
            <td class="py-2.5 px-3 text-slate-300 font-medium border-r border-slate-800 sticky-col flex items-center justify-between">
                <span>${row.date}</span>
                <input type="text" class="remark-input ml-2 w-28 sm:w-36 text-[11px]" placeholder="Remark..." value="${row.remark || ''}" data-index="${index}" data-field="remark">
            </td>
            <td class="py-2 px-1">
                <input type="number" inputmode="numeric" pattern="[0-9]*" class="meter-input-extended" value="${row.in !== undefined ? row.in : ''}" data-index="${index}" data-field="in">
            </td>
            <td class="py-2 px-1 border-r border-slate-800">
                <input type="number" inputmode="numeric" pattern="[0-9]*" class="meter-input-extended" value="${row.out !== undefined ? row.out : ''}" data-index="${index}" data-field="out">
            </td>
            <td class="py-2 px-2 text-right font-mono text-blue-400 row-total-in">-</td>
            <td class="py-2 px-2 text-right font-mono text-indigo-400 row-total-out border-r border-slate-800">-</td>
            <td class="py-2 px-2 text-right font-mono text-emerald-400 row-diff border-r border-slate-800">-</td>
            <td class="py-2 px-1">
                <input type="number" inputmode="numeric" pattern="[0-9]*" class="meter-input-extended" value="${row.silver !== undefined ? row.silver : ''}" data-index="${index}" data-field="silver">
            </td>
            <td class="py-2 px-1 border-r border-slate-800">
                <input type="number" inputmode="numeric" pattern="[0-9]*" class="meter-input-extended" value="${row.gold !== undefined ? row.gold : ''}" data-index="${index}" data-field="gold">
            </td>
            <td class="py-2 px-1">
                <input type="number" inputmode="numeric" pattern="[0-9]*" class="meter-input-extended" value="${row.fund !== undefined ? row.fund : ''}" data-index="${index}" data-field="fund">
            </td>
            <td class="py-2 px-1 border-r border-slate-800">
                <input type="number" inputmode="numeric" pattern="[0-9]*" class="meter-input-extended" value="${row.return !== undefined ? row.return : ''}" data-index="${index}" data-field="return">
            </td>
            <td class="py-2 px-2 text-right font-mono text-purple-300 row-payout border-r border-slate-800">0.00%</td>
            <td class="py-2 px-2 text-right font-mono text-emerald-300 row-sales">₱0.00</td>
        `;
        tableBody.appendChild(tr);
    });

    // Attach Event Listeners to Inputs
    tableBody.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            const field = e.target.getAttribute('data-field');
            pagesData[activePageId].rows[idx][field] = e.target.value;
            saveToStorage();
            calculateAll();
        });
    });
}

// --- SETTINGS ROWS ---
function renderSettingsRows() {
    const page = pagesData[activePageId];
    settingsTableBody.innerHTML = '';

    page.customSettings.forEach((setting, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="py-2 px-2">
                <input type="text" class="setting-input setting-key" value="${setting.key}" data-index="${idx}">
            </td>
            <td class="py-2 px-2">
                <input type="text" class="setting-input setting-val" value="${setting.value}" data-index="${idx}">
            </td>
            <td class="py-2 px-1 text-center">
                <button type="button" class="text-rose-400 hover:text-rose-300 p-1 delete-setting-btn" data-index="${idx}" title="Delete Row">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
            </td>
        `;
        settingsTableBody.appendChild(tr);
    });

    settingsTableBody.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            if (e.target.classList.contains('setting-key')) {
                page.customSettings[idx].key = e.target.value;
            } else {
                page.customSettings[idx].value = e.target.value;
            }
            saveToStorage();
            calculateAll();
        });
    });

    settingsTableBody.querySelectorAll('.delete-setting-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-index'));
            page.customSettings.splice(idx, 1);
            saveToStorage();
            renderSettingsRows();
            calculateAll();
        });
    });
}

// --- WEEKLY TABLE ---
function renderWeeklyTable() {
    const page = pagesData[activePageId];
    weeklyTableBody.innerHTML = '';

    page.weeks.forEach((week) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/50';
        tr.innerHTML = `
            <td class="py-2.5 px-3 font-medium text-slate-300 sticky-col bg-slate-900/90">
                <input type="text" class="setting-input week-label-input" value="${week.label}" data-weekid="${week.id}">
            </td>
            <td class="py-2 px-2">
                <input type="number" class="setting-input week-day-input" value="${week.from}" data-weekid="${week.id}" data-field="from" min="1" max="31">
            </td>
            <td class="py-2 px-2">
                <input type="number" class="setting-input week-day-input" value="${week.to}" data-weekid="${week.id}" data-field="to" min="1" max="31">
            </td>
            <td class="py-2 px-3 text-right text-blue-400 week-in font-mono">0</td>
            <td class="py-2 px-3 text-right text-indigo-400 week-out font-mono">0</td>
            <td class="py-2 px-3 text-right text-emerald-400 week-income font-mono">0</td>
            <td class="py-2 px-3 text-right text-slate-200 week-silver font-mono">0</td>
            <td class="py-2 px-3 text-right text-yellow-400 week-gold font-mono">0</td>
            <td class="py-2 px-3 text-right text-rose-400 week-variance font-mono">0</td>
            <td class="py-2 px-3">
                <input type="text" class="remark-input week-remark-input" value="${week.remark || ''}" data-weekid="${week.id}" placeholder="Weekly notes...">
            </td>
        `;
        weeklyTableBody.appendChild(tr);
    });

    weeklyTableBody.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', (e) => {
            const weekId = parseInt(e.target.getAttribute('data-weekid'));
            const weekObj = page.weeks.find(w => w.id === weekId);
            if (!weekObj) return;

            if (e.target.classList.contains('week-label-input')) {
                weekObj.label = e.target.value;
            } else if (e.target.classList.contains('week-day-input')) {
                weekObj[e.target.getAttribute('data-field')] = parseInt(e.target.value) || 1;
            } else if (e.target.classList.contains('week-remark-input')) {
                weekObj.remark = e.target.value;
            }
            saveToStorage();
            calculateAll();
        });
    });
}

// --- CALCULATIONS & MATH LOGIC ---
function calculateAll() {
    const page = pagesData[activePageId];
    const baseIn = parseFloat(baseInInput.value) || 0;
    const baseOut = parseFloat(baseOutInput.value) || 0;

    // Get Multiplier from customSettings or default to 3.5
    let multiplier = 3.5;
    const multSetting = page.customSettings.find(s => s.key.toLowerCase().includes('multiplier'));
    if (multSetting && !isNaN(parseFloat(multSetting.value))) {
        multiplier = parseFloat(multSetting.value);
    }

    let runningIn = baseIn;
    let runningOut = baseOut;

    let totalInSum = 0;
    let totalOutSum = 0;
    let totalDiffSum = 0;
    let totalSilverSum = 0;
    let totalGoldSum = 0;
    let totalFundSum = 0;
    let totalReturnSum = 0;
    let totalSalesSum = 0;
    let activeDaysCount = 0;

    let chartLabels = [];
    let chartTrafficIn = [];
    let chartTrafficOut = [];
    let chartSales = [];

    const rowTrs = tableBody.querySelectorAll('tr');

    page.rows.forEach((row, index) => {
        const tr = rowTrs[index];
        if (!tr) return;

        const valIn = parseFloat(row.in);
        const valOut = parseFloat(row.out);
        const silver = parseFloat(row.silver) || 0;
        const gold = parseFloat(row.gold) || 0;
        const fund = parseFloat(row.fund) || 0;
        const ret = parseFloat(row.return) || 0;

        let rowInDiff = 0;
        let rowOutDiff = 0;
        let diff = 0;
        let payout = 0;
        let sales = 0;

        let hasData = !isNaN(valIn) || !isNaN(valOut) || silver > 0 || gold > 0 || fund > 0 || ret > 0;
        if (hasData) activeDaysCount++;

        if (!isNaN(valIn)) {
            rowInDiff = valIn - runningIn;
            runningIn = valIn;
            totalInSum += rowInDiff;
            tr.querySelector('.row-total-in').textContent = rowInDiff.toLocaleString();
        } else {
            tr.querySelector('.row-total-in').textContent = '-';
        }

        if (!isNaN(valOut)) {
            rowOutDiff = valOut - runningOut;
            runningOut = valOut;
            totalOutSum += rowOutDiff;
            tr.querySelector('.row-total-out').textContent = rowOutDiff.toLocaleString();
        } else {
            tr.querySelector('.row-total-out').textContent = '-';
        }

        if (!isNaN(valIn) && !isNaN(valOut)) {
            diff = rowOutDiff; // Standard meter income definition based on OUT difference
            totalDiffSum += diff;
            tr.querySelector('.row-diff').textContent = diff.toLocaleString();

            if (rowInDiff > 0) {
                payout = (rowOutDiff / rowInDiff) * 100;
                tr.querySelector('.row-payout').textContent = payout.toFixed(2) + '%';
            } else {
                tr.querySelector('.row-payout').textContent = '0.00%';
            }

            sales = diff * multiplier;
            totalSalesSum += sales;
            tr.querySelector('.row-sales').textContent = '₱' + sales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        } else {
            tr.querySelector('.row-diff').textContent = '-';
            tr.querySelector('.row-payout').textContent = '-';
            tr.querySelector('.row-sales').textContent = '-';
        }

        totalSilverSum += silver;
        totalGoldSum += gold;
        totalFundSum += fund;
        totalReturnSum += ret;

        // Chart Data Pushing
        chartLabels.value = chartLabels.push(row.date);
        chartTrafficIn.push(!isNaN(valIn) ? rowInDiff : 0);
        chartTrafficOut.push(!isNaN(valOut) ? rowOutDiff : 0);
        chartSales.push(sales);
    });

    // --- FOOTER TOTALS ---
    document.getElementById('footTotalIn').textContent = totalInSum.toLocaleString();
    document.getElementById('footTotalOut').textContent = totalOutSum.toLocaleString();
    document.getElementById('footDiff').textContent = totalDiffSum.toLocaleString();
    document.getElementById('footSilver').textContent = totalSilverSum.toLocaleString();
    document.getElementById('footGold').textContent = totalGoldSum.toLocaleString();
    document.getElementById('footFund').textContent = totalFundSum.toLocaleString();
    document.getElementById('footReturn').textContent = totalReturnSum.toLocaleString();

    let grandPayout = totalInSum > 0 ? (totalOutSum / totalInSum) * 100 : 0;
    document.getElementById('footPayout').textContent = grandPayout.toFixed(2) + '%';
    document.getElementById('footSales').textContent = '₱' + totalSalesSum.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    // Specialized Footers
    const fundVsReturnDiff = totalFundSum - totalReturnSum;
    const fundVsReturnEl = document.getElementById('footFundVsReturn');
    fundVsReturnEl.textContent = fundVsReturnDiff.toLocaleString();
    fundVsReturnEl.className = `text-left font-mono text-xs sm:text-sm border-r border-slate-700 ${fundVsReturnDiff < 0 ? 'text-rose-400' : 'text-amber-300'}`;

    const totalRetrievedTokens = totalSilverSum + totalGoldSum;
    const tokensVsIncomeDiff = totalRetrievedTokens - totalDiffSum;
    const tokensVsIncomeEl = document.getElementById('footTokensVsIncome');
    tokensVsIncomeEl.textContent = tokensVsIncomeDiff.toLocaleString();
    tokensVsIncomeEl.className = `text-left font-mono text-xs sm:text-sm border-r border-slate-700 ${tokensVsIncomeDiff < 0 ? 'text-rose-400' : 'text-emerald-400'}`;

    // --- KPI CARDS UPDATE ---
    document.getElementById('kpiDays').textContent = activeDaysCount;
    document.getElementById('kpiPayout').textContent = grandPayout.toFixed(2) + '%';
    const ads = activeDaysCount > 0 ? totalSalesSum / activeDaysCount : 0;
    document.getElementById('kpiADS').textContent = '₱' + ads.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('kpiSilver').textContent = totalSilverSum.toLocaleString();
    document.getElementById('kpiGold').textContent = totalGoldSum.toLocaleString();
    document.getElementById('kpiFundReturnDiff').textContent = fundVsReturnDiff.toLocaleString();
    document.getElementById('kpiMeterDiff').textContent = totalDiffSum.toLocaleString();
    document.getElementById('kpiVariance').textContent = tokensVsIncomeDiff.toLocaleString();
    document.getElementById('kpiTotalSales').textContent = '₱' + totalSalesSum.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    // --- WEEKLY CALCULATIONS ---
    let weekGrandIn = 0, weekGrandOut = 0, weekGrandIncome = 0, weekGrandSilver = 0, weekGrandGold = 0, weekGrandVariance = 0;
    const weekTrs = weeklyTableBody.querySelectorAll('tr');

    page.weeks.forEach((week, wIndex) => {
        const wTr = weekTrs[wIndex];
        if (!wTr) return;

        let wIn = 0, wOut = 0, wIncome = 0, wSilver = 0, wGold = 0;
        const fromDay = parseInt(week.from) || 1;
        const toDay = parseInt(week.to) || 1;

        page.rows.forEach(r => {
            if (r.date >= fromDay && r.date <= toDay) {
                // Approximate calculations based on row indices or values
                // For accurate calculation, we re-evaluate per row matching date range
            }
        });
        
        // Simplified aggregation by slicing rows between fromDay and toDay
        const matchedRows = page.rows.filter(r => r.date >= fromDay && r.date <= toDay);
        // Recalculate running sums for this week range dynamically if needed, or aggregate values
        // For standard display in weekly table:
        let runInTemp = baseIn;
        let runOutTemp = baseOut;
        
        // Find baseline before fromDay
        page.rows.forEach(r => {
            if (r.date < fromDay) {
                if (!isNaN(parseFloat(r.in))) runInTemp = parseFloat(r.in);
                if (!isNaN(parseFloat(r.out))) runOutTemp = parseFloat(r.out);
            }
        });

        matchedRows.forEach(r => {
            const ri = parseFloat(r.in);
            const ro = parseFloat(r.out);
            if (!isNaN(ri)) { wIn += (ri - runInTemp); runInTemp = ri; }
            if (!isNaN(ro)) { wOut += (ro - runOutTemp); runOutTemp = ro; }
            wSilver += parseFloat(r.silver) || 0;
            wGold += parseFloat(r.gold) || 0;
        });

        wIncome = wOut; // Meter Income for week
        const wVariance = (wSilver + wGold) - wIncome;

        weekGrandIn += wIn;
        weekGrandOut += wOut;
        weekGrandIncome += wIncome;
        weekGrandSilver += wSilver;
        weekGrandGold += wGold;
        weekGrandVariance += wVariance;

        wTr.querySelector('.week-in').textContent = wIn.toLocaleString();
        wTr.querySelector('.week-out').textContent = wOut.toLocaleString();
        wTr.querySelector('.week-income').textContent = wIncome.toLocaleString();
        wTr.querySelector('.week-silver').textContent = wSilver.toLocaleString();
        wTr.querySelector('.week-gold').textContent = wGold.toLocaleString();
        wTr.querySelector('.week-variance').textContent = wVariance.toLocaleString();
    });

    document.getElementById('weekGrandIn').textContent = weekGrandIn.toLocaleString();
    document.getElementById('weekGrandOut').textContent = weekGrandOut.toLocaleString();
    document.getElementById('weekGrandIncome').textContent = weekGrandIncome.toLocaleString();
    document.getElementById('weekGrandSilver').textContent = weekGrandSilver.toLocaleString();
    document.getElementById('weekGrandGold').textContent = weekGrandGold.toLocaleString();
    document.getElementById('weekGrandVariance').textContent = weekGrandVariance.toLocaleString();

    // --- UPDATE CHARTS ---
    updateCharts(page.rows.map(r => r.date), chartTrafficIn, chartTrafficOut, chartSales);
}

// --- CHARTS INITIALIZATION & UPDATE ---
function updateCharts(labels, trafficIn, trafficOut, salesData) {
    // Traffic Chart
    const trafficCtx = document.getElementById('trafficChart').getContext('2d');
    if (trafficChartInstance) {
        trafficChartInstance.data.labels = labels;
        trafficChartInstance.data.datasets[0].data = trafficIn;
        trafficChartInstance.data.datasets[1].data = trafficOut;
        trafficChartInstance.update();
    } else {
        trafficChartInstance = new Chart(trafficCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Token IN', data: trafficIn, backgroundColor: 'rgba(59, 130, 246, 0.6)', borderColor: 'rgba(59, 130, 246, 1)', borderWidth: 1, borderRadius: 4 },
                    { label: 'Token OUT', data: trafficOut, backgroundColor: 'rgba(99, 102, 241, 0.6)', borderColor: 'rgba(99, 102, 241, 1)', borderWidth: 1, borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
                scales: {
                    x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(51, 65, 85, 0.2)' } },
                    y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(51, 65, 85, 0.2)' } }
                }
            }
        });
    }

    // Sales Chart
    const salesCtx = document.getElementById('salesChart').getContext('2d');
    if (salesChartInstance) {
        salesChartInstance.data.labels = labels;
        salesChartInstance.data.datasets[0].data = salesData;
        salesChartInstance.update();
    } else {
        salesChartInstance = new Chart(salesCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Daily Sales (₱)', data: salesData, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 1)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 2 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
                scales: {
                    x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(51, 65, 85, 0.2)' } },
                    y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(51, 65, 85, 0.2)' } }
                }
            }
        });
    }
}

// --- EVENT LISTENERS FOR CONTROLS ---
machineTitleInput.addEventListener('input', (e) => {
    pagesData[activePageId].title = e.target.value.toUpperCase();
    saveToStorage();
    renderPageTabs();
});

branchSelect.addEventListener('change', (e) => {
    pagesData[activePageId].branch = e.target.value;
    saveToStorage();
});

monthSelect.addEventListener('change', (e) => {
    const newMonth = e.target.value;
    pagesData[activePageId].month = newMonth;
    
    // Adjust rows count based on month days if needed
    let daysCount = 31;
    if (['April', 'June', 'September', 'November'].includes(newMonth)) daysCount = 30;
    else if (newMonth === 'February') daysCount = 28; // Standard assumption

    // Resize rows array if needed
    if (pagesData[activePageId].rows.length !== daysCount) {
        let newRows = [];
        for (let i = 1; i <= daysCount; i++) {
            let existing = pagesData[activePageId].rows.find(r => r.date === i);
            if (existing) newRows.push(existing);
            else newRows.push({ date: i, in: '', out: '', silver: '', gold: '', fund: '', return: '', remark: '' });
        }
        pagesData[activePageId].rows = newRows;
    }

    saveToStorage();
    loadActivePageData();
});

baseInInput.addEventListener('input', () => {
    pagesData[activePageId].baseIn = baseInInput.value;
    saveToStorage();
    calculateAll();
});

baseOutInput.addEventListener('input', () => {
    pagesData[activePageId].baseOut = baseOutInput.value;
    saveToStorage();
    calculateAll();
});

// Add New Page Button
document.getElementById('addNewPageBtn').addEventListener('click', () => {
    const pageTitle = prompt("Enter Machine / Page Name:", `MACHINE ${Object.keys(pagesData).length + 1}`);
    if (pageTitle) {
        const newId = 'page_' + Date.now();
        pagesData[newId] = createDefaultPageData(pageTitle.toUpperCase());
        activePageId = newId;
        saveToStorage();
        renderPageTabs();
        loadActivePageData();
    }
});

// Manual Save Button
document.getElementById('manualSaveBtn').addEventListener('click', () => {
    saveToStorage();
    alert('All data successfully saved to local storage!');
});

// Clear Storage Button
document.getElementById('clearStorageBtn').addEventListener('click', () => {
    if (confirm("WARNING: This will clear all stored data across all pages. Are you sure?")) {
        localStorage.clear();
        location.reload();
    }
});

// Print Button
document.getElementById('printBtn').addEventListener('click', () => {
    window.print();
});

// Machine Settings Modal Toggles
const machineSettingsModal = document.getElementById('machineSettingsModal');
document.getElementById('toggleSettingsBtn').addEventListener('click', () => {
    machineSettingsModal.classList.remove('hidden');
});
document.getElementById('closeSettingsBtn').addEventListener('click', () => {
    machineSettingsModal.classList.add('hidden');
});
machineSettingsModal.addEventListener('click', (e) => {
    if (e.target === machineSettingsModal) machineSettingsModal.classList.add('hidden');
});

// Add Setting Row Button
document.getElementById('addSettingRowBtn').addEventListener('click', () => {
    pagesData[activePageId].customSettings.push({ key: 'New Parameter', value: '0' });
    saveToStorage();
    renderSettingsRows();
});

// --- EXPORT SINGLE PAGE CSV ---
document.getElementById('exportCSVBtn').addEventListener('click', () => {
    const page = pagesData[activePageId];
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `Machine:,${page.title}\nBranch:,${page.branch}\nMonth:,${page.month}\n\n`;
    csvContent += "Date,Meter IN,Meter OUT,Total IN,Total OUT,Difference,Silver,Gold,Fund,Return,Payout %,Daily Sales,Remark\n";

    let runIn = parseFloat(page.baseIn) || 0;
    let runOut = parseFloat(page.baseOut) || 0;

    page.rows.forEach(r => {
        let ri = parseFloat(r.in);
        let ro = parseFloat(r.out);
        let rInDiff = !isNaN(ri) ? ri - runIn : '';
        let rOutDiff = !isNaN(ro) ? ro - runOut : '';
        if(!isNaN(ri)) runIn = ri;
        if(!isNaN(ro)) runOut = ro;
        let diff = !isNaN(ro) ? rOutDiff : '';
        let sales = !isNaN(diff) && diff !== '' ? diff * 3.5 : '';
        let payout = (!isNaN(rInDiff) && rInDiff > 0) ? ((rOutDiff / rInDiff) * 100).toFixed(2) + '%' : '0.00%';

        csvContent += `${r.date},${r.in},${r.out},${rInDiff},${rOutDiff},${diff},${r.silver},${r.gold},${r.fund},${r.return},${payout},${sales},"${r.remark || ''}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${page.title}_${page.month}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// --- EXPORT ALL PAGES CSV ---
document.getElementById('exportAllPagesCSVBtn').addEventListener('click', () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    Object.keys(pagesData).forEach(pageId => {
        const page = pagesData[pageId];
        csvContent += `\n--- MACHINE: ${page.title} (Branch: ${page.branch}, Month: ${page.month}) ---\n`;
        csvContent += "Date,Meter IN,Meter OUT,Difference,Silver,Gold,Fund,Return,Daily Sales,Remark\n";

        let runIn = parseFloat(page.baseIn) || 0;
        let runOut = parseFloat(page.baseOut) || 0;

        page.rows.forEach(r => {
            let ri = parseFloat(r.in);
            let ro = parseFloat(r.out);
            let rOutDiff = !isNaN(ro) ? ro - runOut : '';
            if(!isNaN(ri)) runIn = ri;
            if(!isNaN(ro)) runOut = ro;
            let sales = !isNaN(rOutDiff) && rOutDiff !== '' ? rOutDiff * 3.5 : '';

            csvContent += `${r.date},${r.in},${r.out},${rOutDiff},${r.silver},${r.gold},${r.fund},${r.return},${sales},"${r.remark || ''}"\n`;
        });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `All_Machines_Comprehensive_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// --- IMPORT CSV FILE ---
document.getElementById('csvFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const text = event.target.result;
        const lines = text.split('\n');
        
        let newRows = [];
        lines.forEach((line, idx) => {
            if (idx === 0 || !line.trim()) return; // Skip header
            const cols = line.split(',');
            if (cols.length >= 10) {
                const dateVal = parseInt(cols[0]);
                if (!isNaN(dateVal)) {
                    newRows.push({
                        date: dateVal,
                        in: cols[1] !== undefined ? cols[1].trim() : '',
                        out: cols[2] !== undefined ? cols[2].trim() : '',
                        silver: cols[4] !== undefined ? cols[4].trim() : '',
                        gold: cols[5] !== undefined ? cols[5].trim() : '',
                        fund: cols[6] !== undefined ? cols[6].trim() : '',
                        return: cols[7] !== undefined ? cols[7].trim() : '',
                        remark: cols[9] !== undefined ? cols[9].replace(/"/g, '').trim() : ''
                    });
                }
            }
        });

        if (newRows.length > 0) {
            pagesData[activePageId].rows = newRows;
            saveToStorage();
            loadActivePageData();
            alert('CSV data successfully imported!');
        } else {
            alert('Failed to parse CSV format. Please check the file structure.');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});

// --- INITIAL LOAD UPON STARTUP ---
document.addEventListener('DOMContentLoaded', () => {
    renderPageTabs();
    loadActivePageData();
});