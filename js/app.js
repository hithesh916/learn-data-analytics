/* ═══════════════════════════════════════════════════
   DataLytics — Main App Controller
   Wires all modules together, handles UI state
═══════════════════════════════════════════════════ */

// ── Global instances ─────────────────────────────────
const processor    = new DataProcessor();
const chartBuilder = new ChartBuilder();
const sqlEngine    = new SQLEngine();
const dashboard    = new Dashboard(chartBuilder);
window.dashboard   = dashboard; // for dashboard close buttons

// ── App State ─────────────────────────────────────────
const state = {
  filteredData:  [],
  activeSection: 'overview',
  activeFilters: {},
  tablePage:     1,
  tablePageSize: 25,
  tableSortCol:  null,
  tableSortDir:  'asc',
  tableSearch:   '',
  currentChartType: 'bar',
};

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  ChartBuilder.initDefaults();
  setupUploadZone();
  setupNavigation();
  setupTableControls();
  setupChartBuilder();
  setupSQLLab();
  setupExportButtons();
  setupThemeToggle();
});

// ═══════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════
function setupThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (!toggleBtn) return;
  
  const savedTheme = localStorage.getItem('datalytics-theme');
  
  // Default to dark mode (CMO Dashboard style) unless explicitly set to light
  if (savedTheme === 'light') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  
  updateThemeIcon();

  toggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.hasAttribute('data-theme');
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('datalytics-theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('datalytics-theme', 'dark');
    }
    updateThemeIcon();
  });
}

function updateThemeIcon() {
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (!toggleBtn) return;
  const isDark = document.documentElement.hasAttribute('data-theme');
  if (isDark) {
    toggleBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sun-icon"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
  } else {
    toggleBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="moon-icon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
  }
}

// ═══════════════════════════════════════════════════
// UPLOAD
// ═══════════════════════════════════════════════════
function setupUploadZone() {
  const dropZone  = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });
  document.getElementById('new-file-btn').addEventListener('click', resetApp);
}

async function handleFile(file) {
  const loading = document.getElementById('upload-loading');
  loading.classList.remove('hidden');

  try {
    await processor.parseFile(file);
    state.filteredData = [...processor.rawData];

    sqlEngine.loadData(processor.rawData, processor.columns);

    document.getElementById('upload-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-rows').textContent = `${processor.rawData.length.toLocaleString()} rows × ${processor.columns.length} cols`;

    buildSidebar();
    buildFilters();
    populateAxisSelects();
    renderSection('overview');
    showToast(`✓ Loaded ${processor.rawData.length.toLocaleString()} rows from "${file.name}"`, 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
    console.error(err);
  } finally {
    loading.classList.add('hidden');
  }
}

function resetApp() {
  chartBuilder.destroyAll();
  dashboard.clearAll();

  Object.assign(processor, new DataProcessor());
  Object.assign(state, { filteredData:[], activeSection:'overview', activeFilters:{}, tablePage:1, tableSearch:'', tableSortCol:null });

  document.getElementById('main-app').classList.add('hidden');
  document.getElementById('upload-screen').classList.remove('hidden');
  document.getElementById('file-input').value = '';
  document.getElementById('kpi-grid').innerHTML = '';
  document.getElementById('columns-list').innerHTML = '';
  document.getElementById('filter-container').innerHTML = '<p class="filter-hint">Load data to add filters</p>';
}

// ═══════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderSection(section);
    });
  });

  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  // Modal close on overlay click
  const visualModal = document.getElementById('visual-chooser-modal');
  if (visualModal) {
    visualModal.addEventListener('click', (e) => {
      if (e.target === visualModal) {
        visualModal.classList.remove('active');
      }
    });
  }
}

