/* ═══════════════════════════════════════════════════
   DataLytics — Chart Builder
   Renders 15+ chart types via Chart.js & Plotly
═══════════════════════════════════════════════════ */

class ChartBuilder {
  constructor() {
    this.currentChart = null;
    this.currentType  = 'bar';
    this.chartInstances = {};
  }

  // ── Color Schemes ────────────────────────────────
  static SCHEMES = {
    default:    ['#d4af37', '#27ae60', '#8e44ad', '#c0392b', '#d35400', '#2c3e50', '#2ecc71', '#2980b9', '#f39c12', '#16a085'],
    vibrant:    ['#e63946','#f4a261','#2a9d8f','#e9c46a','#264653','#f77f00','#d62828','#023e8a','#9b5de5','#00b4d8'],
    pastel:     ['#ffb3ba','#ffdfba','#ffffba','#baffc9','#bae1ff','#e8baff','#ffc8dd','#d4edda','#cce5ff','#fff3cd'],
    'mono-cyan':['#001f3f','#003f7f','#0060bf','#0080ff','#40a0ff','#80c0ff','#a0d4ff','#c0e4ff','#dff0ff','#00cffd'],
    'mono-coral':['#7f0000','#bf0000','#ff0000','#ff3d3d','#ff7070','#ffa0a0','#ffc0c0','#ffe0e0','#ff3d71','#ff6b35'],
    diverging:  ['#d73027','#f46d43','#fdae61','#fee090','#ffffbf','#e0f3f8','#abd9e9','#74add1','#4575b4'],
  };

  getColors(scheme, n) {
    const palette = ChartBuilder.SCHEMES[scheme] || ChartBuilder.SCHEMES.default;
    const colors = [];
    for (let i = 0; i < n; i++) colors.push(palette[i % palette.length]);
    return colors;
  }

  // ── Global Chart.js defaults ─────────────────────
  static initDefaults() {
    Chart.defaults.color = 'var(--text2)';
    Chart.defaults.borderColor = 'var(--border)';
    Chart.defaults.font.family = "'DM Sans', system-ui, -apple-system, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.padding = 16;
    
    // Premium Tooltips - High contrast in all modes
    Chart.defaults.plugins.tooltip.backgroundColor = '#1a1f2e'; // Deep obsidian
    Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
    Chart.defaults.plugins.tooltip.bodyColor = '#cbd5e1';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.displayColors = false; // Cleaner look, avoids dark text on dark bg
    Chart.defaults.plugins.tooltip.titleFont = { size: 13, weight: '700' };
    Chart.defaults.plugins.tooltip.bodyFont = { size: 13 };
  }

  // ── Destroy existing chart ───────────────────────
  destroyChart(canvasId) {
    if (this.chartInstances[canvasId]) {
      this.chartInstances[canvasId].destroy();
      delete this.chartInstances[canvasId];
    }
  }

  destroyAll() {
    Object.keys(this.chartInstances).forEach(id => this.destroyChart(id));
  }

  // ── Main render entry point ──────────────────────
  render(config) {
    const { type, data, xCol, yCol, sizeCol, colorScheme, title, canvasId, plotlyContainerId, limit } = config;

    const plotlyTypes = ['treemap','heatmap','boxplot','funnel','waterfall','sunburst','gauge',
      'violin','sankey','bullet','candlestick','marimekko','paretoChart','dumbbell','stripPlot'];
    if (plotlyTypes.includes(type)) {
      return this.renderPlotly(config);
    }
    return this.renderChartJS(config);
  }

