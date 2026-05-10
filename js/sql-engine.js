/* ═══════════════════════════════════════════════════
   DataLytics — SQL Engine
   Wraps AlaSQL for in-browser SQL on data
═══════════════════════════════════════════════════ */

class SQLEngine {
  constructor() {
    this.tableName = 'data';
    this.isReady   = false;
  }

  // ── Load data into AlaSQL ────────────────────────
  loadData(rows, columns) {
    try {
      // Drop if exists
      try { alasql(`DROP TABLE IF EXISTS ${this.tableName}`); } catch(e) {}

      // Create table with column definitions
      const colDefs = columns.map(c => `\`${c}\` STRING`).join(', ');
      alasql(`CREATE TABLE ${this.tableName} (${colDefs})`);

      // Insert all rows
      alasql.tables[this.tableName].data = rows.map(row => {
        const out = {};
        columns.forEach(col => { out[col] = row[col]; });
        return out;
      });

      this.columns = columns;
      this.rows    = rows;
      this.isReady = true;
      return true;
    } catch (err) {
      console.error('SQL load error:', err);
      return false;
    }
  }

  // ── Run a SQL query ──────────────────────────────
  query(sql) {
    if (!this.isReady) throw new Error('No data loaded. Please upload a file first.');
    if (!sql.trim())  throw new Error('Query is empty.');

    // Safety: block destructive statements
    const upper = sql.trim().toUpperCase();
    const blocked = ['DROP ', 'DELETE ', 'TRUNCATE ', 'ALTER ', 'CREATE '];
    for (const b of blocked) {
      if (upper.startsWith(b)) throw new Error(`Statement "${b.trim()}" is not allowed in read-only mode.`);
    }

    try {
      const start   = performance.now();
      const results = alasql(sql);
      const elapsed = (performance.now() - start).toFixed(1);

      if (!Array.isArray(results)) {
        return { rows: [], columns: [], elapsed, rowCount: 0 };
      }

      const columns = results.length > 0 ? Object.keys(results[0]) : [];
      return { rows: results, columns, elapsed, rowCount: results.length };
    } catch (err) {
      throw new Error(err.message || String(err));
    }
  }

  // ── Generate snippet queries ─────────────────────
  generateSnippets(columns, types) {
    const tbl = this.tableName;
    const numCols = columns.filter(c => types[c] === 'number');
    const strCols = columns.filter(c => types[c] === 'string');
    const col0 = columns[0] ? `\`${columns[0]}\`` : '*';
    const num0 = numCols[0] ? `\`${numCols[0]}\`` : col0;
    const str0 = strCols[0] ? `\`${strCols[0]}\`` : col0;

    const snippets = [
      { label: 'Preview all',      sql: `SELECT * FROM ${tbl} LIMIT 10` },
      { label: 'Count rows',       sql: `SELECT COUNT(*) AS total FROM ${tbl}` },
      { label: 'Column summary',   sql: `SELECT ${columns.slice(0,4).map(c=>`\`${c}\``).join(', ')} FROM ${tbl} LIMIT 20` },
    ];

    if (numCols.length > 0) {
      snippets.push({ label: 'Aggregate stats',  sql: `SELECT COUNT(*) AS count, AVG(${num0}) AS avg, MIN(${num0}) AS min, MAX(${num0}) AS max FROM ${tbl}` });
      snippets.push({ label: 'Top 10 by value',  sql: `SELECT * FROM ${tbl} ORDER BY ${num0} DESC LIMIT 10` });
    }

    if (strCols.length > 0 && numCols.length > 0) {
      snippets.push({ label: 'Group & aggregate', sql: `SELECT ${str0}, COUNT(*) AS count, AVG(${num0}) AS avg_val\nFROM ${tbl}\nGROUP BY ${str0}\nORDER BY count DESC\nLIMIT 15` });
    }

    if (numCols.length > 0) {
      snippets.push({ label: 'Filter rows',       sql: `SELECT * FROM ${tbl} WHERE ${num0} > 0 LIMIT 20` });
      snippets.push({ label: 'Null check',        sql: `SELECT COUNT(*) AS nulls FROM ${tbl} WHERE ${num0} IS NULL` });
    }

    if (strCols.length > 0) {
      snippets.push({ label: 'Distinct values',   sql: `SELECT DISTINCT ${str0} FROM ${tbl} LIMIT 20` });
      snippets.push({ label: 'Value frequency',   sql: `SELECT ${str0}, COUNT(*) AS freq FROM ${tbl} GROUP BY ${str0} ORDER BY freq DESC LIMIT 20` });
    }

    return snippets;
  }

  // ── Format SQL (basic) ───────────────────────────
  format(sql) {
    const keywords = ['SELECT','FROM','WHERE','GROUP BY','ORDER BY','HAVING','LIMIT','AND','OR','ON','JOIN','LEFT JOIN','INNER JOIN','AS','COUNT','SUM','AVG','MIN','MAX','DISTINCT','INSERT','UPDATE','SET'];
    let out = sql.replace(/\s+/g, ' ').trim();
    keywords.forEach(kw => {
      const re = new RegExp(`\\b${kw}\\b`, 'gi');
      out = out.replace(re, kw);
    });
    // Newlines before major clauses
    ['FROM','WHERE','GROUP BY','ORDER BY','HAVING','LIMIT','JOIN','LEFT JOIN','INNER JOIN'].forEach(kw => {
      out = out.replace(new RegExp(`\\b${kw}\\b`, 'g'), `\n${kw}`);
    });
    return out.replace(/,\s*/g, ',\n  ').replace(/^\n/, '').split('\n').map(l => l.trim()).join('\n');
  }
}