function renderSection(section) {
  state.activeSection = section;
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${section}`).classList.add('active');

  switch (section) {
    case 'overview':   renderOverview();   break;
    case 'data':       renderTable();      break;
    case 'charts':     /* on demand */     break;
    case 'dashboard':  /* auto-populated */break;
    case 'sql':        renderSQLSchema();  break;
    case 'profile':    renderProfile();    break;
  }
}

// ═══════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════
function buildSidebar() {
  const list = document.getElementById('columns-list');
  list.innerHTML = '';
  processor.columns.forEach(col => {
    const type = processor.columnTypes[col];
    const chip = document.createElement('div');
    chip.className = 'col-chip';
    chip.innerHTML = `<span class="col-type-badge col-type-${typeClass(type)}">${typeShort(type)}</span><span title="${col}">${col}</span>`;
    chip.addEventListener('click', () => {
      document.getElementById('x-axis-select').value = col;
      document.getElementById('y-axis-select').value = col;
    });
    list.appendChild(chip);
  });
}

function buildFilters() {
  const container = document.getElementById('filter-container');
  container.innerHTML = '';

  const catCols = processor.getCategoricalCols().slice(0, 4);
  if (!catCols.length) { container.innerHTML = '<p class="filter-hint">No categorical columns found</p>'; return; }

  catCols.forEach(col => {
    const vals = [...new Set(processor.rawData.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== ''))].sort();
    const wrap = document.createElement('div');
    wrap.className = 'filter-item';
    wrap.innerHTML = `<label>${col}</label>
      <select class="filter-select" data-col="${col}">
        <option value="__all__">All</option>
        ${vals.slice(0, 100).map(v => `<option value="${escAttr(v)}">${escHtml(String(v))}</option>`).join('')}
      </select>`;
    container.appendChild(wrap);

    wrap.querySelector('select').addEventListener('change', e => {
      state.activeFilters[col] = e.target.value;
      applyFiltersAndRefresh();
    });
  });
}

function applyFiltersAndRefresh() {
  state.filteredData = processor.applyFilters(state.activeFilters);
  state.tablePage = 1;
  renderSection(state.activeSection);
  document.getElementById('file-rows').textContent = `${state.filteredData.length.toLocaleString()} / ${processor.rawData.length.toLocaleString()} rows × ${processor.columns.length} cols`;
}

// ═══════════════════════════════════════════════════
// OVERVIEW
// ═══════════════════════════════════════════════════
function renderOverview() {
  document.getElementById('overview-subtitle').textContent =
    `${state.filteredData.length.toLocaleString()} rows · ${processor.columns.length} columns · ${processor.getNumericCols().length} numeric · ${processor.getCategoricalCols().length} categorical`;

  renderKPIs();
  chartBuilder.renderOverviewCharts(processor, state.filteredData);
  renderDataQuality();
}

function renderKPIs() {
  const grid   = document.getElementById('kpi-grid');
  const numCols = processor.getNumericCols().slice(0, 4);
  const colors  = ['c-cyan','c-coral','c-amber','c-mint','c-purple'];
  const icons   = ['#','Σ','μ','≡','↑'];
  const kpis    = [];

  kpis.push({ label: 'Total Rows',     value: state.filteredData.length.toLocaleString(), meta: `${processor.columns.length} columns`, icon: '⬛' });
  kpis.push({ label: 'Numeric Cols',   value: processor.getNumericCols().length, meta: `${processor.getCategoricalCols().length} categorical`, icon: '🔢' });

  numCols.forEach(col => {
    const vals = state.filteredData.map(r => Number(r[col])).filter(n => !isNaN(n));
    if (!vals.length) return;
    const sum = vals.reduce((a,b)=>a+b,0);
    kpis.push({ label: `Total ${col}`, value: DataProcessor.fmtNum(sum), meta: `Avg: ${DataProcessor.fmtNum(sum/vals.length)}`, icon: '📊' });
  });

  // Completeness
  let nulls = 0;
  processor.columns.forEach(col => { nulls += processor.columnStats[col]?.nullCount || 0; });
  const total = processor.rawData.length * processor.columns.length;
  const comp = total ? ((total - nulls) / total * 100).toFixed(1) : 100;
  kpis.push({ label: 'Completeness', value: `${comp}%`, meta: `${nulls.toLocaleString()} null values`, icon: '✅' });

  grid.innerHTML = kpis.slice(0, 8).map((k, i) => `
    <div class="kpi-card ${colors[i % colors.length]}">
      <div class="kpi-icon">${k.icon}</div>
      <div class="kpi-label">${escHtml(k.label)}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-meta">${k.meta}</div>
    </div>`).join('');
}

function renderDataQuality() {
  const bar = document.getElementById('data-quality-bar');
  const stats = processor.columns.map(col => {
    const s = processor.columnStats[col];
    return { col, comp: s ? s.completeness : 1 };
  });
  const avgComp = stats.reduce((a,b)=>a+b.comp,0) / stats.length;

  bar.innerHTML = `
    <div class="profile-section-title" style="margin-bottom:12px">Data Quality Overview</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
      ${stats.map(({col, comp}) => `
        <div style="display:flex;flex-direction:column;gap:4px">
          <div style="display:flex;justify-content:space-between;font-size:11px">
            <span style="color:var(--text2);font-family:'DM Mono',monospace">${escHtml(col)}</span>
            <span style="color:${comp > .9 ? 'var(--mint)' : comp > .7 ? 'var(--amber)' : 'var(--coral)'}">${(comp*100).toFixed(1)}%</span>
          </div>
          <div class="completeness-bar"><div class="completeness-fill" style="width:${(comp*100).toFixed(1)}%;background:${comp > .9 ? 'linear-gradient(90deg,var(--cyan),var(--mint))' : comp > .7 ? 'linear-gradient(90deg,var(--amber),#ff8c00)' : 'linear-gradient(90deg,var(--coral),#ff6b35)'}"></div></div>
        </div>`).join('')}
    </div>
    <div style="margin-top:14px;font-size:12px;color:var(--text2)">Overall completeness: <strong style="color:${avgComp>.9?'var(--mint)':avgComp>.7?'var(--amber)':'var(--coral)'}">${(avgComp*100).toFixed(1)}%</strong></div>
  `;
}

// ═══════════════════════════════════════════════════
// DATA TABLE
// ═══════════════════════════════════════════════════
function setupTableControls() {
  document.getElementById('table-search').addEventListener('input', e => {
    state.tableSearch = e.target.value.toLowerCase();
    state.tablePage = 1;
    renderTable();
  });
  document.getElementById('table-page-size').addEventListener('change', e => {
    state.tablePageSize = Number(e.target.value);
    state.tablePage = 1;
    renderTable();
  });
  document.getElementById('page-first').addEventListener('click', () => { state.tablePage = 1; renderTable(); });
  document.getElementById('page-last').addEventListener('click',  () => { state.tablePage = getMaxPage(); renderTable(); });
  document.getElementById('page-prev').addEventListener('click',  () => { if (state.tablePage > 1) { state.tablePage--; renderTable(); } });
  document.getElementById('page-next').addEventListener('click',  () => { if (state.tablePage < getMaxPage()) { state.tablePage++; renderTable(); } });
}

function getMaxPage() {
  return Math.max(1, Math.ceil(getFilteredTableData().length / state.tablePageSize));
}

function getFilteredTableData() {
  let data = [...state.filteredData];
  if (state.tableSearch) {
    data = data.filter(row => processor.columns.some(col => String(row[col] ?? '').toLowerCase().includes(state.tableSearch)));
  }
  if (state.tableSortCol) {
    const col = state.tableSortCol;
    const dir = state.tableSortDir === 'asc' ? 1 : -1;
    data.sort((a, b) => {
      const va = a[col], vb = b[col];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return (typeof va === 'number' && typeof vb === 'number') ? (va - vb) * dir : String(va).localeCompare(String(vb)) * dir;
    });
  }
  return data;
}

function renderTable() {
  const data    = getFilteredTableData();
  const maxPage = Math.max(1, Math.ceil(data.length / state.tablePageSize));
  state.tablePage = Math.min(state.tablePage, maxPage);
  const start   = (state.tablePage - 1) * state.tablePageSize;
  const page    = data.slice(start, start + state.tablePageSize);

  // Header
  const head = document.getElementById('table-head');
  head.innerHTML = `<tr>${processor.columns.map(col => {
    const sorted = state.tableSortCol === col ? ` sorted-${state.tableSortDir}` : '';
    return `<th class="${sorted}" data-col="${escAttr(col)}">${escHtml(col)}</th>`;
  }).join('')}</tr>`;

  head.querySelectorAll('th').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (state.tableSortCol === col) {
        state.tableSortDir = state.tableSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.tableSortCol = col;
        state.tableSortDir = 'asc';
      }
      renderTable();
    });
  });

  // Body
  const body = document.getElementById('table-body');
  body.innerHTML = page.map(row => `
    <tr>${processor.columns.map(col => {
      const v = row[col];
      const isNull = v === null || v === undefined || v === '';
      const isNum  = typeof v === 'number';
      const cls    = isNull ? 'null-cell' : isNum ? 'num-cell' : '';
      return `<td class="${cls}" title="${escAttr(String(v ?? ''))}">${isNull ? '<em>null</em>' : escHtml(String(v))}</td>`;
    }).join('')}</tr>`).join('');

  // Pagination
  document.getElementById('table-info').textContent =
    `Showing ${start+1}–${Math.min(start+state.tablePageSize, data.length)} of ${data.length.toLocaleString()} rows`;
  document.getElementById('page-indicator').textContent = `Page ${state.tablePage} / ${maxPage}`;
  document.getElementById('page-first').disabled = state.tablePage <= 1;
  document.getElementById('page-prev').disabled  = state.tablePage <= 1;
  document.getElementById('page-next').disabled  = state.tablePage >= maxPage;
  document.getElementById('page-last').disabled  = state.tablePage >= maxPage;
}

// ═══════════════════════════════════════════════════
// CHART BUILDER
// ═══════════════════════════════════════════════════
function populateAxisSelects() {
  const xSel  = document.getElementById('x-axis-select');
  const ySel  = document.getElementById('y-axis-select');
  const szSel = document.getElementById('size-col-select');

  const opts = processor.columns.map(c => `<option value="${escAttr(c)}">${escHtml(c)}</option>`).join('');
  xSel.innerHTML = opts;
  ySel.innerHTML = opts;
  szSel.innerHTML = `<option value="">— none —</option>` + opts;

  // Sensible defaults: categorical for X, numeric for Y
  const catCol = processor.getCategoricalCols()[0];
  const numCol = processor.getNumericCols()[0];
  if (catCol) xSel.value = catCol;
  if (numCol) ySel.value = numCol;
}

function setupChartBuilder() {
  // Chart type selection
  document.getElementById('chart-type-grid').addEventListener('click', e => {
    const btn = e.target.closest('.chart-type-btn');
    if (!btn) return;
    document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentChartType = btn.dataset.type;

    // Show/hide bubble size
    const showSize = state.currentChartType === 'bubble';
    document.getElementById('size-col-group').style.display = showSize ? 'flex' : 'none';
  });

  document.getElementById('render-chart-btn').addEventListener('click', renderMainChart);
  document.getElementById('add-to-dashboard').addEventListener('click', addChartToDashboard);
  document.getElementById('auto-dashboard-btn').addEventListener('click', () => {
    dashboard.autoGenerate(processor, state.filteredData);
    showToast('Dashboard auto-generated!', 'success');
  });
  document.getElementById('clear-dashboard-btn').addEventListener('click', () => {
    dashboard.clearAll();
    showToast('Dashboard cleared');
  });

  // Initially hide size col group
  document.getElementById('size-col-group').style.display = 'none';
}

function getChartConfig() {
  const plotlyTypes = ['treemap','heatmap','boxplot','funnel','waterfall','sunburst','gauge',
    'violin','sankey','bullet','candlestick','marimekko','paretoChart','dumbbell','stripPlot'];
  const type  = state.currentChartType;
  const xCol  = document.getElementById('x-axis-select').value;
  const yCol  = document.getElementById('y-axis-select').value;
  const sizeCol = document.getElementById('size-col-select').value || null;
  const aggregation = document.getElementById('aggregation-select').value;
  const colorScheme = document.getElementById('color-scheme-select').value;
  const title = document.getElementById('chart-title-input').value;
  const limit = Number(document.getElementById('limit-select').value);
  return { type, xCol, yCol, sizeCol, aggregation, colorScheme, title, limit, data: state.filteredData, processor };
}

function renderMainChart() {
  if (!processor.columns.length) { showToast('Load a data file first', 'error'); return; }

  const config  = getChartConfig();
  const plotlyTypes = ['treemap','heatmap','boxplot','funnel','waterfall','sunburst','gauge',
    'violin','sankey','bullet','candlestick','marimekko','paretoChart','dumbbell','stripPlot'];
  const isPlotly = plotlyTypes.includes(config.type);

  const placeholder = document.getElementById('chart-placeholder');
  const canvasWrap  = document.getElementById('main-chart-container');
  const plotlyWrap  = document.getElementById('plotly-chart-container');

  placeholder.classList.add('hidden');

  if (isPlotly) {
    canvasWrap.classList.add('hidden');
    plotlyWrap.classList.remove('hidden');
    chartBuilder.destroyChart('main-chart');
    chartBuilder.renderPlotly({ ...config, plotlyContainerId: 'plotly-chart-container' });
  } else {
    plotlyWrap.classList.add('hidden');
    canvasWrap.classList.remove('hidden');
    chartBuilder.renderChartJS({ ...config, canvasId: 'main-chart' });
  }

  // Stats row (only for numeric Y cols)
  const statsRow = document.getElementById('chart-stats-row');
  if (processor.columnTypes[config.yCol] === 'number') {
    const stats = chartBuilder.chartStats(state.filteredData, config.yCol, processor);
    statsRow.innerHTML = stats.map(s => `
      <div class="stat-pill">
        <div class="stat-pill-label">${s.label}</div>
        <div class="stat-pill-value">${s.value}</div>
      </div>`).join('');
  } else {
    statsRow.innerHTML = '';
  }
}

function addChartToDashboard() {
  if (!processor.columns.length) { showToast('Load a data file first', 'error'); return; }
  const config = getChartConfig();
  dashboard.addPanel(config);
  showToast('Chart added to Dashboard! You can create another one.', 'success');
}

// ═══════════════════════════════════════════════════
// SQL LAB
// ═══════════════════════════════════════════════════
function setupSQLLab() {
  document.getElementById('run-sql-btn').addEventListener('click', runSQL);
  document.getElementById('clear-sql-btn').addEventListener('click', () => {
    document.getElementById('sql-editor').value = '';
    document.getElementById('sql-results').innerHTML = '<p class="sql-hint">Run a query to see results here.</p>';
    document.getElementById('results-count').textContent = '';
    document.getElementById('export-sql-results').classList.add('hidden');
  });
  document.getElementById('format-sql-btn').addEventListener('click', () => {
    const editor = document.getElementById('sql-editor');
    editor.value = sqlEngine.format(editor.value);
  });

  // AI Chat Assistant Logic
  const aiChatInput = document.getElementById('ai-chat-input');
  const aiChatSubmit = document.getElementById('ai-chat-submit');
  
  const handleAIChat = () => {
    const text = aiChatInput.value.trim().toLowerCase();
    if (!text) return;
    
    let newSql = null;
    if (text.startsWith('pull') || text.includes('show all') || text.includes('select all')) {
      newSql = 'SELECT * FROM data LIMIT 10;';
    } else if (text.startsWith('push') || text.startsWith('insert')) {
      const cols = processor.columns.slice(0, 3).map(c => `\`${c}\``).join(', ');
      newSql = `INSERT INTO data (${cols})\nVALUES ('val1', 'val2', 'val3');`;
    } else if (text.startsWith('delet') || text.startsWith('remove')) {
      newSql = `DELETE FROM data\nWHERE \`${processor.columns[0] || 'id'}\` = 'value';`;
    } else if (text.startsWith('update') || text.startsWith('modify')) {
      newSql = `UPDATE data\nSET \`${processor.columns[1] || 'col'}\` = 'new_value'\nWHERE \`${processor.columns[0] || 'id'}\` = 'value';`;
    } else if (text.startsWith('count')) {
      newSql = `SELECT COUNT(*) AS total FROM data;`;
    } else {
      newSql = `-- AI: Translating "${text}"\nSELECT * FROM data LIMIT 10;`;
    }
    
    const editor = document.getElementById('sql-editor');
    editor.value = newSql;
    aiChatInput.value = '';
    showToast('SQL generated from chat!', 'success');
  };

  if (aiChatSubmit && aiChatInput) {
    aiChatSubmit.addEventListener('click', handleAIChat);
    aiChatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleAIChat();
    });
  }

  // Natural Language SQL generation on Enter
  document.getElementById('sql-editor').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      const editor = e.target;
      const lines = editor.value.split('\n');
      const cursorLineIdx = editor.value.substr(0, editor.selectionStart).split('\n').length - 1;
      let line = lines[cursorLineIdx].trim();
      let isComment = line.startsWith('--') || line.startsWith('//');
      
      if (isComment) {
        let text = line.replace(/^(--|\/\/)\s*/i, '').toLowerCase();
        let newSql = null;

        if (text.startsWith('pull') || text.includes('show all')) {
          newSql = 'SELECT * FROM data LIMIT 10;';
        } else if (text.startsWith('push') || text.startsWith('insert')) {
          const cols = processor.columns.slice(0, 3).map(c => `\`${c}\``).join(', ');
          newSql = `INSERT INTO data (${cols}) VALUES ('val1', 'val2', 'val3');`;
        } else if (text.startsWith('delet') || text.startsWith('remove')) {
          newSql = `DELETE FROM data WHERE \`${processor.columns[0] || 'id'}\` = 'value';`;
        } else if (text.startsWith('update')) {
          newSql = `UPDATE data SET \`${processor.columns[1] || 'col'}\` = 'new_value' WHERE \`${processor.columns[0] || 'id'}\` = 'value';`;
        } else if (text.startsWith('count')) {
          newSql = `SELECT COUNT(*) AS total FROM data;`;
        }

        if (newSql) {
          lines[cursorLineIdx] = `-- ${text}\n${newSql}`;
          editor.value = lines.join('\n');
          const newPos = lines.slice(0, cursorLineIdx + 1).join('\n').length;
          editor.setSelectionRange(newPos, newPos);
          e.preventDefault();
          showToast('Code auto-generated!', 'success');
          return;
        }
      }
    }
    
    // Ctrl+Enter to run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runSQL();
  });

  document.getElementById('export-sql-results').addEventListener('click', exportSQLResults);
}