  // ── Chart.js rendering ───────────────────────────
  renderChartJS(config) {
    const { type, data, xCol, yCol, sizeCol, colorScheme, title, canvasId, aggregation, limit, processor } = config;

    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let chartConfig;

    switch (type) {
      case 'bar':           chartConfig = this._barConfig(data, xCol, yCol, colorScheme, title, aggregation, limit, processor, false); break;
      case 'horizontalBar': chartConfig = this._barConfig(data, xCol, yCol, colorScheme, title, aggregation, limit, processor, true);  break;
      case 'line':          chartConfig = this._lineConfig(data, xCol, yCol, colorScheme, title, aggregation, limit, processor);        break;
      case 'area':          chartConfig = this._areaConfig(data, xCol, yCol, colorScheme, title, aggregation, limit, processor);        break;
      case 'pie':           chartConfig = this._pieConfig(data, xCol, yCol, colorScheme, title, aggregation, limit, processor, false);  break;
      case 'doughnut':      chartConfig = this._pieConfig(data, xCol, yCol, colorScheme, title, aggregation, limit, processor, true);   break;
      case 'scatter':       chartConfig = this._scatterConfig(data, xCol, yCol, colorScheme, title, processor);                           break;
      case 'bubble':        chartConfig = this._bubbleConfig(data, xCol, yCol, sizeCol, colorScheme, title, processor);                    break;
      case 'radar':         chartConfig = this._radarConfig(data, xCol, yCol, colorScheme, title, aggregation, limit, processor);       break;
      case 'polarArea':     chartConfig = this._polarAreaConfig(data, xCol, yCol, colorScheme, title, aggregation, limit, processor);   break;
      case 'histogram':     chartConfig = this._histogramConfig(data, yCol, colorScheme, title, processor);                             break;
      case 'stackedBar':    chartConfig = this._stackedConfig(data, xCol, yCol, colorScheme, title, aggregation, limit, processor, true, false);  break;
      case 'stackedColumn': chartConfig = this._stackedConfig(data, xCol, yCol, colorScheme, title, aggregation, limit, processor, false, false); break;
      case 'percentBar':    chartConfig = this._stackedConfig(data, xCol, yCol, colorScheme, title, aggregation, limit, processor, true, true);   break;
      default:              chartConfig = this._barConfig(data, xCol, yCol, colorScheme, title, aggregation, limit, processor, false);
    }

    const chart = new Chart(ctx, chartConfig);
    this.chartInstances[canvasId] = chart;
    return chart;
  }

  // ── Prepare aggregated data ──────────────────────
  _prepData(data, xCol, yCol, aggregation, limit, processor) {
    let pts = processor.aggregate(data, xCol, yCol, aggregation || 'none');
    if (limit && limit > 0) pts = pts.slice(0, limit);
    return {
      labels: pts.map(p => String(p.x)),
      values: pts.map(p => p.y),
    };
  }

