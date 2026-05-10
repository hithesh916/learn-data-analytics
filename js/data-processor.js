/* ═══════════════════════════════════════════════════
   DataLytics — Data Processor
   Handles file parsing, type inference, statistics
═══════════════════════════════════════════════════ */

class DataProcessor {
  constructor() {
    this.rawData = [];
    this.columns = [];
    this.columnTypes = {};
    this.columnStats = {};
    this.fileName = '';
    this.sheetNames = [];
  }

  // ── Parse uploaded file ──────────────────────────
  async parseFile(file) {
    this.fileName = file.name;
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      return await this.parseCSV(file);
    } else if (['xlsx', 'xls'].includes(ext)) {
      return await this.parseExcel(file);
    } else {
      throw new Error('Unsupported file format. Please use .xlsx, .xls, or .csv');
    }
  }

  parseCSV(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          if (results.errors.length && !results.data.length) {
            reject(new Error('CSV parsing failed: ' + results.errors[0].message));
            return;
          }
          this.rawData = results.data;
          this.columns = results.meta.fields || [];
          this.inferTypes();
          this.computeStats();
          resolve({ data: this.rawData, columns: this.columns });
        },
        error: (err) => reject(err)
      });
    });
  }

  parseExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
          this.sheetNames = wb.SheetNames;
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false, dateNF: 'YYYY-MM-DD' });

          // Clean & coerce types
          if (json.length === 0) { reject(new Error('Sheet is empty')); return; }

          // Try to cast numeric-looking strings
          const columns = Object.keys(json[0]);
          const data = json.map(row => {
            const out = {};
            columns.forEach(col => {
              const v = row[col];
              if (v === null || v === undefined || v === '') { out[col] = null; }
              else if (!isNaN(v) && v !== '') { out[col] = Number(v); }
              else { out[col] = String(v).trim(); }
            });
            return out;
          });

          this.rawData = data;
          this.columns = columns;
          this.inferTypes();
          this.computeStats();
          resolve({ data: this.rawData, columns: this.columns });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsArrayBuffer(file);
    });
  }

  // ── Infer column types ───────────────────────────
  inferTypes() {
    this.columnTypes = {};
    this.columns.forEach(col => {
      const vals = this.rawData.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');
      if (vals.length === 0) { this.columnTypes[col] = 'unknown'; return; }

      const numericCount = vals.filter(v => typeof v === 'number' || !isNaN(Number(v))).length;
      const dateCount    = vals.filter(v => this._isDateStr(v)).length;
      const boolCount    = vals.filter(v => ['true','false','yes','no','1','0'].includes(String(v).toLowerCase())).length;

      const ratio = vals.length;
      if (numericCount / ratio > 0.8)    this.columnTypes[col] = 'number';
      else if (dateCount  / ratio > 0.7) this.columnTypes[col] = 'date';
      else if (boolCount  / ratio > 0.8) this.columnTypes[col] = 'boolean';
      else                               this.columnTypes[col] = 'string';
    });
  }

  _isDateStr(v) {
    if (typeof v !== 'string') return false;
    const d = new Date(v);
    return !isNaN(d) && v.length >= 8;
  }

  // ── Compute per-column statistics ───────────────
  computeStats() {
    this.columnStats = {};
    this.columns.forEach(col => {
      const allVals = this.rawData.map(r => r[col]);
      const nonNull  = allVals.filter(v => v !== null && v !== undefined && v !== '');
      const nullCnt  = allVals.length - nonNull.length;
      const unique   = [...new Set(nonNull)];

      const stat = {
        count:    this.rawData.length,
        nonNull:  nonNull.length,
        nullCount:nullCnt,
        unique:   unique.length,
        completeness: nonNull.length / this.rawData.length,
      };

      if (this.columnTypes[col] === 'number') {
        const nums = nonNull.map(Number).filter(n => !isNaN(n));
        nums.sort((a, b) => a - b);
        stat.min    = nums[0] ?? null;
        stat.max    = nums[nums.length - 1] ?? null;
        stat.sum    = nums.reduce((a, b) => a + b, 0);
        stat.mean   = stat.sum / nums.length;
        stat.median = this._median(nums);
        stat.stddev = this._stddev(nums, stat.mean);
        stat.q1     = nums[Math.floor(nums.length * .25)];
        stat.q3     = nums[Math.floor(nums.length * .75)];
        stat.iqr    = (stat.q3 ?? 0) - (stat.q1 ?? 0);
        stat.outliers = nums.filter(n => n < stat.q1 - 1.5 * stat.iqr || n > stat.q3 + 1.5 * stat.iqr).length;
        stat.histogram = this._histogram(nums, 10);
      } else {
        // Top 5 values
        const freq = {};
        nonNull.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
        stat.topValues = Object.entries(freq).sort((a,b) => b[1] - a[1]).slice(0, 5);
        stat.mode = stat.topValues[0]?.[0] ?? null;
      }

      this.columnStats[col] = stat;
    });
  }

  _median(sorted) {
    if (!sorted.length) return null;
    const m = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
  }

  _stddev(nums, mean) {
    if (nums.length < 2) return 0;
    const variance = nums.reduce((acc, n) => acc + (n - mean) ** 2, 0) / nums.length;
    return Math.sqrt(variance);
  }

  _histogram(nums, bins) {
    if (!nums.length) return [];
    const min = nums[0], max = nums[nums.length - 1];
    const step = (max - min) / bins || 1;
    const counts = Array(bins).fill(0);
    nums.forEach(n => {
      let i = Math.min(Math.floor((n - min) / step), bins - 1);
      counts[i]++;
    });
    return counts;
  }

  // ── Aggregation helpers ──────────────────────────
  aggregate(data, xCol, yCol, aggFunc) {
    if (aggFunc === 'none' || aggFunc === 'count') {
      if (aggFunc === 'count') {
        const groups = {};
        data.forEach(row => {
          const key = String(row[xCol] ?? 'null');
          groups[key] = (groups[key] || 0) + 1;
        });
        return Object.entries(groups).map(([k, v]) => ({ x: k, y: v }));
      }
      return data.map(row => ({ x: row[xCol], y: Number(row[yCol]) || 0 }));
    }

    const groups = {};
    data.forEach(row => {
      const key = String(row[xCol] ?? 'null');
      if (!groups[key]) groups[key] = [];
      const v = Number(row[yCol]);
      if (!isNaN(v)) groups[key].push(v);
    });

    return Object.entries(groups).map(([k, vals]) => {
      let y;
      switch (aggFunc) {
        case 'sum':    y = vals.reduce((a,b)=>a+b,0); break;
        case 'avg':    y = vals.reduce((a,b)=>a+b,0) / vals.length; break;
        case 'min':    y = Math.min(...vals); break;
        case 'max':    y = Math.max(...vals); break;
        case 'median': y = this._median([...vals].sort((a,b)=>a-b)); break;
        default:       y = vals.length;
      }
      return { x: k, y: parseFloat(y.toFixed(4)) };
    });
  }

  // ── Correlation matrix ───────────────────────────
  correlationMatrix() {
    const numCols = this.columns.filter(c => this.columnTypes[c] === 'number');
    if (numCols.length < 2) return null;

    const colData = {};
    numCols.forEach(col => {
      colData[col] = this.rawData.map(r => Number(r[col])).filter(n => !isNaN(n));
    });

    const matrix = {};
    numCols.forEach(c1 => {
      matrix[c1] = {};
      numCols.forEach(c2 => {
        matrix[c1][c2] = c1 === c2 ? 1 : this._pearson(colData[c1], colData[c2]);
      });
    });

    return { cols: numCols, matrix };
  }

  _pearson(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    const meanX = x.slice(0,n).reduce((a,b)=>a+b,0)/n;
    const meanY = y.slice(0,n).reduce((a,b)=>a+b,0)/n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
      num += (x[i]-meanX)*(y[i]-meanY);
      dx  += (x[i]-meanX)**2;
      dy  += (y[i]-meanY)**2;
    }
    return dx && dy ? parseFloat((num / Math.sqrt(dx*dy)).toFixed(3)) : 0;
  }

  // ── Filter data ──────────────────────────────────
  applyFilters(filters) {
    let data = [...this.rawData];
    Object.entries(filters).forEach(([col, val]) => {
      if (!val || val === '__all__') return;
      data = data.filter(row => String(row[col]) === val);
    });
    return data;
  }

  // ── Get numeric columns ──────────────────────────
  getNumericCols()    { return this.columns.filter(c => this.columnTypes[c] === 'number'); }
  getCategoricalCols(){ return this.columns.filter(c => this.columnTypes[c] === 'string' || this.columnTypes[c] === 'boolean'); }
  getDateCols()       { return this.columns.filter(c => this.columnTypes[c] === 'date'); }

  // ── Format numbers ───────────────────────────────
  static fmtNum(n, decimals = 2) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    if (Math.abs(n) >= 1e9)  return (n/1e9).toFixed(1) + 'B';
    if (Math.abs(n) >= 1e6)  return (n/1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3)  return (n/1e3).toFixed(1) + 'K';
    return Number(n).toFixed(decimals);
  }
}