let lastSQLResults = null;

function renderSQLSchema() {
  const tree = document.getElementById('schema-tree');
  if (!processor.columns.length) { tree.innerHTML = '<p style="color:var(--text3);font-size:12px">Load data to see schema</p>'; return; }

  tree.innerHTML = `
    <div class="schema-table-name">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.2"/></svg>
      data
    </div>
    ${processor.columns.map(col => `
      <div class="schema-col" onclick="insertCol('${escAttr(col)}')">
        <span class="col-type-badge col-type-${typeClass(processor.columnTypes[col])}">${typeShort(processor.columnTypes[col])}</span>
        <span>${escHtml(col)}</span>
      </div>`).join('')}
  `;

  // Snippets
  const snippets = sqlEngine.generateSnippets(processor.columns, processor.columnTypes);
  document.getElementById('snippet-list').innerHTML = snippets.map(s =>
    `<button class="snippet-btn" onclick="loadSnippet(${JSON.stringify(s.sql)})">${escHtml(s.label)}</button>`
  ).join('');
}

window.insertCol = (col) => {
  const editor = document.getElementById('sql-editor');
  const val = editor.value;
  const pos = editor.selectionStart;
  editor.value = val.slice(0, pos) + `\`${col}\`` + val.slice(pos);
  editor.focus();
};

