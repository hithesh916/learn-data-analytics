/* ═══════════════════════════════════════════════════
   DataLytics — Dashboard Manager
   Manages multiple chart panels in a grid
═══════════════════════════════════════════════════ */

class Dashboard {
  constructor(chartBuilder) {
    this.panels     = [];
    this.panelCount = 0;
    this.chartBuilder = chartBuilder;
  }

  // ── Add a panel ──────────────────────────────────
  addPanel(config) {
    const id = ++this.panelCount;
    this.panels.push({ id, config: { ...config } });
    this._renderPanel(id, config);
    this._updateEmpty();
  }

  _renderPanel(id, config) {
    const grid = document.getElementById('dashboard-grid');
    const panel = document.createElement('div');
    panel.className = 'dashboard-panel';
    panel.id = `dash-panel-${id}`;
    panel.setAttribute('data-panel-id', id);

    const title = config.title || `${config.type} — ${config.xCol} / ${config.yCol}`;
    const plotlyTypes = ['treemap','heatmap','boxplot','funnel','waterfall','sunburst','gauge',
      'violin','sankey','bullet','candlestick','marimekko','paretoChart','dumbbell','stripPlot'];
    const isPlotly = plotlyTypes.includes(config.type);

    panel.innerHTML = `
      <div class="dashboard-panel-header">
        <span class="dashboard-panel-title">${this._escHtml(title)}</span>
        <button class="dashboard-panel-close" onclick="window.dashboard.removePanel(${id})" title="Remove">×</button>
      </div>
      <div class="dashboard-chart-wrap" id="dash-wrap-${id}">
        ${isPlotly
          ? `<div id="dash-plotly-${id}" style="width:100%;height:100%;min-width:0"></div>`
          : `<canvas id="dash-canvas-${id}" style="max-width:100%"></canvas>`
        }
      </div>
    `;

    grid.appendChild(panel);

    // Use two rAF + setTimeout to ensure layout is complete before measuring
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setTimeout(() => {
        const wrap = document.getElementById(`dash-wrap-${id}`);
        const w = wrap ? wrap.offsetWidth : 400;
        const h = wrap ? wrap.offsetHeight : 260;

        if (isPlotly) {
          this.chartBuilder.renderPlotly({ ...config, plotlyContainerId: `dash-plotly-${id}` });
          // Force relayout to correct size after Plotly renders
          setTimeout(() => {
            const el = document.getElementById(`dash-plotly-${id}`);
            if (el && typeof Plotly !== 'undefined') {
              Plotly.relayout(el, { width: w, height: h });
            }
          }, 120);
        } else {
          this.chartBuilder.renderChartJS({ ...config, canvasId: `dash-canvas-${id}` });
        }
      }, 30);
    }));
  }

  // ── Remove a panel ───────────────────────────────
  removePanel(id) {
    const canvasId = `dash-canvas-${id}`;
    this.chartBuilder.destroyChart(canvasId);
    const el = document.getElementById(`dash-panel-${id}`);
    if (el) el.remove();
    this.panels = this.panels.filter(p => p.id !== id);
    this._updateEmpty();
  }

  // ── Clear all panels ─────────────────────────────
  clearAll() {
    this.panels.forEach(p => {
      this.chartBuilder.destroyChart(`dash-canvas-${p.id}`);
    });
    document.getElementById('dashboard-grid').innerHTML = '';
    this.panels = [];
    this._updateEmpty();
  }

  // ── Auto-generate dashboard ──────────────────────
  autoGenerate(processor, filteredData) {
    this.clearAll();

    const numCols = processor.getNumericCols();
    const catCols = processor.getCategoricalCols();
    if (!numCols.length && !catCols.length) return;

    const scheme  = 'default';
    
    // Shuffle helper
    const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);
    
    const typesToPick = shuffle([
      ['bar', 'horizontalBar', 'funnel', 'waterfall'], // Cat + Num
      ['doughnut', 'pie', 'treemap'], // Cat
      ['line', 'area', 'radar'], // Cat + Num (trend/compare)
      ['scatter', 'bubble'], // Num + Num
      ['histogram', 'boxplot'], // Num Distribution
      ['heatmap'] // Num x Num
    ]);

    let generated = 0;
    
    for (const group of typesToPick) {
      if (generated >= 6) break;
      const type = shuffle(group)[0];
      
      const numCol = shuffle(numCols)[0] || numCols[0];
      const numCol2 = shuffle(numCols)[1] || numCols[1] || numCol;
      const catCol = shuffle(catCols)[0] || catCols[0];
      
      if (['bar', 'horizontalBar', 'funnel', 'waterfall', 'treemap'].includes(type) && catCol && numCol) {
        this.addPanel({ type, xCol: catCol, yCol: numCol, aggregation: 'sum', colorScheme: scheme, title: `${numCol} by ${catCol}`, data: filteredData, processor, limit: 15 });
        generated++;
      }
      else if (['doughnut', 'pie'].includes(type) && catCol) {
        this.addPanel({ type, xCol: catCol, yCol: catCol, aggregation: 'count', colorScheme: scheme, title: `${catCol} Distribution`, data: filteredData, processor, limit: 10 });
        generated++;
      }
      else if (['line', 'area', 'radar'].includes(type) && catCol && numCol) {
        this.addPanel({ type, xCol: catCol, yCol: numCol, aggregation: 'avg', colorScheme: 'default', title: `Avg ${numCol} Trend`, data: filteredData, processor, limit: 20 });
        generated++;
      }
      else if (['scatter', 'bubble'].includes(type) && numCols.length >= 2) {
        this.addPanel({ type, xCol: numCol, yCol: numCol2, sizeCol: numCol, colorScheme: scheme, title: `${numCol} vs ${numCol2}`, data: filteredData.slice(0, 500), processor, limit: 0 });
        generated++;
      }
      else if (['histogram'].includes(type) && numCol) {
        this.addPanel({ type, yCol: numCol, colorScheme: scheme, title: `${numCol} Distribution`, data: filteredData, processor, limit: 0 });
        generated++;
      }
      else if (['boxplot'].includes(type) && numCols.length >= 2) {
        this.addPanel({ type, xCol: numCol, yCol: numCol2, colorScheme: scheme, title: `Box Plot Distributions`, data: filteredData, processor, limit: 0 });
        generated++;
      }
      else if (['heatmap'].includes(type) && numCols.length >= 2) {
        this.addPanel({ type, colorScheme: scheme, title: `Correlation Heatmap`, data: filteredData, processor, limit: 0 });
        generated++;
      }
    }
    
    // Fallback if we didn't generate enough
    if (generated === 0 && numCols.length && catCols.length) {
      this.addPanel({ type: 'bar', xCol: catCols[0], yCol: numCols[0], aggregation: 'sum', colorScheme: scheme, title: `${numCols[0]} by ${catCols[0]}`, data: filteredData, processor, limit: 10 });
    }
  }

  _updateEmpty() {
    const empty = document.getElementById('dashboard-empty');
    const grid  = document.getElementById('dashboard-grid');
    if (this.panels.length === 0) {
      empty.style.display = 'flex';
      grid.style.display  = 'none';
    } else {
      empty.style.display = 'none';
      grid.style.display  = 'grid';
    }
  }

  _escHtml(str) {
    const el = document.createElement('div');
    el.textContent = str;
    return el.innerHTML;
  }
}