  // ── BAR ──────────────────────────────────────────
  _barConfig(data, xCol, yCol, scheme, title, agg, limit, proc, horizontal) {
    const { labels, values } = this._prepData(data, xCol, yCol, agg, limit, proc);
    const colors = this.getColors(scheme, labels.length);
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: yCol,
          data: values,
          backgroundColor: colors.map(c => c + 'cc'),
          borderColor: colors,
          borderWidth: 1.5,
          borderRadius: 4,
          borderSkipped: false,
        }]
      },
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: !!title, text: title, color: 'var(--text)', font: { size: 15, family: "'Syne', sans-serif", weight: '700' } }, legend: { display: false } },
        scales: {
          x: { grid: { color: 'var(--border)' }, ticks: { maxRotation: 45, color: 'var(--text2)' } },
          y: { grid: { color: 'var(--border)' }, beginAtZero: true, ticks: { color: 'var(--text2)' } }
        }
      }
    };
  }

  // ── LINE ─────────────────────────────────────────
  _lineConfig(data, xCol, yCol, scheme, title, agg, limit, proc) {
    const { labels, values } = this._prepData(data, xCol, yCol, agg, limit, proc);
    const color = this.getColors(scheme, 1)[0];
    return {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: yCol,
          data: values,
          borderColor: color,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointBackgroundColor: color,
          pointRadius: labels.length > 60 ? 0 : 4,
          pointHoverRadius: 6,
          tension: 0.3,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: !!title, text: title, color: 'var(--text)', font: { size: 15, family: "'Syne', sans-serif", weight: '700' } } },
        scales: {
          x: { grid: { color: 'var(--border)' }, ticks: { maxRotation: 45, color: 'var(--text2)' } },
          y: { grid: { color: 'var(--border)' }, beginAtZero: false, ticks: { color: 'var(--text2)' } }
        }
      }
    };
  }

  // ── AREA ─────────────────────────────────────────
  _areaConfig(data, xCol, yCol, scheme, title, agg, limit, proc) {
    const cfg = this._lineConfig(data, xCol, yCol, scheme, title, agg, limit, proc);
    const color = this.getColors(scheme, 1)[0];
    cfg.data.datasets[0].fill = true;
    cfg.data.datasets[0].backgroundColor = color + '2a';
    return cfg;
  }

  // ── PIE / DONUT ───────────────────────────────────
  _pieConfig(data, xCol, yCol, scheme, title, agg, limit, proc, isDoughnut) {
    const { labels, values } = this._prepData(data, xCol, yCol, agg, limit, proc);
    const colors = this.getColors(scheme, labels.length);
    return {
      type: isDoughnut ? 'doughnut' : 'pie',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors.map(c => c + 'cc'),
          borderColor: colors,
          borderWidth: 1.5,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          title: { display: !!title, text: title, color: 'var(--text)', font: { size: 15, family: "'Syne', sans-serif", weight: '700' } },
          legend: { position: 'right', labels: { color: 'var(--text2)' } },
        },
        cutout: isDoughnut ? '60%' : '0%',
      }
    };
  }

  // ── SCATTER ──────────────────────────────────────
  _scatterConfig(data, xCol, yCol, scheme, title, processor) {
    const color = this.getColors(scheme, 1)[0];
    // Use numeric cols if xCol/yCol aren't numeric
    const numCols = processor ? processor.getNumericCols() : [];
    const cx = numCols.includes(xCol) ? xCol : (numCols[0] || xCol);
    const cy = numCols.includes(yCol) ? yCol : (numCols[1] || numCols[0] || yCol);
    const pts = data.map(r => ({ x: Number(r[cx]), y: Number(r[cy]) })).filter(p => !isNaN(p.x) && !isNaN(p.y));
    return {
      type: 'scatter',
      data: { datasets: [{ label: `${cx} vs ${cy}`, data: pts, backgroundColor: color + '99', borderColor: color, pointRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: !!title, text: title, color: 'var(--text)', font: { size: 15, family: "'Syne', sans-serif", weight: '700' } } },
        scales: { x: { grid: { color: 'var(--border)' }, title: { display: true, text: cx, color: 'var(--text2)' }, ticks: { color: 'var(--text2)' } }, y: { grid: { color: 'var(--border)' }, title: { display: true, text: cy, color: 'var(--text2)' }, ticks: { color: 'var(--text2)' } } }
      }
    };
  }

  // ── BUBBLE ───────────────────────────────────────
  _bubbleConfig(data, xCol, yCol, sizeCol, scheme, title, processor) {
    const numCols = processor ? processor.getNumericCols() : [];
    const cx = numCols.includes(xCol) ? xCol : (numCols[0] || xCol);
    const cy = numCols.includes(yCol) ? yCol : (numCols[1] || numCols[0] || yCol);
    const cs = sizeCol && numCols.includes(sizeCol) ? sizeCol : (numCols[2] || numCols[0] || cy);
    const colors = this.getColors(scheme, data.length);
    const raw = data.map(r => ({ x: Number(r[cx]), y: Number(r[cy]), r: Math.max(3, Math.sqrt(Math.abs(Number(r[cs]) || 5))) }))
                    .filter(p => !isNaN(p.x) && !isNaN(p.y));
    const maxR = Math.max(...raw.map(p => p.r), 1);
    raw.forEach(p => { p.r = Math.min(30, (p.r / maxR) * 24 + 4); });
    return {
      type: 'bubble',
      data: { datasets: [{ label: `${cx} / ${cy}`, data: raw, backgroundColor: colors.map(c => c + '88'), borderColor: colors }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: !!title, text: title, color: 'var(--text)', font: { size: 15, family: "'Syne', sans-serif", weight: '700' } } },
        scales: { x: { grid: { color: 'var(--border)' }, ticks: { color: 'var(--text2)' } }, y: { grid: { color: 'var(--border)' }, ticks: { color: 'var(--text2)' } } }
      }
    };
  }

  // ── RADAR ────────────────────────────────────────
  _radarConfig(data, xCol, yCol, scheme, title, agg, limit, proc) {
    const { labels, values } = this._prepData(data, xCol, yCol, agg, limit, proc);
    const color = this.getColors(scheme, 1)[0];
    return {
      type: 'radar',
      data: {
        labels,
        datasets: [{ label: yCol, data: values, backgroundColor: color + '33', borderColor: color, pointBackgroundColor: color, borderWidth: 2 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: !!title, text: title, color: 'var(--text)', font: { size: 15, family: "'Syne', sans-serif", weight: '700' } } },
        scales: { r: { grid: { color: 'var(--border)' }, ticks: { backdropColor: 'transparent', color: 'var(--text2)' }, pointLabels: { color: 'var(--text2)' }, angleLines: { color: 'var(--border)' } } }
      }
    };
  }

  // ── HISTOGRAM ────────────────────────────────────
  _histogramConfig(data, col, scheme, title, proc) {
    // Fall back to first numeric col if col isn't numeric
    const numCols = proc ? proc.getNumericCols() : [];
    const useCol = numCols.includes(col) ? col : (numCols[0] || col);
    const vals = data.map(r => Number(r[useCol])).filter(n => !isNaN(n));
    if (!vals.length) return this._barConfig([], useCol, useCol, scheme, title, 'count', 20, proc, false);
    const sorted = [...vals].sort((a,b)=>a-b);
    const bins = Math.min(20, Math.ceil(Math.sqrt(vals.length)));
    const min = sorted[0], max = sorted[sorted.length-1];
    const step = (max-min)/bins || 1;
    const counts = Array(bins).fill(0);
    const binLabels = [];
    for (let i = 0; i < bins; i++) binLabels.push(`${(min+i*step).toFixed(1)}-${(min+(i+1)*step).toFixed(1)}`);
    sorted.forEach(n => { const i = Math.min(Math.floor((n-min)/step), bins-1); counts[i]++; });
    const color = this.getColors(scheme, 1)[0];
    return {
      type: 'bar',
      data: { labels: binLabels, datasets: [{ label: 'Frequency', data: counts, backgroundColor: color+'cc', borderColor: color, borderWidth: 1, borderRadius: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: true, text: title || `Distribution — ${useCol}`, color: 'var(--text)', font: { size: 15, family: "'Syne', sans-serif", weight: '700' } }, legend: { display: false } },
        scales: { x: { grid: { color: 'var(--border)' }, categoryPercentage: 1, barPercentage: 1, ticks: { color: 'var(--text2)', maxRotation: 45 } }, y: { grid: { color: 'var(--border)' }, beginAtZero: true, title: { display: true, text: 'Count', color: 'var(--text2)' }, ticks: { color: 'var(--text2)' } } }
      }
    };
  }

  // ── POLAR AREA ───────────────────────────────────
  _polarAreaConfig(data, xCol, yCol, scheme, title, agg, limit, proc) {
    const { labels, values } = this._prepData(data, xCol, yCol, agg, limit, proc);
    const colors = this.getColors(scheme, labels.length);
    return {
      type: 'polarArea',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors.map(c => c + 'aa'), borderColor: colors, borderWidth: 1.5 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          title: { display: !!title, text: title, color: 'var(--text)', font: { size: 15, family: "'Syne', sans-serif", weight: '700' } },
          legend: { position: 'right', labels: { color: 'var(--text2)' } },
        },
        scales: { r: { grid: { color: 'var(--border)' }, ticks: { backdropColor: 'transparent', color: 'var(--text2)' } } }
      }
    };
  }

  // ── STACKED BAR / COLUMN / 100% ───────────────────
  _stackedConfig(data, xCol, yCol, scheme, title, agg, limit, proc, horizontal, percent) {
    const numCols = proc ? proc.getNumericCols().slice(0, 4) : [yCol];
    const { labels } = this._prepData(data, xCol, yCol, agg || 'sum', limit, proc);
    const colors = this.getColors(scheme, numCols.length);
    const rawDatasets = numCols.map((col, i) => {
      const agged = proc.aggregate(data, xCol, col, 'sum');
      const vals = labels.map(l => { const f = agged.find(d => String(d.x) === l); return f ? f.y : 0; });
      return { label: col, data: vals, backgroundColor: colors[i] + 'cc', borderColor: colors[i], borderWidth: 1, borderRadius: 3 };
    });
    // For 100% stacked — normalize each label's total to 100
    const datasets = percent ? rawDatasets.map(ds => ({
      ...ds,
      data: ds.data.map((v, li) => {
        const colTotal = rawDatasets.reduce((s, d) => s + (d.data[li] || 0), 0);
        return colTotal ? +(v / colTotal * 100).toFixed(1) : 0;
      })
    })) : rawDatasets;
    return {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: horizontal ? 'y' : 'x',
        plugins: { title: { display: !!title, text: title, color: 'var(--text)', font: { size: 15, family: "'Syne',sans-serif", weight: '700' } }, legend: { labels: { color: 'var(--text2)' } } },
        scales: {
          x: { stacked: true, grid: { color: 'var(--border)' }, ticks: { color: 'var(--text2)' }, max: percent ? 100 : undefined },
          y: { stacked: true, grid: { color: 'var(--border)' }, ticks: { color: 'var(--text2)', callback: percent ? v => v + '%' : undefined } }
        }
      }
    };
  }

  // ── PLOTLY rendering ─────────────────────────────
  renderPlotly(config) {
    const { type, data, xCol, yCol, colorScheme, title, plotlyContainerId, aggregation, limit, processor } = config;
    const container = document.getElementById(plotlyContainerId);
    if (!container) return;
    container.innerHTML = '';

    const getCssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#fff';
    
    const plotlyLayout = {
      paper_bgcolor: 'transparent',
      plot_bgcolor:  'transparent',
      font:   { family: "'DM Sans', sans-serif", color: getCssVar('--text2'), size: 12 },
      margin: { t: title ? 50 : 30, r: 20, b: 60, l: 60 },
      title:  title ? { text: title, font: { family: "'Syne', sans-serif", size: 16, color: getCssVar('--text') } } : undefined,
      xaxis:  { gridcolor: getCssVar('--border'), zerolinecolor: getCssVar('--border'), color: getCssVar('--text2') },
      yaxis:  { gridcolor: getCssVar('--border'), zerolinecolor: getCssVar('--border'), color: getCssVar('--text2') },
      hoverlabel: {
        bgcolor: '#1a1f2e',
        bordercolor: 'rgba(255,255,255,0.1)',
        font: { color: '#ffffff', family: "'DM Sans', sans-serif", size: 13 }
      }
    };

    const plotlyConfig = { responsive: true, displayModeBar: false };

    if (type === 'treemap') {
      const agg = processor.aggregate(data, xCol, yCol, aggregation || 'sum');
      const lim = limit > 0 ? agg.slice(0, limit) : agg;
      const trace = { type: 'treemap', labels: lim.map(d=>String(d.x)), parents: lim.map(()=>''), values: lim.map(d=>d.y),
        marker: { colorscale: 'Blues', showscale: false },
        textinfo: 'label+value',
        hovertemplate: '<b>%{label}</b><br>%{value}<extra></extra>'
      };
      Plotly.newPlot(container, [trace], { ...plotlyLayout, margin: { t: 30, r: 10, b: 10, l: 10 } }, plotlyConfig);

    } else if (type === 'heatmap') {
      const numCols = processor.getNumericCols().slice(0, 10);
      if (numCols.length < 2) { container.innerHTML = '<p style="color:#7a98c4;padding:20px">Need at least 2 numeric columns for heatmap</p>'; return; }
      const corr = processor.correlationMatrix();
      if (!corr) return;
      const { cols, matrix } = corr;
      const z = cols.map(c1 => cols.map(c2 => matrix[c1][c2]));
      const trace = {
        type: 'heatmap', z, x: cols, y: cols,
        colorscale: [['0','#ff3d71'],['0.5','#0d1526'],['1','#00cffd']],
        zmin: -1, zmax: 1,
        hovertemplate: 'Corr(%{x}, %{y}) = %{z:.3f}<extra></extra>'
      };
      Plotly.newPlot(container, [trace], plotlyLayout, plotlyConfig);

    } else if (type === 'boxplot') {
      const numCols = processor.getNumericCols().slice(0, 8);
      const colors = this.getColors(colorScheme, numCols.length);
      const traces = numCols.map((col, i) => ({
        type: 'box', name: col,
        y: data.map(r => Number(r[col])).filter(n => !isNaN(n)),
        marker: { color: colors[i] }, line: { color: colors[i] },
        boxmean: 'sd',
        hovertemplate: `<b>${col}</b><br>%{y}<extra></extra>`
      }));
      Plotly.newPlot(container, traces, plotlyLayout, plotlyConfig);

    } else if (type === 'funnel') {
      const agg = processor.aggregate(data, xCol, yCol, aggregation || 'sum');
      const lim = (limit > 0 ? agg.slice(0, limit) : agg).sort((a,b) => b.y - a.y);
      const colors = this.getColors(colorScheme, lim.length);
      const trace = { type: 'funnel', y: lim.map(d=>String(d.x)), x: lim.map(d=>d.y), marker: { color: colors }, textposition: 'inside', textinfo: 'value+percent initial' };
      Plotly.newPlot(container, [trace], plotlyLayout, plotlyConfig);

    } else if (type === 'waterfall') {
      const agg = processor.aggregate(data, xCol, yCol, aggregation || 'sum');
      const lim = limit > 0 ? agg.slice(0, limit) : agg;
      const measures = lim.map((_, i) => i === 0 ? 'absolute' : 'relative');
      const trace = {
        type: 'waterfall', measure: measures,
        x: lim.map(d=>String(d.x)), y: lim.map(d=>d.y),
        connector: { line: { color: '#2a3a5c' } },
        increasing: { marker: { color: '#00e096' } },
        decreasing: { marker: { color: '#ff3d71' } },
        totals:     { marker: { color: '#00cffd' } },
      };
      Plotly.newPlot(container, [trace], plotlyLayout, plotlyConfig);

    } else if (type === 'sunburst') {
      const agg = processor.aggregate(data, xCol, yCol, aggregation || 'sum');
      const lim = limit > 0 ? agg.slice(0, limit) : agg;
      const trace = { type: 'sunburst', labels: lim.map(d=>String(d.x)), parents: lim.map(()=>''), values: lim.map(d=>d.y),
        marker: { colorscale: 'Blues' },
        hovertemplate: '<b>%{label}</b><br>%{value}<extra></extra>'
      };
      Plotly.newPlot(container, [trace], { ...plotlyLayout, margin: { t: 30, r: 10, b: 10, l: 10 } }, plotlyConfig);

    } else if (type === 'gauge') {
      const numCols = processor.getNumericCols().slice(0, 1);
      const useCol = numCols[0] || yCol;
      const vals = data.map(r => Number(r[useCol])).filter(n => !isNaN(n));
      const val = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
      const maxVal = Math.max(...vals, val * 2, 1);
      const trace = { type: 'indicator', mode: 'gauge+number+delta',
        value: val,
        delta: { reference: val * 0.85, increasing: { color: '#00e096' }, decreasing: { color: '#ff3d71' } },
        title: { text: useCol, font: { color: getCssVar('--text'), size: 14 } },
        gauge: {
          axis: { range: [0, maxVal], tickcolor: getCssVar('--text2') },
          bar: { color: getCssVar('--cyan') },
          bgcolor: getCssVar('--surface'),
          bordercolor: getCssVar('--border'),
          steps: [
            { range: [0, maxVal*0.5], color: getCssVar('--surface') },
            { range: [maxVal*0.5, maxVal*0.75], color: getCssVar('--cyan-dim') }
          ],
          threshold: { line: { color: getCssVar('--amber'), width: 3 }, thickness: 0.75, value: val * 1.2 }
        }
      };
      Plotly.newPlot(container, [trace], { ...plotlyLayout, margin: { t: 60, r: 40, b: 40, l: 40 } }, plotlyConfig);

    } else if (type === 'dumbbell') {
      const numCols = processor.getNumericCols().slice(0, 2);
      if (numCols.length < 2) { container.innerHTML = '<p style="color:var(--text3);padding:20px">Need 2+ numeric columns for Dumbbell chart</p>'; return; }
      const catCol = processor.getCategoricalCols()[0];
      const cats = catCol ? [...new Set(data.slice(0,20).map(r => String(r[catCol])))] : data.slice(0,20).map((_,i)=>String(i));
      const colors = this.getColors(colorScheme, 2);
      const avgVal = (col, cat) => { const rows = catCol ? data.filter(r=>String(r[catCol])===cat) : [data[Number(cat)]||{}]; return rows.reduce((s,r)=>s+Number(r[col]),0)/(rows.length||1); };
      // Build connector lines between paired dots
      const connectors = cats.map(cat => ({
        type:'scatter', mode:'lines',
        x: [avgVal(numCols[0],cat), avgVal(numCols[1],cat)],
        y: [cat, cat],
        line: { color: getCssVar('--border2'), width: 2 },
        showlegend: false, hoverinfo: 'skip'
      }));
      const dots = [
        { x: cats.map(c=>avgVal(numCols[0],c)), y: cats, type:'scatter', mode:'markers', marker:{color:colors[0],size:14,line:{color:'#fff',width:1.5}}, name:numCols[0] },
        { x: cats.map(c=>avgVal(numCols[1],c)), y: cats, type:'scatter', mode:'markers', marker:{color:colors[1],size:14,line:{color:'#fff',width:1.5}}, name:numCols[1] }
      ];
      Plotly.newPlot(container, [...connectors, ...dots], plotlyLayout, plotlyConfig);

    } else if (type === 'stripPlot') {
      const numCol = processor.getNumericCols()[0];
      const catCol = processor.getCategoricalCols()[0];
      if (!numCol) { container.innerHTML = '<p style="color:var(--text3);padding:20px">Need a numeric column</p>'; return; }
      const cats = catCol ? [...new Set(data.map(r=>String(r[catCol])))] : ['All'];
      const colors = this.getColors(colorScheme, cats.length);
      const traces = cats.map((cat,i) => {
        const vals = (catCol ? data.filter(r=>String(r[catCol])===cat) : data).map(r=>Number(r[numCol])).filter(n=>!isNaN(n));
        return { x:vals.map(()=>cat), y:vals, type:'scatter', mode:'markers', marker:{color:colors[i],size:6,opacity:0.7}, name:cat };
      });
      Plotly.newPlot(container, traces, plotlyLayout, plotlyConfig);

    } else if (type === 'violin') {
      const numCols = processor.getNumericCols().slice(0, 5);
      const colors = this.getColors(colorScheme, numCols.length);
      const traces = numCols.map((col,i) => ({ type:'violin', y:data.map(r=>Number(r[col])).filter(n=>!isNaN(n)), name:col, box:{visible:true}, meanline:{visible:true}, fillcolor:colors[i]+'66', line:{color:colors[i]} }));
      Plotly.newPlot(container, traces, plotlyLayout, plotlyConfig);

    } else if (type === 'sankey') {
      const catCols = processor.getCategoricalCols().slice(0, 2);
      const numCol  = processor.getNumericCols()[0];
      if (catCols.length < 2 || !numCol) { container.innerHTML = '<p style="color:var(--text3);padding:20px">Sankey needs 2 categorical columns + 1 numeric</p>'; return; }
      const srcs = [...new Set(data.map(r=>String(r[catCols[0]])))];
      const tgts = [...new Set(data.map(r=>String(r[catCols[1]])))];
      const nodes = [...srcs, ...tgts];
      const ni = n => nodes.indexOf(n);
      const linkMap = {};
      data.slice(0,300).forEach(r => { const k=`${r[catCols[0]]}__${r[catCols[1]]}`; if(!linkMap[k]) linkMap[k]={s:ni(String(r[catCols[0]])),t:ni(String(r[catCols[1]])),v:0}; linkMap[k].v+=Number(r[numCol])||1; });
      const la = Object.values(linkMap);
      const trace = { type:'sankey', node:{pad:15,thickness:20,label:nodes,color:this.getColors(colorScheme,nodes.length)}, link:{source:la.map(l=>l.s),target:la.map(l=>l.t),value:la.map(l=>l.v)} };
      Plotly.newPlot(container, [trace], {...plotlyLayout,margin:{t:30,r:10,b:10,l:10}}, plotlyConfig);

    } else if (type === 'bullet') {
      const numCols = processor.getNumericCols().slice(0, 4);
      const colors = this.getColors(colorScheme, numCols.length);
      const traces = numCols.map((col,i) => {
        const vals = data.map(r=>Number(r[col])).filter(n=>!isNaN(n));
        const avg = vals.reduce((a,b)=>a+b,0)/(vals.length||1);
        const max = Math.max(...vals,1);
        return { type:'indicator', mode:'number+gauge+delta', value:avg, delta:{reference:avg*0.8}, gauge:{shape:'bullet',axis:{range:[0,max]},threshold:{line:{color:colors[i],width:3},thickness:0.75,value:avg*1.2},bgcolor:getCssVar('--surface'),bar:{color:colors[i]}}, domain:{x:[0,1],y:[i/numCols.length,(i+0.8)/numCols.length]}, title:{text:col} };
      });
      Plotly.newPlot(container, traces, {...plotlyLayout,margin:{t:30,r:30,b:10,l:120}}, plotlyConfig);

    } else if (type === 'candlestick') {
      const numCols = processor.getNumericCols().slice(0, 4);
      if (numCols.length < 2) { container.innerHTML = '<p style="color:var(--text3);padding:20px">Need at least 2 numeric columns for Candlestick</p>'; return; }
      const catCol = processor.getCategoricalCols()[0];
      const rows = data.slice(0, 100);
      const x     = rows.map((r,i) => catCol ? String(r[catCol]) : String(i+1));
      const open  = rows.map(r=>Number(r[numCols[0]])||0);
      const high  = rows.map(r=>Number(r[numCols[Math.min(1,numCols.length-1)]])||0);
      const low   = rows.map(r=>Number(r[numCols[Math.min(2,numCols.length-1)]])||0);
      const close = rows.map(r=>Number(r[numCols[Math.min(3,numCols.length-1)]])||0);
      const trace = { type:'candlestick', x, open, high, low, close, increasing:{line:{color:'#00e096'}}, decreasing:{line:{color:'#ff3d71'}} };
      Plotly.newPlot(container, [trace], plotlyLayout, plotlyConfig);

    } else if (type === 'marimekko') {
      const catCol = processor.getCategoricalCols()[0];
      const numCol = processor.getNumericCols()[0];
      if (!catCol || !numCol) { container.innerHTML = '<p style="color:var(--text3);padding:20px">Need 1 categorical + 1 numeric column</p>'; return; }
      const agg = processor.aggregate(data, catCol, numCol, 'sum').slice(0,10);
      const total = agg.reduce((s,d)=>s+d.y,0)||1;
      const colors = this.getColors(colorScheme, agg.length);
      let x0 = 0;
      const traces = agg.map((d,i) => { const w=d.y/total; const t={type:'bar',name:String(d.x),x:[x0+w/2],y:[d.y],width:[w*0.95],marker:{color:colors[i]},text:[String(d.x)],textposition:'inside',insidetextanchor:'middle'}; x0+=w; return t; });
      Plotly.newPlot(container, traces, {...plotlyLayout,barmode:'overlay',xaxis:{...plotlyLayout.xaxis,tickformat:'.0%',range:[0,1]}}, plotlyConfig);

    } else if (type === 'paretoChart') {
      const agg = processor.aggregate(data, xCol, yCol, aggregation||'sum').sort((a,b)=>b.y-a.y).slice(0,15);
      const total = agg.reduce((s,d)=>s+d.y,0)||1;
      let cum=0;
      const cumPct = agg.map(d=>{ cum+=d.y; return +(cum/total*100).toFixed(1); });
      const colors = this.getColors(colorScheme, agg.length);
      const bar  = {type:'bar', x:agg.map(d=>String(d.x)), y:agg.map(d=>d.y), marker:{color:colors}, name:yCol};
      const line = {type:'scatter', x:agg.map(d=>String(d.x)), y:cumPct, yaxis:'y2', mode:'lines+markers', line:{color:getCssVar('--amber'),width:2.5}, marker:{size:7}, name:'Cumulative %'};
      Plotly.newPlot(container, [bar,line], {...plotlyLayout, yaxis2:{overlaying:'y',side:'right',range:[0,110],ticksuffix:'%',gridcolor:'transparent',color:getCssVar('--text2')}}, plotlyConfig);
    }
  }

  // ── Quick overview charts ─────────────────────────
  renderOverviewCharts(processor, filteredData) {
    // Chart 1: Distribution of first categorical col
    const catCol = processor.getCategoricalCols()[0];
    const numCol = processor.getNumericCols()[0];

    const ctx1 = document.getElementById('ov-chart1');
    const ctx2 = document.getElementById('ov-chart2');

    if (ctx1 && catCol) {
      this.destroyChart('ov-chart1');
      const agg = processor.aggregate(filteredData, catCol, catCol, 'count').slice(0,12);
      const labels = agg.map(d => String(d.x));
      const values = agg.map(d => d.y);
      const colors = this.getColors('default', labels.length);
      const chart1 = new Chart(ctx1.getContext('2d'), {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: colors.map(c=>c+'bb'), borderColor: colors, borderWidth: 1.5, hoverOffset: 6 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { color: 'var(--text2)', font: { size: 11 }, padding: 10 } } },
          cutout: '55%'
        }
      });
      this.chartInstances['ov-chart1'] = chart1;
    }

    if (ctx2 && numCol) {
      this.destroyChart('ov-chart2');
      const vals = filteredData.map(r => Number(r[numCol])).filter(n => !isNaN(n)).sort((a,b)=>a-b);
      const bins = Math.min(15, Math.ceil(Math.sqrt(vals.length)));
      const min = vals[0], max = vals[vals.length-1];
      const step = (max-min)/bins || 1;
      const counts = Array(bins).fill(0);
      const binLabels = [];
      for (let i = 0; i < bins; i++) binLabels.push((min+i*step).toFixed(1));
      vals.forEach(n => { const i = Math.min(Math.floor((n-min)/step), bins-1); counts[i]++; });
      const chart2 = new Chart(ctx2.getContext('2d'), {
        type: 'bar',
        data: { labels: binLabels, datasets: [{ label: numCol, data: counts, backgroundColor: 'var(--cyan-dim)', borderColor: 'var(--cyan)', borderWidth: 1.5, borderRadius: 3, categoryPercentage: 0.95, barPercentage: 1 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { grid: { color: 'var(--border)' }, ticks: { maxRotation: 0, font: { size: 10 }, color: 'var(--text2)' } }, y: { grid: { color: 'var(--border)' }, beginAtZero: true, ticks: { color: 'var(--text2)' } } }
        }
      });
      this.chartInstances['ov-chart2'] = chart2;
    }
  }

  // ── Compute chart summary stats ───────────────────
  chartStats(data, yCol, processor) {
    const vals = data.map(r => Number(r[yCol])).filter(n => !isNaN(n));
    if (!vals.length) return [];
    const sorted = [...vals].sort((a,b)=>a-b);
    const sum = vals.reduce((a,b)=>a+b,0);
    const mean = sum/vals.length;
    const median = processor._median(sorted);
    const std = processor._stddev(vals, mean);
    return [
      { label: 'Count',   value: vals.length.toLocaleString() },
      { label: 'Sum',     value: DataProcessor.fmtNum(sum) },
      { label: 'Mean',    value: DataProcessor.fmtNum(mean) },
      { label: 'Median',  value: DataProcessor.fmtNum(median) },
      { label: 'Std Dev', value: DataProcessor.fmtNum(std) },
      { label: 'Min',     value: DataProcessor.fmtNum(sorted[0]) },
      { label: 'Max',     value: DataProcessor.fmtNum(sorted[sorted.length-1]) },
    ];
  }

  // ── Snapshot for dashboard ───────────────────────
  renderInContainer(config, canvasId, plotlyId) {
    const plotlyTypes = ['treemap', 'heatmap', 'boxplot', 'funnel', 'waterfall', 'sunburst', 'gauge'];
    if (plotlyTypes.includes(config.type)) {
      this.renderPlotly({ ...config, plotlyContainerId: plotlyId });
    } else {
      this.renderChartJS({ ...config, canvasId });
    }
  }
}