window.loadSnippet = (sql) => {
  document.getElementById('sql-editor').value = sql;
};

function runSQL() {
  const sql = document.getElementById('sql-editor').value.trim();
  if (!sql) return;

  const resultsDiv = document.getElementById('sql-results');

  try {
    const result = sqlEngine.query(sql);
    lastSQLResults = result;

    document.getElementById('results-count').textContent =
      `${result.rowCount.toLocaleString()} rows · ${result.elapsed}ms`;

    if (result.rows.length === 0) {
      resultsDiv.innerHTML = '<p class="sql-hint">Query returned 0 rows.</p>';
      document.getElementById('export-sql-results').classList.add('hidden');
      return;
    }

    document.getElementById('export-sql-results').classList.remove('hidden');

    const colHtml  = result.columns.map(c => `<th>${escHtml(c)}</th>`).join('');
    const rowsHtml = result.rows.slice(0, 1000).map(row =>
      `<tr>${result.columns.map(c => {
        const v = row[c];
        const isNum = typeof v === 'number';
        return `<td class="${isNum?'num-cell':''}">${escHtml(String(v ?? ''))}</td>`;
      }).join('')}</tr>`
    ).join('');

    resultsDiv.innerHTML = `
      <table class="sql-result-table">
        <thead><tr>${colHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      ${result.rows.length > 1000 ? `<p style="color:var(--text3);font-size:12px;padding:8px 12px">Showing first 1000 of ${result.rows.length.toLocaleString()} rows</p>` : ''}
    `;
  } catch (err) {
    document.getElementById('results-count').textContent = '';
    resultsDiv.innerHTML = `<div class="sql-error">❌ ${escHtml(err.message)}</div>`;
    document.getElementById('export-sql-results').classList.add('hidden');
  }
}

