/* ==========================================================================
   DataP · lectura de archivos .xlsx y .csv en el navegador
   Sin librerías externas: un .xlsx es un ZIP con XML dentro. Se lee el
   directorio central del ZIP, se descomprime con DecompressionStream
   ('deflate-raw') y se interpreta el XML con DOMParser.
   Nada se sube a ningún servidor: todo ocurre en el navegador.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     ZIP
     ------------------------------------------------------------------------ */
  function readZipEntries(buffer) {
    var view = new DataView(buffer);
    var len = buffer.byteLength;
    var eocd = -1;
    // El registro "End of Central Directory" está al final (máx. 64 KB de comentario).
    for (var i = len - 22; i >= Math.max(0, len - 22 - 65535); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('El archivo no parece un .xlsx válido.');

    var count = view.getUint16(eocd + 10, true);
    var offset = view.getUint32(eocd + 16, true);
    var decoder = new TextDecoder('utf-8');
    var entries = {};

    for (var e = 0; e < count; e++) {
      if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('Directorio ZIP dañado.');
      var method = view.getUint16(offset + 10, true);
      var compSize = view.getUint32(offset + 20, true);
      var nameLen = view.getUint16(offset + 28, true);
      var extraLen = view.getUint16(offset + 30, true);
      var commentLen = view.getUint16(offset + 32, true);
      var localOffset = view.getUint32(offset + 42, true);
      var name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLen));
      entries[name] = { method: method, compSize: compSize, localOffset: localOffset };
      offset += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Este navegador no puede leer .xlsx. Actualízalo o guarda el archivo como CSV.');
    }
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readZipText(buffer, entries, name) {
    var entry = entries[name];
    if (!entry) return null;
    var view = new DataView(buffer);
    var lo = entry.localOffset;
    if (view.getUint32(lo, true) !== 0x04034b50) throw new Error('Entrada ZIP dañada: ' + name);
    var nameLen = view.getUint16(lo + 26, true);
    var extraLen = view.getUint16(lo + 28, true);
    var start = lo + 30 + nameLen + extraLen;
    var raw = new Uint8Array(buffer, start, entry.compSize);
    var data;
    if (entry.method === 0) data = raw;
    else if (entry.method === 8) data = await inflateRaw(raw);
    else throw new Error('Compresión ZIP no soportada (método ' + entry.method + ').');
    return new TextDecoder('utf-8').decode(data);
  }

  /* ------------------------------------------------------------------------
     XLSX
     ------------------------------------------------------------------------ */
  function parseXml(text) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('XML inválido dentro del .xlsx.');
    return doc;
  }

  function byTag(node, tag) {
    return node.getElementsByTagNameNS('*', tag);
  }

  function childrenByTag(node, tag) {
    var out = [];
    for (var c = node.firstElementChild; c; c = c.nextElementSibling) {
      if (c.localName === tag) out.push(c);
    }
    return out;
  }

  /** Texto de un <si> o <is>: concatena los <t>, ignorando la guía fonética (<rPh>). */
  function richText(node) {
    var out = '';
    var ts = byTag(node, 't');
    for (var i = 0; i < ts.length; i++) {
      var parent = ts[i].parentNode;
      if (parent && parent.localName === 'rPh') continue;
      out += ts[i].textContent;
    }
    return out;
  }

  function colIndex(ref) {
    var m = /^([A-Z]+)/i.exec(ref || '');
    if (!m) return -1;
    var letters = m[1].toUpperCase();
    var n = 0;
    for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
    return n - 1;
  }

  function resolvePath(target) {
    if (!target) return null;
    if (target.charAt(0) === '/') return target.slice(1);
    var parts = ('xl/' + target).split('/');
    var out = [];
    parts.forEach(function (p) {
      if (p === '..') out.pop();
      else if (p && p !== '.') out.push(p);
    });
    return out.join('/');
  }

  function parseSheet(xml, shared) {
    var doc = parseXml(xml);
    var rows = [];
    var rowNodes = byTag(doc, 'row');
    var nextRow = 0;
    for (var r = 0; r < rowNodes.length; r++) {
      var rowEl = rowNodes[r];
      var rAttr = parseInt(rowEl.getAttribute('r'), 10);
      var rowIdx = isNaN(rAttr) ? nextRow : rAttr - 1;
      nextRow = rowIdx + 1;
      var row = [];
      var cells = childrenByTag(rowEl, 'c');
      var nextCol = 0;
      for (var c = 0; c < cells.length; c++) {
        var cell = cells[c];
        var ci = colIndex(cell.getAttribute('r'));
        if (ci < 0) ci = nextCol;
        nextCol = ci + 1;
        var type = cell.getAttribute('t');
        var vEl = childrenByTag(cell, 'v')[0];
        var raw = vEl ? vEl.textContent : '';
        var value;
        if (type === 's') value = shared[parseInt(raw, 10)] || '';
        else if (type === 'inlineStr') {
          var is = childrenByTag(cell, 'is')[0];
          value = is ? richText(is) : '';
        } else if (type === 'b') value = raw === '1';
        else if (type === 'str' || type === 'e') value = raw;
        else value = raw === '' ? '' : Number(raw);
        row[ci] = value;
      }
      rows[rowIdx] = row;
    }
    // Rellena huecos y recorta filas vacías del final.
    var width = 0;
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i]) rows[i] = [];
      width = Math.max(width, rows[i].length);
    }
    var matrix = rows.map(function (row) {
      var out = new Array(width);
      for (var j = 0; j < width; j++) out[j] = row[j] === undefined ? '' : row[j];
      return out;
    });
    while (matrix.length && matrix[matrix.length - 1].every(function (v) { return v === ''; })) matrix.pop();
    return matrix;
  }

  async function readXlsx(buffer) {
    var entries = readZipEntries(buffer);
    var workbookXml = await readZipText(buffer, entries, 'xl/workbook.xml');
    if (!workbookXml) throw new Error('No se encontró la hoja de cálculo dentro del archivo.');

    var relsXml = await readZipText(buffer, entries, 'xl/_rels/workbook.xml.rels');
    var rels = {};
    if (relsXml) {
      var relNodes = byTag(parseXml(relsXml), 'Relationship');
      for (var i = 0; i < relNodes.length; i++) {
        rels[relNodes[i].getAttribute('Id')] = relNodes[i].getAttribute('Target');
      }
    }

    var shared = [];
    var ssXml = await readZipText(buffer, entries, 'xl/sharedStrings.xml');
    if (ssXml) {
      var siNodes = byTag(parseXml(ssXml), 'si');
      for (var s = 0; s < siNodes.length; s++) shared.push(richText(siNodes[s]));
    }

    var wb = parseXml(workbookXml);
    var sheetNodes = byTag(wb, 'sheet');
    var sheets = [];
    for (var k = 0; k < sheetNodes.length; k++) {
      var node = sheetNodes[k];
      var rid = node.getAttribute('r:id') ||
        node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      var path = resolvePath(rels[rid]) || 'xl/worksheets/sheet' + (k + 1) + '.xml';
      var xml = await readZipText(buffer, entries, path);
      if (!xml) continue;
      sheets.push({ name: node.getAttribute('name') || 'Hoja ' + (k + 1), rows: parseSheet(xml, shared) });
    }
    if (!sheets.length) throw new Error('El libro no tiene hojas legibles.');
    return sheets;
  }

  /* ------------------------------------------------------------------------
     CSV
     ------------------------------------------------------------------------ */
  function detectDelimiter(text) {
    var firstLine = text.split(/\r?\n/)[0] || '';
    var candidates = [',', ';', '\t'];
    var best = ',';
    var bestCount = -1;
    candidates.forEach(function (d) {
      var count = firstLine.split(d).length - 1;
      if (count > bestCount) { best = d; bestCount = count; }
    });
    return best;
  }

  function parseCsv(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    var delim = detectDelimiter(text);
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delim) {
        row.push(field); field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text.charAt(i + 1) === '\n') i++;
        row.push(field); field = '';
        rows.push(row); row = [];
      } else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); });
    return { rows: rows, delimiter: delim };
  }

  /* ------------------------------------------------------------------------
     Conversión a tabla
     ------------------------------------------------------------------------ */

  /** Convierte un valor de celda en número, o NaN si no es numérico. Acepta "1,5", "45%", "1.200,50". */
  function toNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return NaN;
    var s = String(value == null ? '' : value).trim().replace(/\s/g, '').replace(/%$/, '');
    if (s === '') return NaN;
    if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^[-+]?\d+,\d+$/.test(s)) s = s.replace(',', '.');
    else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }

  /**
   * Convierte filas crudas (la primera es el encabezado) en una tabla con tipos.
   * @returns {{headers:string[], rows:any[][], numeric:boolean[]}}
   */
  function toTable(rawRows) {
    if (!rawRows.length) throw new Error('El archivo está vacío.');
    var headerRow = rawRows[0];
    var width = rawRows.reduce(function (w, r) { return Math.max(w, r.length); }, 0);
    var headers = [];
    var seen = {};
    for (var j = 0; j < width; j++) {
      var h = String(headerRow[j] == null ? '' : headerRow[j]).trim() || 'Columna ' + (j + 1);
      var base = h;
      var k = 2;
      while (seen[h]) h = base + ' (' + k++ + ')';
      seen[h] = true;
      headers.push(h);
    }
    var rows = rawRows.slice(1).map(function (r) {
      var out = new Array(width);
      for (var j2 = 0; j2 < width; j2++) out[j2] = r[j2] === undefined ? '' : r[j2];
      return out;
    });
    var numeric = headers.map(function (_, j3) {
      var filled = 0;
      var nums = 0;
      rows.forEach(function (r) {
        var v = r[j3];
        if (v === '' || v == null) return;
        filled++;
        if (!isNaN(toNumber(v))) nums++;
      });
      return filled > 0 && nums === filled;
    });
    if (!rows.length) throw new Error('El archivo solo tiene encabezados, sin filas de datos.');
    return { headers: headers, rows: rows, numeric: numeric };
  }

  /**
   * Lee un File elegido por el usuario.
   * @returns {Promise<{fileName:string, sheets:{name:string, rows:any[][]}[]}>}
   */
  async function readFile(file) {
    var name = file.name || 'archivo';
    var lower = name.toLowerCase();
    if (/\.(xlsx|xlsm)$/.test(lower)) {
      var buffer = await file.arrayBuffer();
      return { fileName: name, sheets: await readXlsx(buffer) };
    }
    if (/\.xls$/.test(lower)) {
      throw new Error('El formato .xls (Excel 97-2003) no está soportado. Guárdalo como .xlsx o .csv y vuelve a intentarlo.');
    }
    if (/\.(csv|txt|tsv)$/.test(lower) || (file.type || '').indexOf('text') === 0) {
      var text = await file.text();
      return { fileName: name, sheets: [{ name: 'CSV', rows: parseCsv(text).rows }] };
    }
    throw new Error('Formato no reconocido. Usa un archivo .xlsx o .csv.');
  }

  DataP.lib.fileReader = {
    readFile: readFile,
    readXlsx: readXlsx,
    parseCsv: parseCsv,
    toTable: toTable,
    toNumber: toNumber,
  };
})();