function exportSQLResults() {
  if (!lastSQLResults || !lastSQLResults.rows.length) return;
  const csv = [lastSQLResults.columns.join(','), ...lastSQLResults.rows.map(row =>
    lastSQLResults.columns.map(c => JSON.stringify(row[c] ?? '')).join(',')
  )].join('\n');
  downloadText(csv, 'sql-results.csv', 'text/csv');
  showToast('SQL results exported!', 'success');
}

// ═══════════════════════════════════════════════════
// DATA PROFILE
// ═══════════════════════════════════════════════════
function renderProfile() {
  const content = document.getElementById('profile-content');
  if (!processor.columns.length) { content.innerHTML = '<p style="color:var(--text3)">Load data to see profile</p>'; return; }

  const corr = processor.correlationMatrix();

  content.innerHTML = `
    <div>
      <div class="profile-section-title">Column Profiles</div>
      <div class="profile-grid" id="profile-grid"></div>
    </div>
    ${corr ? `
    <div>
      <div class="profile-section-title">Correlation Matrix <span style="font-size:12px;color:var(--text3);font-weight:400">(Pearson)</span></div>
      <div class="correlation-card">${buildCorrTable(corr)}</div>
    </div>` : ''}
  `;

  const grid = document.getElementById('profile-grid');
  processor.columns.forEach(col => {
    const s    = processor.columnStats[col];
    const type = processor.columnTypes[col];
    if (!s) return;

    const card = document.createElement('div');
    card.className = 'profile-col-card';

    let statsHtml = '';
    let histHtml  = '';

    if (type === 'number') {
      statsHtml = `
        <div class="profile-stats">
          <div class="profile-stat"><span class="profile-stat-label">Count</span><span class="profile-stat-val highlight">${s.nonNull.toLocaleString()}</span></div>
          <div class="profile-stat"><span class="profile-stat-label">Nulls</span><span class="profile-stat-val">${s.nullCount}</span></div>
          <div class="profile-stat"><span class="profile-stat-label">Min</span><span class="profile-stat-val highlight">${DataProcessor.fmtNum(s.min)}</span></div>
          <div class="profile-stat"><span class="profile-stat-label">Max</span><span class="profile-stat-val highlight">${DataProcessor.fmtNum(s.max)}</span></div>
          <div class="profile-stat"><span class="profile-stat-label">Mean</span><span class="profile-stat-val highlight">${DataProcessor.fmtNum(s.mean)}</span></div>
          <div class="profile-stat"><span class="profile-stat-label">Median</span><span class="profile-stat-val">${DataProcessor.fmtNum(s.median)}</span></div>
          <div class="profile-stat"><span class="profile-stat-label">Std Dev</span><span class="profile-stat-val">${DataProcessor.fmtNum(s.stddev)}</span></div>
          <div class="profile-stat"><span class="profile-stat-label">Outliers</span><span class="profile-stat-val" style="color:${s.outliers>0?'var(--coral)':'var(--mint)'}">${s.outliers}</span></div>
        </div>`;
      if (s.histogram?.length) {
        const max = Math.max(...s.histogram);
        histHtml = `<div class="mini-hist">${s.histogram.map(v =>
          `<div class="mini-hist-bar" style="height:${max?((v/max)*100).toFixed(0):2}%" title="${v}"></div>`
        ).join('')}</div>`;
      }
    } else {
      statsHtml = `
        <div class="profile-stats">
          <div class="profile-stat"><span class="profile-stat-label">Count</span><span class="profile-stat-val highlight">${s.nonNull.toLocaleString()}</span></div>
          <div class="profile-stat"><span class="profile-stat-label">Unique</span><span class="profile-stat-val highlight">${s.unique.toLocaleString()}</span></div>
          <div class="profile-stat"><span class="profile-stat-label">Nulls</span><span class="profile-stat-val">${s.nullCount}</span></div>
          <div class="profile-stat"><span class="profile-stat-label">Mode</span><span class="profile-stat-val" style="max-width:100px;overflow:hidden;text-overflow:ellipsis" title="${escAttr(String(s.mode))}">${escHtml(String(s.mode ?? '—'))}</span></div>
        </div>
        ${s.topValues?.length ? `<div style="font-size:11px;color:var(--text3);margin-top:6px">Top values:</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
            ${s.topValues.slice(0,5).map(([v,c]) => `<span style="background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:2px 7px;font-size:11px;font-family:'DM Mono',monospace;color:var(--text2)" title="${c} occurrences">${escHtml(String(v))}</span>`).join('')}
          </div>` : ''}`;
    }

    card.innerHTML = `
      <div class="profile-col-name">
        <span class="col-type-badge col-type-${typeClass(type)}">${typeShort(type)}</span>
        ${escHtml(col)}
      </div>
      ${statsHtml}
      <div class="completeness-bar">
        <div class="completeness-fill" style="width:${(s.completeness*100).toFixed(1)}%"></div>
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:4px">${(s.completeness*100).toFixed(1)}% complete</div>
      ${histHtml}
    `;
    grid.appendChild(card);
  });
}

document.getElementById('regen-profile-btn').addEventListener('click', renderProfile);

function buildCorrTable(corr) {
  const { cols, matrix } = corr;
  const getColor = (v) => {
    const abs = Math.abs(v);
    if (abs > 0.8)  return v > 0 ? '#00cffd33' : '#ff3d7133';
    if (abs > 0.5)  return v > 0 ? '#00cffd1a' : '#ff3d711a';
    return 'transparent';
  };
  const hdr = `<th style="background:var(--surface)"></th>` + cols.map(c => `<th style="writing-mode:vertical-rl;text-orientation:mixed;padding:8px 4px;font-size:10px;max-width:60px;overflow:hidden;text-overflow:ellipsis" title="${escAttr(c)}">${escHtml(c)}</th>`).join('');
  const rows = cols.map(c1 =>
    `<tr><th style="text-align:left;font-size:10px;white-space:nowrap;padding:4px 8px;max-width:100px;overflow:hidden;text-overflow:ellipsis" title="${escAttr(c1)}">${escHtml(c1)}</th>` +
    cols.map(c2 => {
      const v = matrix[c1][c2];
      return `<td style="background:${getColor(v)};color:${v===1?'var(--cyan)':Math.abs(v)>.7?'var(--text)':'var(--text2)'};font-weight:${v===1?'700':'400'}">${v.toFixed(2)}</td>`;
    }).join('') + `</tr>`
  ).join('');
  return `<table class="corr-table"><thead><tr>${hdr}</tr></thead><tbody>${rows}</tbody></table>`;
}

// ═══════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════
function setupExportButtons() {
  document.getElementById('export-csv-btn').addEventListener('click', () => {
    if (!processor.columns.length) { showToast('Load data first', 'error'); return; }
    const csv = [processor.columns.join(','), ...state.filteredData.map(row =>
      processor.columns.map(c => JSON.stringify(row[c] ?? '')).join(',')
    )].join('\n');
    downloadText(csv, `${processor.fileName || 'data'}-export.csv`, 'text/csv');
    showToast('CSV exported!', 'success');
  });

  document.getElementById('export-json-btn').addEventListener('click', () => {
    if (!processor.columns.length) { showToast('Load data first', 'error'); return; }
    downloadText(JSON.stringify(state.filteredData, null, 2), `${processor.fileName || 'data'}-export.json`, 'application/json');
    showToast('JSON exported!', 'success');
  });

  document.getElementById('export-png-btn').addEventListener('click', async () => {
    if (typeof html2canvas === 'undefined') {
      showToast('Export tool loading, please wait...', 'error');
      return;
    }
    const section = document.querySelector('.content-section.active');
    if (!section || (section.id === 'section-overview' && !processor.columns.length)) {
      showToast('Nothing to export', 'error');
      return;
    }
    
    showToast('Generating PNG...', 'success');
    try {
      const canvas = await html2canvas(section, { 
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        scale: 2 // High-res export
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `datalytics-${state.activeSection}.png`;
      a.click();
      showToast('PNG exported!', 'success');
    } catch (e) {
      showToast('Failed to export PNG', 'error');
      console.error(e);
    }
  });
}

function downloadText(content, filename, mime) {
  const a   = document.createElement('a');
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════
function typeClass(t) { return { number:'num', string:'str', date:'date', boolean:'bool' }[t] || 'str'; }
function typeShort(t) { return { number:'NUM', string:'STR', date:'DATE', boolean:'BOOL', unknown:'?' }[t] || 'STR'; }

function escHtml(str) {
  const el = document.createElement('div');
  el.textContent = str;
  return el.innerHTML;
}

function escAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let toastTimer;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}
