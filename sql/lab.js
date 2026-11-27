/* Lab SQL SIPANDA: simulasi MySQL di browser (mesin: SQLite via sql.js).
   Software by Fahmi Yusuf */
(function () {
'use strict';

/* ====== Alamat aplikasi SIPANDA (Apps Script /exec) untuk memeriksa NIM mahasiswa ====== */
var API = 'https://script.google.com/macros/s/AKfycbw8w9AuolE13hXQg2x9vqzx752aAqih0yS_i6rUSGG93lw4DA-X9_LLI4p8fiCFjWEn/exec';
/* ========================================================================================= */
var SIMPAN = 'sipanda-labsql-v1', AUTH = 'sipanda-labsql-auth';
var SQL = null, dbs = {}, cur = '', mode = 'tabel', riwayat = [], akun = null;
function kunci() { return SIMPAN + '-' + (akun ? akun.nim : 'tamu'); }

/* ===================== util ===================== */
function $(s) { return document.querySelector(s); }
function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function b64(u8) { var s = '', i, n = 0x8000; for (i = 0; i < u8.length; i += n) s += String.fromCharCode.apply(null, u8.subarray(i, i + n)); return btoa(s); }
function unb64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function idn(s) { return String(s || '').trim().replace(/^[`"\[]|[`"\]]$/g, ''); }
function q(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

/* ===================== fungsi ala MySQL ===================== */
function pad(n) { return (n < 10 ? '0' : '') + n; }
function tglStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function jamStr(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
function keTgl(v) {
  if (v === null || v === undefined) return null;
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(String(v));
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}
var BLN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var HR = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function daftarFungsi(db) {
  var f = function (nama, n, fn) { Object.defineProperty(fn, 'length', { value: n }); db.create_function(nama, fn); };
  f('NOW', 0, function () { var d = new Date(); return tglStr(d) + ' ' + jamStr(d); });
  f('SYSDATE', 0, function () { var d = new Date(); return tglStr(d) + ' ' + jamStr(d); });
  f('CURDATE', 0, function () { return tglStr(new Date()); });
  f('CURTIME', 0, function () { return jamStr(new Date()); });
  for (var n = 1; n <= 12; n++) (function (n) {
    f('CONCAT', n, function () { var a = [].slice.call(arguments); return a.some(function (x) { return x === null; }) ? null : a.join(''); });
    if (n >= 2) f('CONCAT_WS', n, function () { var a = [].slice.call(arguments), s = a.shift(); return s === null ? null : a.filter(function (x) { return x !== null; }).join(s); });
  })(n);
  f('YEAR', 1, function (v) { var d = keTgl(v); return d ? d.getFullYear() : null; });
  f('MONTH', 1, function (v) { var d = keTgl(v); return d ? d.getMonth() + 1 : null; });
  f('DAY', 1, function (v) { var d = keTgl(v); return d ? d.getDate() : null; });
  f('DAYOFMONTH', 1, function (v) { var d = keTgl(v); return d ? d.getDate() : null; });
  f('MONTHNAME', 1, function (v) { var d = keTgl(v); return d ? BLN[d.getMonth()] : null; });
  f('DAYNAME', 1, function (v) { var d = keTgl(v); return d ? HR[d.getDay()] : null; });
  f('HOUR', 1, function (v) { var m = /(\d{1,2}):\d{2}/.exec(String(v || '')); return m ? +m[1] : null; });
  f('DATEDIFF', 2, function (a, b) { var x = keTgl(a), y = keTgl(b); if (!x || !y) return null; x.setHours(0, 0, 0, 0); y.setHours(0, 0, 0, 0); return Math.round((x - y) / 864e5); });
  f('DATE_FORMAT', 2, function (v, fmt) {
    var d = keTgl(v); if (!d || fmt === null) return null;
    var t = { Y: d.getFullYear(), y: String(d.getFullYear()).slice(2), m: pad(d.getMonth() + 1), c: d.getMonth() + 1, d: pad(d.getDate()), e: d.getDate(),
      H: pad(d.getHours()), i: pad(d.getMinutes()), s: pad(d.getSeconds()), M: BLN[d.getMonth()], b: BLN[d.getMonth()].slice(0, 3),
      W: HR[d.getDay()], a: HR[d.getDay()].slice(0, 3), '%': '%' };
    return String(fmt).replace(/%([a-zA-Z%])/g, function (_, c) { return t[c] !== undefined ? t[c] : c; });
  });
  f('DATE_GESER', 3, function (v, n, u) {
    var d = keTgl(v); if (!d) return null; n = Number(n);
    if (u === 'DAY') d.setDate(d.getDate() + n); else if (u === 'WEEK') d.setDate(d.getDate() + 7 * n);
    else if (u === 'MONTH') d.setMonth(d.getMonth() + n); else d.setFullYear(d.getFullYear() + n);
    return /\d{1,2}:\d{2}/.test(String(v)) ? tglStr(d) + ' ' + jamStr(d) : tglStr(d);
  });
  f('LEFT', 2, function (s, n) { return s === null ? null : String(s).slice(0, Math.max(0, n)); });
  f('RIGHT', 2, function (s, n) { return s === null ? null : (n > 0 ? String(s).slice(-n) : ''); });
  f('UCASE', 1, function (s) { return s === null ? null : String(s).toUpperCase(); });
  f('LCASE', 1, function (s) { return s === null ? null : String(s).toLowerCase(); });
  f('LOCATE', 2, function (a, b) { return a === null || b === null ? null : String(b).indexOf(String(a)) + 1; });
  f('REVERSE', 1, function (s) { return s === null ? null : String(s).split('').reverse().join(''); });
  f('LPAD', 3, function (s, n, p) { s = String(s); while (s.length < n) s = p + s; return s.slice(-n); });
  f('RPAD', 3, function (s, n, p) { s = String(s); while (s.length < n) s += p; return s.slice(0, n); });
  f('RAND', 0, function () { return Math.random(); });
  f('TRUNCATE', 2, function (x, d) { var p = Math.pow(10, d); return x === null ? null : Math.trunc(x * p) / p; });
  f('POW', 2, function (a, b) { return Math.pow(a, b); });
  f('POWER', 2, function (a, b) { return Math.pow(a, b); });
  f('SQRT', 1, function (a) { return Math.sqrt(a); });
  f('FLOOR', 1, function (a) { return Math.floor(a); });
  f('CEIL', 1, function (a) { return Math.ceil(a); });
  f('CEILING', 1, function (a) { return Math.ceil(a); });
  f('MOD', 2, function (a, b) { return a % b; });
  f('DATABASE', 0, function () { return cur; });
  f('VERSION', 0, function () { return '8.0-simulasi'; });
}

/* ===================== basis data ===================== */
function dbBaru(nama, bytes) {
  var db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  daftarFungsi(db);
  db.run('PRAGMA foreign_keys = ON');
  dbs[nama] = db;
  return db;
}
function simpan() {
  try {
    var o = { cur: cur, dbs: {} };
    Object.keys(dbs).forEach(function (n) { o.dbs[n] = b64(dbs[n].export()); dbs[n].run('PRAGMA foreign_keys = ON'); });
    localStorage.setItem(kunci(), JSON.stringify(o));
  } catch (e) { /* penyimpanan browser penuh atau dimatikan */ }
}
function muat() {
  try {
    var o = JSON.parse(localStorage.getItem(kunci()) || 'null');
    if (!o || !o.dbs) return false;
    Object.keys(o.dbs).forEach(function (n) { dbBaru(n, unb64(o.dbs[n])); });
    cur = dbs[o.cur] ? o.cur : (Object.keys(dbs)[0] || '');
    return Object.keys(dbs).length > 0;
  } catch (e) { return false; }
}

/* ===================== pemecah perintah ===================== */
function pecah(sql) {
  var out = [], buf = '', i = 0, n = sql.length, c, q2 = null;
  while (i < n) {
    c = sql[i];
    if (q2) {
      buf += c;
      if (c === '\\' && q2 !== '`') { buf += sql[i + 1] || ''; i += 2; continue; }
      if (c === q2) { if (sql[i + 1] === q2) { buf += q2; i += 2; continue; } q2 = null; }
      i++; continue;
    }
    if (c === "'" || c === '"' || c === '`') { q2 = c; buf += c; i++; continue; }
    if ((c === '-' && sql[i + 1] === '-' && /\s|$/.test(sql[i + 2] || '')) || c === '#') { while (i < n && sql[i] !== '\n') i++; continue; }
    if (c === '/' && sql[i + 1] === '*') { var e = sql.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; buf += ' '; continue; }
    if (c === ';') { if (buf.trim()) out.push(buf.trim()); buf = ''; i++; continue; }
    buf += c; i++;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
/* Ganti teks hanya di luar tanda kutip */
function luarKutip(sql, fn) {
  var out = '', seg = '', i = 0, q2 = null, c;
  for (; i < sql.length; i++) {
    c = sql[i];
    if (q2) { out += c; if (c === '\\' && q2 !== '`') { out += sql[++i] || ''; continue; } if (c === q2) q2 = null; continue; }
    if (c === "'" || c === '"') { out += fn(seg); seg = ''; q2 = c; out += c; continue; }
    seg += c;
  }
  return out + fn(seg);
}
/* Pisahkan isi CREATE TABLE ( ... ) per koma tingkat atas */
function pisahKoma(s) {
  var out = [], buf = '', d = 0, q2 = null, c;
  for (var i = 0; i < s.length; i++) {
    c = s[i];
    if (q2) { buf += c; if (c === q2) q2 = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q2 = c; buf += c; continue; }
    if (c === '(') d++; else if (c === ')') d--;
    if (c === ',' && d === 0) { out.push(buf.trim()); buf = ''; continue; }
    buf += c;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/* ===================== terjemahan MySQL ke SQLite ===================== */
function terjemahCreate(sql) {
  var m = /^(CREATE\s+(?:TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"\w.]+\s*)\(([\s\S]*)\)([\s\S]*)$/i.exec(sql);
  if (!m) return sql;
  var bagian = pisahKoma(m[2]), kolomAuto = null, pkTabel = null, hasil = [];
  bagian.forEach(function (b) {
    var u = b.toUpperCase();
    if (/^(KEY|INDEX|FULLTEXT)\b/.test(u)) return;
    if (/^UNIQUE\s+(KEY|INDEX)\b/.test(u)) { var mm = /\(([\s\S]*)\)\s*$/.exec(b); if (mm) hasil.push('UNIQUE (' + mm[1] + ')'); return; }
    if (/^CONSTRAINT\b/.test(u) && /UNIQUE\s+(KEY|INDEX)/.test(u)) { var m3 = /\(([\s\S]*)\)\s*$/.exec(b); if (m3) hasil.push('UNIQUE (' + m3[1] + ')'); return; }
    if (/^PRIMARY\s+KEY\b/.test(u)) { pkTabel = b; hasil.push(b); return; }
    if (/^(CONSTRAINT|FOREIGN\s+KEY|CHECK|UNIQUE)\b/.test(u)) { hasil.push(b.replace(/\bON\s+UPDATE\s+CASCADE\b/i, 'ON UPDATE CASCADE')); return; }
    // definisi kolom
    var mc = /^([`"\w]+)\s+([\s\S]*)$/.exec(b);
    if (!mc) { hasil.push(b); return; }
    var nama = mc[1], rest = mc[2];
    rest = rest.replace(/\bUNSIGNED\b|\bZEROFILL\b/ig, '')
      .replace(/\bON\s+UPDATE\s+CURRENT_TIMESTAMP(\(\))?/ig, '')
      .replace(/\bCOMMENT\s+'(?:[^'\\]|\\.|'')*'/ig, '')
      .replace(/\bCHARACTER\s+SET\s+\w+|\bCOLLATE\s+\w+/ig, '')
      .replace(/\bDEFAULT\s+(CURRENT_TIMESTAMP|NOW)(\s*\(\s*\))?/ig, "DEFAULT (datetime('now','localtime'))")
      .replace(/\bDEFAULT\s+CURRENT_DATE(\s*\(\s*\))?/ig, "DEFAULT (date('now','localtime'))");
    var me = /^ENUM\s*\(([\s\S]*?)\)/i.exec(rest.trim());
    if (me) rest = 'TEXT' + rest.trim().slice(me[0].length) + ' CHECK (' + nama + ' IN (' + me[1] + '))';
    if (/\bAUTO_INCREMENT\b/i.test(rest)) {
      kolomAuto = idn(nama);
      var sisa = rest.replace(/\bAUTO_INCREMENT\b/ig, '').replace(/\bPRIMARY\s+KEY\b/ig, '').replace(/^\s*\w+(\s*\(\s*\d+\s*\))?/, '').replace(/\bNOT\s+NULL\b/ig, '');
      hasil.push(nama + ' INTEGER PRIMARY KEY AUTOINCREMENT' + sisa.replace(/\s+/g, ' ').replace(/\s+$/, ''));
      return;
    }
    hasil.push(nama + ' ' + rest.replace(/\s+/g, ' ').trim());
  });
  if (kolomAuto && pkTabel) {
    var cols = /\(([^)]*)\)/.exec(pkTabel);
    if (cols && pisahKoma(cols[1]).map(idn).join(',') === kolomAuto) hasil.splice(hasil.indexOf(pkTabel), 1);
  }
  // opsi tabel MySQL (ENGINE=, DEFAULT CHARSET=, AUTO_INCREMENT=, COMMENT=) diabaikan
  var opsi = /^\s*((ENGINE|DEFAULT|CHARSET|CHARACTER|COLLATE|AUTO_INCREMENT|COMMENT|ROW_FORMAT)\b|=)/i.test(m[3]) ? '' : m[3];
  return m[1] + '(\n  ' + hasil.join(',\n  ') + '\n)' + opsi;
}
function terjemah(sql) {
  var s = sql;
  if (/^CREATE\s+(TEMPORARY\s+)?TABLE\b/i.test(s) && !/\bAS\s+SELECT\b/i.test(s)) {
    s = terjemahCreate(s);
  }
  s = s.replace(/\bDATE_(ADD|SUB)\s*\(\s*((?:'[^']*'|[^,()']|\([^()]*\))+?)\s*,\s*INTERVAL\s+(-?\d+)\s+(DAY|WEEK|MONTH|YEAR)S?\s*\)/ig,
    function (_, op, arg, n, unit) { return 'DATE_GESER(' + arg + ', ' + (op.toUpperCase() === 'SUB' ? -n : +n) + ", '" + unit.toUpperCase() + "')"; });
  s = luarKutip(s, function (t) {
    return t.replace(/\bIF\s*\(/ig, 'IIF(')
      .replace(/\bCURRENT_TIMESTAMP\b(\s*\(\s*\))?/ig, 'NOW()').replace(/\bCURRENT_DATE\b(\s*\(\s*\))?/ig, 'CURDATE()')
      .replace(/\bINSERT\s+INTO\s+([`"\w.]+)\s*\(\s*\)\s*VALUES\s*\(\s*\)/ig, 'INSERT INTO $1 DEFAULT VALUES')
      .replace(/\bINSERT\s+IGNORE\b/ig, 'INSERT OR IGNORE')
      .replace(/\bREPLACE\s+INTO\b/ig, 'INSERT OR REPLACE INTO')
      .replace(/\bLOCK\s+TABLES\b[\s\S]*$/i, 'SELECT 1')
      .replace(/\bAUTO_INCREMENT\s*=\s*\d+/ig, '');
  });
  return s;
}

/* ===================== perintah khusus MySQL ===================== */
function hasilTabel(kolom, baris) { return { kolom: kolom, baris: baris }; }
function butuhDb() { if (!cur || !dbs[cur]) throw { kode: 1046, state: '3D000', pesan: 'No database selected', saran: 'Pilih database dulu, misalnya: USE akademik;  atau buat: CREATE DATABASE belajar;' }; return dbs[cur]; }
function daftarTabel(db, jenis) {
  var r = db.exec("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name");
  return r.length ? r[0].values.filter(function (v) { return !jenis || v[1] === jenis; }) : [];
}
function adaTabel(db, t) { return daftarTabel(db).some(function (v) { return v[0].toLowerCase() === t.toLowerCase(); }); }
function deskripsi(db, t) {
  if (!adaTabel(db, t)) throw { kode: 1146, state: '42S02', pesan: "Table '" + cur + '.' + t + "' doesn't exist" };
  var info = db.exec('PRAGMA table_info(' + q(t) + ')')[0], fk = db.exec('PRAGMA foreign_key_list(' + q(t) + ')');
  var fkCols = {}; if (fk.length) fk[0].values.forEach(function (v) { fkCols[v[3]] = 1; });
  var uniq = {};
  var il = db.exec('PRAGMA index_list(' + q(t) + ')');
  if (il.length) il[0].values.forEach(function (v) { if (v[2]) { var ii = db.exec('PRAGMA index_info(' + q(v[1]) + ')'); if (ii.length && ii[0].values.length === 1) uniq[ii[0].values[0][2]] = 1; } });
  var sqlT = (db.exec("SELECT sql FROM sqlite_master WHERE name = " + "'" + t.replace(/'/g, "''") + "'")[0] || { values: [['']] }).values[0][0] || '';
  return hasilTabel(['Field', 'Type', 'Null', 'Key', 'Default', 'Extra'], info.values.map(function (v) {
    var auto = v[5] && /AUTOINCREMENT/i.test(sqlT) && /INTEGER/i.test(v[2]);
    var en = new RegExp('\\b' + v[1] + '\\s+TEXT[^,]*?CHECK \\(' + v[1] + ' IN \\(([^)]*)\\)\\)', 'i').exec(sqlT);
    return [v[1], en ? 'enum(' + en[1].replace(/\s+/g, '') + ')' : (v[2] || '').toLowerCase().replace(/^integer$/, 'int'), v[3] || v[5] ? 'NO' : 'YES', v[5] ? 'PRI' : (uniq[v[1]] ? 'UNI' : (fkCols[v[1]] ? 'MUL' : '')),
      v[4] === null ? 'NULL' : String(v[4]).replace(/^'(.*)'$/, '$1'), auto ? 'auto_increment' : ''];
  }));
}
function khusus(s) {
  var m;
  if (/^SHOW\s+DATABASES$/i.test(s) || /^SHOW\s+SCHEMAS$/i.test(s)) return hasilTabel(['Database'], Object.keys(dbs).sort().map(function (n) { return [n]; }));
  if ((m = /^CREATE\s+(?:DATABASE|SCHEMA)\s+(IF\s+NOT\s+EXISTS\s+)?([`\w]+)/i.exec(s))) {
    var nm = idn(m[2]);
    if (dbs[nm]) { if (m[1]) return { pesan: 'Query OK, 1 row affected, 1 warning' }; throw { kode: 1007, state: 'HY000', pesan: "Can't create database '" + nm + "'; database exists" }; }
    dbBaru(nm); simpan(); return { pesan: 'Query OK, 1 row affected', ubah: true };
  }
  if ((m = /^DROP\s+(?:DATABASE|SCHEMA)\s+(IF\s+EXISTS\s+)?([`\w]+)/i.exec(s))) {
    var nd = idn(m[2]);
    if (!dbs[nd]) { if (m[1]) return { pesan: 'Query OK, 0 rows affected, 1 warning' }; throw { kode: 1008, state: 'HY000', pesan: "Can't drop database '" + nd + "'; database doesn't exist" }; }
    var jml = daftarTabel(dbs[nd]).length;
    dbs[nd].close(); delete dbs[nd]; if (cur === nd) cur = ''; simpan();
    return { pesan: 'Query OK, ' + jml + ' row' + (jml === 1 ? '' : 's') + ' affected', ubah: true };
  }
  if ((m = /^USE\s+([`\w]+)$/i.exec(s))) {
    var nu = idn(m[1]);
    if (!dbs[nu]) throw { kode: 1049, state: '42000', pesan: "Unknown database '" + nu + "'", saran: 'Lihat daftar database dengan SHOW DATABASES;' };
    cur = nu; simpan(); return { pesan: 'Database changed', ubah: true };
  }
  if (/^SELECT\s+DATABASE\s*\(\s*\)$/i.test(s)) return hasilTabel(['DATABASE()'], [[cur || null]]);
  if ((m = /^SHOW\s+(FULL\s+)?TABLES$/i.exec(s))) {
    var db = butuhDb();
    return m[1] ? hasilTabel(['Tables_in_' + cur, 'Table_type'], daftarTabel(db).map(function (v) { return [v[0], v[1] === 'view' ? 'VIEW' : 'BASE TABLE']; }))
      : hasilTabel(['Tables_in_' + cur], daftarTabel(db).map(function (v) { return [v[0]]; }));
  }
  if ((m = /^(?:DESCRIBE|DESC|EXPLAIN)\s+([`\w]+)$/i.exec(s)) || (m = /^SHOW\s+(?:FULL\s+)?(?:COLUMNS|FIELDS)\s+(?:FROM|IN)\s+([`\w]+)$/i.exec(s))) return deskripsi(butuhDb(), idn(m[1]));
  if ((m = /^SHOW\s+CREATE\s+TABLE\s+([`\w]+)$/i.exec(s))) {
    var d2 = butuhDb(), t2 = idn(m[1]);
    if (!adaTabel(d2, t2)) throw { kode: 1146, state: '42S02', pesan: "Table '" + cur + '.' + t2 + "' doesn't exist" };
    var sq = d2.exec("SELECT sql FROM sqlite_master WHERE lower(name) = lower('" + t2.replace(/'/g, "''") + "')")[0].values[0][0];
    var tampil = sq.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/ig, 'INT NOT NULL AUTO_INCREMENT PRIMARY KEY')
      .replace(/DEFAULT \(datetime\('now','localtime'\)\)/ig, 'DEFAULT CURRENT_TIMESTAMP').replace(/DEFAULT \(date\('now','localtime'\)\)/ig, 'DEFAULT CURRENT_DATE')
      .replace(/(\w+) TEXT((?:(?!,\n)[\s\S])*?) CHECK \(\1 IN \(([^)]*)\)\)/g, '$1 ENUM($3)$2');
    if (/^CREATE TABLE/i.test(tampil)) tampil += ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    return hasilTabel(['Table', 'Create Table'], [[t2, tampil]]);
  }
  if ((m = /^TRUNCATE\s+(?:TABLE\s+)?([`\w]+)$/i.exec(s))) {
    var d3 = butuhDb(), t3 = idn(m[1]);
    if (!adaTabel(d3, t3)) throw { kode: 1146, state: '42S02', pesan: "Table '" + cur + '.' + t3 + "' doesn't exist" };
    d3.run('DELETE FROM ' + q(t3));
    try { d3.run('DELETE FROM sqlite_sequence WHERE name = ?', [t3]); } catch (e) {}
    simpan(); return { pesan: 'Query OK, 0 rows affected', ubah: true };
  }
  if (/^ALTER\s+TABLE\s+[`\w]+\s+(MODIFY|CHANGE)\b/i.test(s))
    throw { kode: 1235, state: '42000', pesan: 'This version of MySQL simulator doesn\'t yet support ALTER TABLE ... ' + /(MODIFY|CHANGE)/i.exec(s)[1].toUpperCase(),
      saran: 'Di simulator ini pakai ADD COLUMN, DROP COLUMN, RENAME COLUMN a TO b, atau RENAME TO. Untuk mengubah tipe kolom: buat tabel baru lalu salin datanya.' };
  if (/^(START\s+TRANSACTION|BEGIN|COMMIT|ROLLBACK)\b/i.test(s)) {
    var d4 = butuhDb();
    d4.run(/^START/i.test(s) ? 'BEGIN' : s);
    if (!/^(START|BEGIN)/i.test(s)) simpan();
    return { pesan: 'Query OK, 0 rows affected' };
  }
  if (/^SET\s+(NAMES|FOREIGN_KEY_CHECKS|SQL_MODE|AUTOCOMMIT|TIME_ZONE|@@)/i.test(s)) {
    if ((m = /FOREIGN_KEY_CHECKS\s*=\s*(\d)/i.exec(s)) && cur && dbs[cur]) dbs[cur].run('PRAGMA foreign_keys = ' + (m[1] === '1' ? 'ON' : 'OFF'));
    return { pesan: 'Query OK, 0 rows affected' };
  }
  return null;
}

/* ===================== kesalahan ala MySQL ===================== */
function kesalahan(e, sql) {
  if (e && e.kode) return e;
  var t = String((e && e.message) || e), m;
  if ((m = /no such table: (?:main\.)?(\S+)/i.exec(t))) return { kode: 1146, state: '42S02', pesan: "Table '" + cur + '.' + m[1] + "' doesn't exist", saran: 'Cek nama tabel dengan SHOW TABLES;' };
  if ((m = /no such column: (\S+)/i.exec(t))) return { kode: 1054, state: '42S22', pesan: "Unknown column '" + m[1] + "' in 'field list'", saran: 'Cek nama kolom dengan DESCRIBE nama_tabel;' };
  if ((m = /table (\S+) already exists/i.exec(t))) return { kode: 1050, state: '42S01', pesan: "Table '" + m[1].replace(/"/g, '') + "' already exists" };
  if ((m = /UNIQUE constraint failed: ([\w.]+)/i.exec(t))) return { kode: 1062, state: '23000', pesan: "Duplicate entry for key '" + m[1] + "'", saran: 'Nilai pada kolom PRIMARY KEY atau UNIQUE tidak boleh kembar.' };
  if ((m = /NOT NULL constraint failed: ([\w.]+)/i.exec(t))) return { kode: 1048, state: '23000', pesan: "Column '" + m[1].split('.').pop() + "' cannot be null" };
  if (/FOREIGN KEY constraint failed/i.test(t)) return { kode: 1452, state: '23000', pesan: 'Cannot add, update, or delete a row: a foreign key constraint fails',
    saran: 'Data yang dirujuk (di tabel induk) belum ada, atau baris induk masih dipakai di tabel anak.' };
  if ((m = /CHECK constraint failed: (.+)/i.exec(t))) return { kode: 3819, state: 'HY000', pesan: "Check constraint '" + m[1] + "' is violated.", saran: 'Untuk kolom ENUM, isi harus salah satu pilihan yang tersedia.' };
  if ((m = /near "([^"]*)": syntax error/i.exec(t))) return { kode: 1064, state: '42000', pesan: "You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near '" + m[1] + "'",
    saran: 'Periksa ejaan kata kunci, tanda koma, dan tanda kurung di sekitar "' + m[1] + '".' };
  if (/incomplete input/i.test(t)) return { kode: 1064, state: '42000', pesan: 'You have an error in your SQL syntax; the statement is incomplete', saran: 'Mungkin ada tanda kurung atau tanda kutip yang belum ditutup.' };
  if ((m = /no such function: (\w+)/i.exec(t))) return { kode: 1305, state: '42000', pesan: 'FUNCTION ' + cur + '.' + m[1] + ' does not exist', saran: 'Fungsi ini belum tersedia di simulator.' };
  if ((m = /wrong number of arguments to function (\w+)/i.exec(t))) return { kode: 1582, state: '42000', pesan: "Incorrect parameter count in the call to native function '" + m[1] + "'" };
  if ((m = /(\d+) values for (\d+) columns/i.exec(t)) || /values for \d+ columns/i.test(t)) return { kode: 1136, state: '21S01', pesan: "Column count doesn't match value count at row 1", saran: 'Jumlah nilai di VALUES harus sama dengan jumlah kolom.' };
  if ((m = /ambiguous column name: (\S+)/i.exec(t))) return { kode: 1052, state: '23000', pesan: "Column '" + m[1] + "' in field list is ambiguous", saran: 'Tulis nama tabel di depan kolom, misalnya mahasiswa.nim.' };
  if (/misuse of aggregate/i.test(t)) return { kode: 1111, state: 'HY000', pesan: 'Invalid use of group function', saran: 'Fungsi agregat (SUM, COUNT, AVG) dipakai di HAVING, bukan di WHERE.' };
  return { kode: 1105, state: 'HY000', pesan: t };
}

/* ===================== menjalankan ===================== */
var MUTASI = /^(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|RENAME|TRUNCATE)\b/i;
function jalankanSatu(s) {
  var t0 = performance.now(), k = khusus(s.trim());
  if (k) { k.waktu = performance.now() - t0; return k; }
  var db = butuhDb(), sqlT = terjemah(s);
  var res = db.exec(sqlT);
  var dt = performance.now() - t0;
  if (res.length) { var r = res[res.length - 1]; return { kolom: r.columns, baris: r.values, waktu: dt }; }
  if (/^SELECT\b|^WITH\b/i.test(s)) return { kolom: [], baris: [], waktu: dt, kosong: true };
  var n = db.getRowsModified();
  if (MUTASI.test(s)) simpan();
  var ubahStruktur = /^(CREATE|DROP|ALTER|RENAME)\b/i.test(s);
  var msg = 'Query OK, ' + (ubahStruktur ? 0 : n) + ' row' + ((ubahStruktur ? 0 : n) === 1 ? '' : 's') + ' affected';
  if (/^UPDATE\b/i.test(s)) msg += '\nRows matched: ' + n + '  Changed: ' + n + '  Warnings: 0';
  if (/^INSERT\b/i.test(s) && n > 1) msg += '\nRecords: ' + n + '  Duplicates: 0  Warnings: 0';
  return { pesan: msg, waktu: dt, ubah: ubahStruktur };
}
function jalankan(teks) {
  var daftar = pecah(teks), out = [];
  if (!daftar.length) return out;
  for (var i = 0; i < daftar.length; i++) {
    try { out.push({ sql: daftar[i], r: jalankanSatu(daftar[i]) }); }
    catch (e) { out.push({ sql: daftar[i], err: kesalahan(e, daftar[i]) }); break; }
  }
  riwayat.unshift(teks.trim()); riwayat = riwayat.filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 30);
  try { localStorage.setItem(SIMPAN + '-riwayat', JSON.stringify(riwayat)); } catch (e) {}
  return out;
}

/* ===================== tampilan hasil ===================== */
function fmtWaktu(ms) { return '(' + (ms / 1000).toFixed(2) + ' sec)'; }
function nilaiTeks(v) { return v === null ? 'NULL' : (v instanceof Uint8Array ? '[BLOB]' : String(v)); }
function teksAscii(kolom, baris) {
  var w = kolom.map(function (k, i) { return Math.max(String(k).length, baris.reduce(function (m, r) { return Math.max(m, nilaiTeks(r[i]).length); }, 0)); });
  var garis = '+' + w.map(function (n) { return Array(n + 3).join('-'); }).join('+') + '+';
  var baris1 = function (arr, kanan) { return '| ' + arr.map(function (v, i) { var s = nilaiTeks(v); var p = Array(w[i] - s.length + 1).join(' '); return kanan && typeof v === 'number' ? p + s : s + p; }).join(' | ') + ' |'; };
  return [garis, baris1(kolom), garis].concat(baris.map(function (r) { return baris1(r, true); })).concat([garis]).join('\n');
}
function render(out) {
  var box = $('#hasil');
  if (!out.length) { box.innerHTML = '<div class="kosong">Tidak ada perintah untuk dijalankan.</div>'; return; }
  box.innerHTML = out.map(function (o, i) {
    var kepala = '<div class="qhead"><span class="qno">' + (i + 1) + '</span><code>' + esc(o.sql.length > 160 ? o.sql.slice(0, 160) + '...' : o.sql) + '</code></div>';
    if (o.err) {
      return '<section class="blok err">' + kepala + '<pre class="msg">ERROR ' + o.err.kode + ' (' + o.err.state + '): ' + esc(o.err.pesan) + '</pre>' +
        (o.err.saran ? '<p class="saran">' + esc(o.err.saran) + '</p>' : '') +
        (i < pecah($('#editor').value).length - 1 ? '<p class="saran">Perintah berikutnya tidak dijalankan.</p>' : '') + '</section>';
    }
    var r = o.r;
    if (r.kolom) {
      if (!r.baris.length) return '<section class="blok">' + kepala + '<pre class="msg">Empty set ' + fmtWaktu(r.waktu) + '</pre></section>';
      var info = r.baris.length + ' row' + (r.baris.length === 1 ? '' : 's') + ' in set ' + fmtWaktu(r.waktu);
      var isi = mode === 'teks' ? '<pre class="ascii">' + esc(teksAscii(r.kolom, r.baris)) + '</pre>'
        : '<div class="tw"><table><thead><tr>' + r.kolom.map(function (k) { return '<th>' + esc(k) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          r.baris.map(function (row) { return '<tr>' + row.map(function (v) { return v === null ? '<td class="nul">NULL</td>' : '<td' + (typeof v === 'number' ? ' class="n"' : '') + '>' + esc(nilaiTeks(v)) + '</td>'; }).join('') + '</tr>'; }).join('') +
          '</tbody></table></div>';
      return '<section class="blok">' + kepala + isi + '<p class="info">' + info + '</p></section>';
    }
    return '<section class="blok ok">' + kepala + '<pre class="msg">' + esc(r.pesan) + (r.waktu === null ? '' : ' ' + fmtWaktu(r.waktu || 0)) + '</pre></section>';
  }).join('');
}

/* ===================== struktur (sidebar) ===================== */
function renderStruktur() {
  var sel = $('#pilihDb');
  var nama = Object.keys(dbs).sort();
  sel.innerHTML = (cur ? '' : '<option value="">(belum memilih)</option>') + nama.map(function (n) { return '<option ' + (n === cur ? 'selected' : '') + '>' + esc(n) + '</option>'; }).join('');
  $('#dbAktif').textContent = cur || 'belum ada';
  var box = $('#tabel');
  if (!cur || !dbs[cur]) { box.innerHTML = '<p class="kecil">Buat database dengan <code>CREATE DATABASE nama;</code> atau muat contoh di bawah.</p>'; return; }
  var db = dbs[cur], T = daftarTabel(db);
  if (!T.length) { box.innerHTML = '<p class="kecil">Database <b>' + esc(cur) + '</b> masih kosong. Buat tabel dengan <code>CREATE TABLE</code>.</p>'; return; }
  box.innerHTML = T.map(function (v) {
    var cols = db.exec('PRAGMA table_info(' + q(v[0]) + ')')[0].values;
    var jml = '';
    try { jml = db.exec('SELECT COUNT(*) FROM ' + q(v[0]))[0].values[0][0]; } catch (e) {}
    return '<details class="tb"><summary><span class="tn">' + esc(v[0]) + '</span>' + (v[1] === 'view' ? '<span class="tag">view</span>' : '') + '<span class="cnt">' + jml + ' baris</span></summary>' +
      '<ul>' + cols.map(function (c) { return '<li><span class="cn' + (c[5] ? ' pk' : '') + '">' + esc(c[1]) + '</span><span class="ct">' + esc((c[2] || '').toLowerCase()) + '</span></li>'; }).join('') + '</ul>' +
      '<div class="tbact"><button type="button" data-ins="SELECT * FROM ' + esc(v[0]) + ' LIMIT 10;">Lihat isi</button><button type="button" data-ins="DESCRIBE ' + esc(v[0]) + ';">DESCRIBE</button></div></details>';
  }).join('');
}

/* ===================== contoh database ===================== */
var CONTOH = {
  umkm: [
    "CREATE DATABASE IF NOT EXISTS umkm;",
    "USE umkm;",
    "DROP VIEW IF EXISTS v_penjualan;",
    "DROP TABLE IF EXISTS detail_penjualan;",
    "DROP TABLE IF EXISTS penjualan;",
    "DROP TABLE IF EXISTS karyawan;",
    "DROP TABLE IF EXISTS pelanggan;",
    "DROP TABLE IF EXISTS produk;",
    "CREATE TABLE produk (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  nama VARCHAR(60) NOT NULL,\n  kategori VARCHAR(30) NOT NULL,\n  satuan VARCHAR(15) NOT NULL,\n  harga_beli INT NOT NULL,\n  harga_jual INT NOT NULL,\n  stok INT DEFAULT 0\n) ENGINE=InnoDB;",
    "CREATE TABLE pelanggan (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  nama VARCHAR(60) NOT NULL,\n  jenis_kelamin ENUM('L','P') NOT NULL,\n  kota VARCHAR(30),\n  telepon VARCHAR(15) UNIQUE,\n  tipe ENUM('Umum','Reseller') DEFAULT 'Umum',\n  tanggal_daftar DATE\n) ENGINE=InnoDB;",
    "CREATE TABLE karyawan (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  nama VARCHAR(60) NOT NULL,\n  jabatan VARCHAR(30)\n) ENGINE=InnoDB;",
    "CREATE TABLE penjualan (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  no_nota VARCHAR(20) NOT NULL UNIQUE,\n  tanggal DATE NOT NULL,\n  jam TIME,\n  pelanggan_id INT NULL,\n  karyawan_id INT NOT NULL,\n  kanal ENUM('Toko','Shopee','Tokopedia','WhatsApp') NOT NULL,\n  metode_bayar VARCHAR(20) NOT NULL,\n  diskon_persen INT DEFAULT 0,\n  ongkir INT DEFAULT 0,\n  status ENUM('Selesai','Batal','Retur') DEFAULT 'Selesai',\n  FOREIGN KEY (pelanggan_id) REFERENCES pelanggan(id),\n  FOREIGN KEY (karyawan_id) REFERENCES karyawan(id)\n) ENGINE=InnoDB;",
    "CREATE TABLE detail_penjualan (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  penjualan_id INT NOT NULL,\n  produk_id INT NOT NULL,\n  jumlah INT NOT NULL,\n  harga_satuan INT NOT NULL,\n  FOREIGN KEY (penjualan_id) REFERENCES penjualan(id),\n  FOREIGN KEY (produk_id) REFERENCES produk(id)\n) ENGINE=InnoDB;",
    "INSERT INTO produk (nama, kategori, satuan, harga_beli, harga_jual, stok) VALUES\n('Wingko Babat Original', 'Makanan Khas', 'kotak', 22000, 30000, 30),\n('Wingko Babat Cokelat', 'Makanan Khas', 'kotak', 24000, 33000, 55),\n('Wingko Babat Durian', 'Makanan Khas', 'kotak', 26000, 36000, 79),\n('Bandeng Presto', 'Makanan Khas', 'pak', 38000, 52000, 12),\n('Otak-otak Bandeng', 'Makanan Khas', 'pak', 30000, 42000, 28),\n('Kerupuk Ikan Tenggiri', 'Camilan', 'bungkus', 15000, 22000, 43),\n('Kerupuk Udang', 'Camilan', 'bungkus', 18000, 26000, 68),\n('Keripik Singkong Balado', 'Camilan', 'bungkus', 9000, 14000, 77),\n('Keripik Pisang Manis', 'Camilan', 'bungkus', 10000, 15000, 71),\n('Rengginang Lorjuk', 'Camilan', 'bungkus', 20000, 30000, 45),\n('Kopi Robusta Bubuk 250 g', 'Minuman', 'pak', 28000, 40000, 15),\n('Kopi Robusta Biji 250 g', 'Minuman', 'pak', 30000, 43000, 25),\n('Jamu Kunyit Asam 500 ml', 'Minuman', 'botol', 9000, 15000, 29),\n('Madu Hutan 250 ml', 'Minuman', 'botol', 45000, 65000, 51),\n('Sambal Bawang Botol', 'Bumbu', 'botol', 14000, 22000, 27),\n('Sambal Petis', 'Bumbu', 'botol', 13000, 20000, 72),\n('Petis Udang', 'Bumbu', 'botol', 17000, 25000, 16),\n('Tas Anyaman Pandan', 'Kerajinan', 'buah', 45000, 75000, 77),\n('Batik Tulis Sendang', 'Kerajinan', 'lembar', 180000, 275000, 6),\n('Tempat Tisu Anyaman', 'Kerajinan', 'buah', 20000, 35000, 41);",
    "INSERT INTO pelanggan (nama, jenis_kelamin, kota, telepon, tipe, tanggal_daftar) VALUES\n('Ahmad Nugroho', 'L', 'Sidoarjo', '081557866880', 'Reseller', '2025-10-07'),\n('Ayu Nugroho', 'P', 'Lamongan', '088195592988', 'Umum', '2026-06-17'),\n('Bayu Anggraini', 'L', 'Surabaya', '081284819744', 'Umum', '2025-11-22'),\n('Citra Hidayat', 'P', 'Semarang', '085728909714', 'Umum', '2025-10-26'),\n('Dewi Fauzi', 'P', 'Lamongan', '088287500451', 'Umum', '2026-05-27'),\n('Eko Saputra', 'L', 'Gresik', '088259505484', 'Umum', '2026-08-09'),\n('Fitri Kurniawan', 'P', 'Semarang', '081263522449', 'Reseller', '2026-01-03'),\n('Galih Santoso', 'L', 'Gresik', '085725629378', 'Umum', '2026-03-11'),\n('Hana Permatasari', 'P', 'Semarang', '089590552815', 'Umum', '2026-07-16'),\n('Irfan Kurniawan', 'L', 'Malang', '088144714533', 'Umum', '2025-12-21'),\n('Joko Nugroho', 'L', 'Surabaya', '085778846905', 'Umum', '2026-03-16'),\n('Kurnia Setiawan', 'P', 'Sidoarjo', '088140135217', 'Umum', '2025-06-13'),\n('Lina Pratama', 'P', 'Semarang', '081280224935', 'Reseller', '2026-07-24'),\n('Mega Fauzi', 'P', 'Gresik', '088293524993', 'Umum', '2025-07-23'),\n('Nanda Kurniawan', 'P', 'Malang', '085740726097', 'Umum', '2025-08-12'),\n('Oki Susanto', 'L', 'Tuban', '088271310167', 'Umum', '2025-08-02'),\n('Putri Kurniawan', 'P', 'Surabaya', '088143689519', 'Umum', '2026-06-01'),\n('Rizal Nugroho', 'L', 'Sidoarjo', '081583571250', 'Umum', '2026-05-09'),\n('Sinta Fauzi', 'P', 'Sidoarjo', '088274275917', 'Reseller', '2026-02-12'),\n('Taufik Susanto', 'L', 'Lamongan', '085737183296', 'Umum', '2025-12-23'),\n('Umi Maharani', 'P', 'Lamongan', '081214443850', 'Umum', '2025-10-16'),\n('Vina Fauzi', 'P', 'Yogyakarta', '085780180947', 'Umum', '2026-04-02'),\n('Wahyu Kurniawan', 'L', 'Bojonegoro', '081344911442', 'Umum', '2025-12-02'),\n('Yuni Kurniawan', 'P', 'Sidoarjo', '088176727300', 'Umum', '2026-01-25'),\n('Zainal Nugroho', 'L', 'Jakarta', '088214512393', 'Reseller', '2026-03-13'),\n('Arif Hidayat', 'L', 'Surabaya', '085723203533', 'Umum', '2025-11-10'),\n('Dian Anggraini', 'P', 'Lamongan', '089579145394', 'Umum', '2026-06-02'),\n('Rudi Kurniawan', 'L', 'Lamongan', '085774309920', 'Umum', '2025-09-02'),\n('Sari Fauzi', 'P', 'Lamongan', '085759677843', 'Umum', '2025-10-15'),\n('Lilis Wulandari', 'P', 'Lamongan', '089565205206', 'Umum', '2026-06-18');",
    "INSERT INTO karyawan (nama, jabatan) VALUES\n('Rina Kusuma', 'Kasir'),\n('Fajar Ramadhan', 'Kasir'),\n('Siti Aminah', 'Admin Online'),\n('Bagas Wicaksono', 'Admin Online');",
    "INSERT INTO penjualan (no_nota, tanggal, jam, pelanggan_id, karyawan_id, kanal, metode_bayar, diskon_persen, ongkir, status) VALUES\n('INV-2609-001', '2026-09-01', '10:24', 29, 1, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2609-002', '2026-09-01', '20:11', 25, 4, 'Shopee', 'Saldo Marketplace', 10, 12000, 'Selesai'),\n('INV-2609-003', '2026-09-02', '16:26', 8, 3, 'WhatsApp', 'Transfer', 0, 0, 'Selesai'),\n('INV-2609-004', '2026-09-02', '14:35', 26, 3, 'Shopee', 'Saldo Marketplace', 0, 0, 'Selesai'),\n('INV-2609-005', '2026-09-03', '18:03', 4, 2, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2609-006', '2026-09-04', '10:16', 3, 2, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2609-007', '2026-09-04', '15:38', NULL, 2, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2609-008', '2026-09-05', '09:43', 20, 4, 'Shopee', 'Saldo Marketplace', 0, 15000, 'Selesai'),\n('INV-2609-009', '2026-09-06', '09:19', 10, 4, 'WhatsApp', 'Transfer', 0, 0, 'Selesai'),\n('INV-2609-010', '2026-09-06', '17:38', 6, 3, 'WhatsApp', 'Transfer', 0, 18000, 'Selesai'),\n('INV-2609-011', '2026-09-07', '18:14', NULL, 1, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2609-012', '2026-09-07', '13:01', 29, 4, 'Shopee', 'Saldo Marketplace', 5, 9000, 'Selesai'),\n('INV-2609-013', '2026-09-09', '16:52', NULL, 1, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2609-014', '2026-09-10', '14:45', NULL, 1, 'Toko', 'QRIS', 0, 0, 'Batal'),\n('INV-2609-015', '2026-09-11', '21:57', 12, 4, 'WhatsApp', 'Transfer', 0, 18000, 'Selesai'),\n('INV-2609-016', '2026-09-11', '19:50', 1, 4, 'Shopee', 'Saldo Marketplace', 5, 18000, 'Selesai'),\n('INV-2609-017', '2026-09-12', '19:37', 29, 1, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2609-018', '2026-09-14', '09:05', 22, 3, 'Tokopedia', 'Saldo Marketplace', 0, 18000, 'Selesai'),\n('INV-2609-019', '2026-09-16', '15:34', 7, 3, 'Shopee', 'Saldo Marketplace', 10, 12000, 'Selesai'),\n('INV-2609-020', '2026-09-16', '16:42', NULL, 1, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2609-021', '2026-09-17', '11:08', NULL, 1, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2609-022', '2026-09-17', '15:07', NULL, 1, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2609-023', '2026-09-18', '20:19', NULL, 1, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2609-024', '2026-09-18', '16:11', 11, 4, 'Shopee', 'Saldo Marketplace', 0, 15000, 'Selesai'),\n('INV-2609-025', '2026-09-20', '13:53', 22, 1, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2609-026', '2026-09-20', '17:29', NULL, 1, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2609-027', '2026-09-20', '23:33', 30, 4, 'Shopee', 'Saldo Marketplace', 0, 22000, 'Selesai'),\n('INV-2609-028', '2026-09-21', '17:41', NULL, 2, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2609-029', '2026-09-22', '11:50', 9, 2, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2609-030', '2026-09-23', '16:14', 1, 3, 'Shopee', 'Saldo Marketplace', 10, 9000, 'Selesai'),\n('INV-2609-031', '2026-09-25', '16:46', NULL, 2, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2609-032', '2026-09-26', '21:08', 11, 4, 'Shopee', 'Saldo Marketplace', 5, 0, 'Selesai'),\n('INV-2609-033', '2026-09-26', '17:03', 24, 2, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2609-034', '2026-09-26', '16:42', 28, 4, 'Shopee', 'Saldo Marketplace', 0, 15000, 'Selesai'),\n('INV-2609-035', '2026-09-27', '22:08', 1, 4, 'WhatsApp', 'Transfer', 5, 18000, 'Selesai'),\n('INV-2609-036', '2026-09-29', '18:34', 27, 4, 'Shopee', 'Saldo Marketplace', 0, 12000, 'Selesai'),\n('INV-2609-037', '2026-09-30', '07:51', 24, 3, 'WhatsApp', 'Transfer', 0, 0, 'Selesai'),\n('INV-2610-038', '2026-10-02', '18:09', NULL, 1, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2610-039', '2026-10-05', '10:45', 14, 1, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2610-040', '2026-10-08', '11:32', 23, 4, 'WhatsApp', 'Transfer', 0, 0, 'Selesai'),\n('INV-2610-041', '2026-10-09', '14:46', 7, 2, 'Toko', 'Tunai', 10, 0, 'Selesai'),\n('INV-2610-042', '2026-10-10', '12:47', 15, 4, 'Shopee', 'Saldo Marketplace', 0, 0, 'Selesai'),\n('INV-2610-043', '2026-10-11', '14:01', NULL, 2, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2610-044', '2026-10-12', '21:08', 29, 4, 'Shopee', 'Saldo Marketplace', 0, 12000, 'Selesai'),\n('INV-2610-045', '2026-10-12', '18:05', 2, 2, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2610-046', '2026-10-14', '14:51', NULL, 2, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2610-047', '2026-10-15', '23:55', 5, 3, 'WhatsApp', 'Transfer', 0, 9000, 'Retur'),\n('INV-2610-048', '2026-10-16', '13:20', 29, 4, 'WhatsApp', 'COD', 0, 15000, 'Selesai'),\n('INV-2610-049', '2026-10-16', '11:28', 11, 4, 'WhatsApp', 'Transfer', 0, 18000, 'Selesai'),\n('INV-2610-050', '2026-10-19', '07:33', 7, 4, 'Shopee', 'Saldo Marketplace', 10, 22000, 'Selesai'),\n('INV-2610-051', '2026-10-20', '16:10', 24, 1, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2610-052', '2026-10-20', '20:06', NULL, 2, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2610-053', '2026-10-22', '18:51', NULL, 1, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2610-054', '2026-10-23', '07:18', 17, 3, 'WhatsApp', 'Transfer', 5, 15000, 'Selesai'),\n('INV-2610-055', '2026-10-24', '08:56', 2, 4, 'Shopee', 'Saldo Marketplace', 0, 12000, 'Selesai'),\n('INV-2610-056', '2026-10-26', '23:25', 2, 4, 'Shopee', 'Saldo Marketplace', 0, 9000, 'Selesai'),\n('INV-2610-057', '2026-10-28', '16:12', 6, 1, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2610-058', '2026-10-28', '17:55', NULL, 1, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2610-059', '2026-10-28', '18:36', 3, 2, 'Toko', 'QRIS', 0, 0, 'Batal'),\n('INV-2610-060', '2026-10-28', '13:19', 8, 3, 'Shopee', 'Saldo Marketplace', 0, 15000, 'Selesai'),\n('INV-2610-061', '2026-10-29', '21:48', 19, 3, 'Tokopedia', 'Saldo Marketplace', 5, 9000, 'Selesai'),\n('INV-2610-062', '2026-10-30', '08:28', 5, 2, 'Toko', 'QRIS', 0, 0, 'Batal'),\n('INV-2610-063', '2026-10-31', '20:51', 4, 3, 'Shopee', 'Saldo Marketplace', 5, 12000, 'Selesai'),\n('INV-2610-064', '2026-10-31', '19:30', 10, 4, 'WhatsApp', 'Transfer', 0, 0, 'Selesai'),\n('INV-2611-065', '2026-11-01', '20:25', NULL, 2, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2611-066', '2026-11-02', '16:19', 21, 2, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2611-067', '2026-11-03', '12:19', 15, 3, 'WhatsApp', 'Transfer', 0, 0, 'Selesai'),\n('INV-2611-068', '2026-11-04', '07:51', 20, 4, 'Shopee', 'Saldo Marketplace', 0, 22000, 'Selesai'),\n('INV-2611-069', '2026-11-04', '22:22', 21, 4, 'WhatsApp', 'COD', 0, 0, 'Selesai'),\n('INV-2611-070', '2026-11-05', '20:15', 20, 2, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2611-071', '2026-11-06', '22:12', 16, 3, 'Shopee', 'Saldo Marketplace', 0, 15000, 'Selesai'),\n('INV-2611-072', '2026-11-06', '13:20', 29, 3, 'Shopee', 'Saldo Marketplace', 0, 15000, 'Selesai'),\n('INV-2611-073', '2026-11-07', '21:21', 27, 3, 'Shopee', 'Saldo Marketplace', 0, 18000, 'Selesai'),\n('INV-2611-074', '2026-11-09', '19:48', 28, 3, 'Shopee', 'Saldo Marketplace', 0, 18000, 'Selesai'),\n('INV-2611-075', '2026-11-09', '14:11', 24, 1, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2611-076', '2026-11-09', '20:19', NULL, 1, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2611-077', '2026-11-09', '19:54', 20, 4, 'Shopee', 'Saldo Marketplace', 0, 12000, 'Selesai'),\n('INV-2611-078', '2026-11-10', '12:26', 2, 2, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2611-079', '2026-11-13', '17:15', 10, 2, 'Toko', 'Tunai', 5, 0, 'Selesai'),\n('INV-2611-080', '2026-11-13', '13:55', 15, 2, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2611-081', '2026-11-14', '20:30', 13, 2, 'Toko', 'QRIS', 5, 0, 'Selesai'),\n('INV-2611-082', '2026-11-14', '19:16', NULL, 2, 'Toko', 'Tunai', 5, 0, 'Selesai'),\n('INV-2611-083', '2026-11-15', '23:33', 30, 4, 'Tokopedia', 'Saldo Marketplace', 0, 0, 'Selesai'),\n('INV-2611-084', '2026-11-15', '09:37', 30, 1, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2611-085', '2026-11-15', '17:35', 25, 4, 'Tokopedia', 'Saldo Marketplace', 10, 15000, 'Selesai'),\n('INV-2611-086', '2026-11-16', '19:03', 18, 1, 'Toko', 'QRIS', 5, 0, 'Retur'),\n('INV-2611-087', '2026-11-16', '14:12', NULL, 1, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2611-088', '2026-11-18', '09:12', 23, 4, 'Tokopedia', 'Saldo Marketplace', 0, 0, 'Selesai'),\n('INV-2611-089', '2026-11-19', '12:05', 9, 1, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2611-090', '2026-11-19', '14:16', NULL, 2, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2611-091', '2026-11-19', '15:51', 30, 3, 'Shopee', 'Saldo Marketplace', 0, 18000, 'Selesai'),\n('INV-2611-092', '2026-11-21', '09:16', NULL, 1, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2611-093', '2026-11-22', '12:48', 23, 1, 'Toko', 'QRIS', 0, 0, 'Selesai'),\n('INV-2611-094', '2026-11-22', '16:53', 11, 1, 'Toko', 'Tunai', 0, 0, 'Selesai'),\n('INV-2611-095', '2026-11-22', '19:03', 16, 4, 'Shopee', 'Saldo Marketplace', 0, 22000, 'Selesai'),\n('INV-2611-096', '2026-11-22', '23:55', 17, 4, 'Shopee', 'Saldo Marketplace', 0, 15000, 'Selesai'),\n('INV-2611-097', '2026-11-22', '21:25', 16, 3, 'Shopee', 'Saldo Marketplace', 0, 22000, 'Batal'),\n('INV-2611-098', '2026-11-25', '06:07', 9, 3, 'Shopee', 'Saldo Marketplace', 5, 15000, 'Retur'),\n('INV-2611-099', '2026-11-25', '15:48', 23, 4, 'Tokopedia', 'Saldo Marketplace', 0, 9000, 'Selesai'),\n('INV-2611-100', '2026-11-25', '19:38', NULL, 1, 'Toko', 'QRIS', 0, 0, 'Selesai');",
    "INSERT INTO detail_penjualan (penjualan_id, produk_id, jumlah, harga_satuan) VALUES\n(1, 13, 2, 15000),\n(1, 10, 1, 30000),\n(1, 6, 2, 22000),\n(2, 17, 13, 25000),\n(2, 20, 8, 35000),\n(3, 6, 1, 22000),\n(3, 1, 2, 30000),\n(3, 12, 3, 43000),\n(4, 19, 1, 275000),\n(4, 9, 3, 15000),\n(5, 4, 3, 52000),\n(6, 9, 1, 15000),\n(6, 14, 1, 65000),\n(6, 1, 1, 30000),\n(7, 13, 2, 15000),\n(8, 9, 1, 15000),\n(8, 13, 3, 15000),\n(8, 10, 3, 30000),\n(8, 12, 2, 43000),\n(9, 18, 3, 75000),\n(9, 11, 1, 40000),\n(9, 7, 3, 26000),\n(10, 19, 1, 275000),\n(11, 18, 3, 75000),\n(12, 11, 3, 40000),\n(12, 5, 3, 42000),\n(13, 11, 3, 40000),\n(13, 2, 1, 33000),\n(13, 1, 2, 30000),\n(14, 9, 2, 15000),\n(15, 14, 1, 65000),\n(16, 12, 13, 43000),\n(17, 18, 3, 75000),\n(18, 10, 3, 30000),\n(18, 2, 3, 33000),\n(19, 7, 16, 26000),\n(19, 1, 10, 30000),\n(19, 16, 5, 20000),\n(19, 14, 10, 65000),\n(20, 12, 1, 43000),\n(21, 3, 2, 36000),\n(22, 15, 3, 22000),\n(23, 14, 3, 65000),\n(24, 12, 3, 43000),\n(24, 20, 2, 35000),\n(24, 14, 1, 65000),\n(25, 9, 3, 15000),\n(25, 5, 2, 42000),\n(25, 18, 1, 75000),\n(26, 11, 2, 40000),\n(26, 14, 1, 65000),\n(27, 13, 3, 15000),\n(28, 16, 1, 20000),\n(28, 11, 1, 40000),\n(28, 1, 3, 30000),\n(29, 3, 3, 36000),\n(29, 18, 1, 75000),\n(30, 10, 18, 30000),\n(30, 3, 9, 36000),\n(31, 16, 2, 20000),\n(31, 11, 3, 40000),\n(31, 19, 1, 275000),\n(31, 12, 2, 43000),\n(32, 15, 1, 22000),\n(33, 17, 2, 25000),\n(33, 18, 2, 75000),\n(34, 6, 2, 22000),\n(34, 9, 3, 15000),\n(34, 17, 1, 25000),\n(34, 18, 3, 75000),\n(35, 16, 9, 20000),\n(36, 18, 3, 75000),\n(37, 6, 3, 22000),\n(37, 5, 3, 42000),\n(37, 9, 2, 15000),\n(38, 1, 3, 30000),\n(38, 10, 2, 30000),\n(38, 8, 3, 14000),\n(39, 12, 3, 43000),\n(40, 14, 1, 65000),\n(40, 7, 1, 26000),\n(41, 7, 14, 26000),\n(42, 20, 3, 35000),\n(43, 9, 2, 15000),\n(43, 10, 1, 30000),\n(43, 12, 2, 43000),\n(44, 12, 2, 43000),\n(45, 17, 2, 25000),\n(45, 20, 2, 35000),\n(45, 4, 1, 52000),\n(46, 16, 1, 20000),\n(46, 18, 1, 75000),\n(47, 3, 1, 36000),\n(47, 17, 3, 25000),\n(48, 8, 3, 14000),\n(49, 13, 3, 15000),\n(49, 16, 1, 20000),\n(50, 17, 15, 25000),\n(51, 7, 3, 26000),\n(52, 8, 1, 14000),\n(52, 7, 3, 26000),\n(52, 2, 2, 33000),\n(52, 9, 2, 15000),\n(53, 2, 3, 33000),\n(53, 12, 2, 43000),\n(54, 1, 2, 30000),\n(55, 17, 3, 25000),\n(55, 19, 1, 275000),\n(56, 13, 3, 15000),\n(57, 6, 2, 22000),\n(58, 5, 2, 42000),\n(58, 11, 3, 40000),\n(58, 6, 1, 22000),\n(59, 19, 1, 275000),\n(60, 6, 1, 22000),\n(60, 10, 2, 30000),\n(60, 18, 3, 75000),\n(60, 1, 1, 30000),\n(61, 16, 7, 20000),\n(61, 4, 9, 52000),\n(62, 1, 2, 30000),\n(63, 15, 3, 22000),\n(64, 20, 3, 35000),\n(65, 4, 1, 52000),\n(66, 9, 2, 15000),\n(67, 15, 3, 22000),\n(67, 13, 2, 15000),\n(68, 14, 1, 65000),\n(69, 8, 1, 14000),\n(70, 1, 1, 30000),\n(70, 4, 1, 52000),\n(70, 8, 2, 14000),\n(71, 4, 2, 52000),\n(71, 7, 3, 26000),\n(71, 13, 2, 15000),\n(71, 20, 3, 35000),\n(72, 11, 3, 43000),\n(72, 5, 2, 42000),\n(72, 15, 1, 22000),\n(73, 5, 2, 42000),\n(74, 14, 2, 65000),\n(74, 3, 2, 36000),\n(75, 17, 2, 25000),\n(75, 8, 1, 14000),\n(76, 8, 2, 14000),\n(76, 12, 3, 46000),\n(76, 3, 1, 36000),\n(77, 20, 3, 35000),\n(78, 19, 1, 275000),\n(79, 11, 3, 43000),\n(79, 4, 2, 52000),\n(80, 19, 1, 275000),\n(80, 11, 2, 43000),\n(81, 20, 14, 35000),\n(81, 1, 6, 30000),\n(82, 6, 1, 22000),\n(83, 14, 1, 65000),\n(84, 15, 3, 22000),\n(85, 10, 9, 30000),\n(86, 16, 3, 20000),\n(86, 15, 3, 22000),\n(87, 5, 2, 42000),\n(87, 7, 1, 26000),\n(88, 3, 1, 36000),\n(89, 3, 3, 36000),\n(89, 8, 2, 14000),\n(89, 15, 1, 22000),\n(90, 6, 2, 22000),\n(91, 12, 3, 46000),\n(91, 8, 1, 14000),\n(91, 9, 2, 15000),\n(91, 16, 1, 20000),\n(92, 11, 2, 43000),\n(93, 18, 1, 75000),\n(93, 1, 2, 30000),\n(94, 8, 2, 14000),\n(94, 2, 3, 33000),\n(95, 18, 2, 75000),\n(96, 1, 3, 30000),\n(96, 14, 1, 65000),\n(96, 15, 3, 22000),\n(97, 4, 1, 52000),\n(97, 9, 2, 15000),\n(97, 20, 1, 35000),\n(98, 6, 3, 22000),\n(98, 13, 1, 15000),\n(99, 14, 1, 65000),\n(99, 7, 2, 26000),\n(100, 11, 3, 43000),\n(100, 8, 3, 14000);",
    "CREATE VIEW v_penjualan AS\nSELECT pj.no_nota, pj.tanggal, pj.kanal, pj.metode_bayar, pj.status,\n       COALESCE(pl.nama, 'Pembeli langsung') AS pelanggan,\n       pr.nama AS produk, pr.kategori, d.jumlah, d.harga_satuan,\n       d.jumlah * d.harga_satuan AS subtotal,\n       d.jumlah * (d.harga_satuan - pr.harga_beli) AS laba_kotor\nFROM detail_penjualan d\nJOIN penjualan pj ON pj.id = d.penjualan_id\nJOIN produk pr ON pr.id = d.produk_id\nLEFT JOIN pelanggan pl ON pl.id = pj.pelanggan_id;"
    ],
  akademik: [
    'CREATE DATABASE IF NOT EXISTS akademik;', 'USE akademik;',
    'DROP TABLE IF EXISTS nilai;', 'DROP TABLE IF EXISTS mahasiswa;', 'DROP TABLE IF EXISTS matakuliah;', 'DROP TABLE IF EXISTS dosen;',
    "CREATE TABLE dosen (\n  nidn VARCHAR(10) PRIMARY KEY,\n  nama VARCHAR(80) NOT NULL,\n  prodi VARCHAR(40)\n) ENGINE=InnoDB;",
    "CREATE TABLE mahasiswa (\n  nim VARCHAR(10) PRIMARY KEY,\n  nama VARCHAR(80) NOT NULL,\n  jenis_kelamin ENUM('L','P') NOT NULL,\n  prodi VARCHAR(40) NOT NULL,\n  angkatan INT NOT NULL,\n  kota VARCHAR(40),\n  ipk DECIMAL(3,2)\n) ENGINE=InnoDB;",
    "CREATE TABLE matakuliah (\n  kode VARCHAR(8) PRIMARY KEY,\n  nama VARCHAR(80) NOT NULL,\n  sks INT NOT NULL,\n  semester INT NOT NULL,\n  nidn VARCHAR(10),\n  FOREIGN KEY (nidn) REFERENCES dosen(nidn)\n) ENGINE=InnoDB;",
    "CREATE TABLE nilai (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  nim VARCHAR(10) NOT NULL,\n  kode VARCHAR(8) NOT NULL,\n  nilai_angka DECIMAL(5,2),\n  nilai_huruf CHAR(2),\n  FOREIGN KEY (nim) REFERENCES mahasiswa(nim),\n  FOREIGN KEY (kode) REFERENCES matakuliah(kode)\n) ENGINE=InnoDB;",
    "INSERT INTO dosen VALUES ('0701018801','Mohamad Fahmi Yusuf','Bisnis Digital'),('0712048502','Siti Rahmawati','Teknologi Informasi'),('0703099001','Agus Setiawan','Akuntansi');",
    "INSERT INTO mahasiswa VALUES\n('2401001','Aisyah Putri Ramadhani','P','Bisnis Digital',2024,'Lamongan',3.65),\n('2401002','Bagus Prasetyo','L','Bisnis Digital',2024,'Gresik',3.12),\n('2401003','Citra Dewi Lestari','P','Teknologi Informasi',2024,'Lamongan',3.78),\n('2401004','Dimas Arya Saputra','L','Teknologi Informasi',2024,'Tuban',2.95),\n('2301005','Erlina Wulandari','P','Akuntansi',2023,'Lamongan',3.41),\n('2301006','Fajar Nugroho','L','Akuntansi',2023,'Bojonegoro',2.80),\n('2301007','Gita Ayu Pramesti','P','Bisnis Digital',2023,'Surabaya',3.55),\n('2301008','Hendra Kurniawan','L','Teknologi Informasi',2023,'Lamongan',3.20),\n('2201009','Indah Permatasari','P','Akuntansi',2022,'Gresik',3.88),\n('2201010','Joko Santoso','L','Bisnis Digital',2022,'Lamongan',NULL);",
    "INSERT INTO matakuliah VALUES\n('BD101','Pengantar Bisnis Digital',3,1,'0701018801'),\n('TI201','Algoritma dan Pemrograman',3,2,'0712048502'),\n('TI202','Basis Data',3,3,'0712048502'),\n('AK101','Pengantar Akuntansi',3,1,'0703099001'),\n('BD205','E-Commerce',2,4,'0701018801');",
    "INSERT INTO nilai (nim, kode, nilai_angka, nilai_huruf) VALUES\n('2401001','BD101',88,'A'),('2401001','TI201',79,'AB'),('2401002','BD101',72,'B'),('2401002','TI201',58,'C'),\n('2401003','TI201',92,'A'),('2401003','TI202',85,'A'),('2401004','TI201',64,'BC'),('2401004','TI202',47,'D'),\n('2301005','AK101',81,'A'),('2301006','AK101',55,'C'),('2301007','BD101',77,'AB'),('2301007','BD205',90,'A'),\n('2301008','TI202',70,'B'),('2201009','AK101',95,'A'),('2201010','BD205',62,'BC');"
  ],
  toko: [
    'CREATE DATABASE IF NOT EXISTS toko;', 'USE toko;',
    'DROP TABLE IF EXISTS detail_pesanan;', 'DROP TABLE IF EXISTS pesanan;', 'DROP TABLE IF EXISTS produk;', 'DROP TABLE IF EXISTS pelanggan;',
    "CREATE TABLE pelanggan (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  nama VARCHAR(80) NOT NULL,\n  kota VARCHAR(40),\n  telepon VARCHAR(15) UNIQUE\n);",
    "CREATE TABLE produk (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  nama VARCHAR(80) NOT NULL,\n  kategori VARCHAR(30),\n  harga INT NOT NULL,\n  stok INT DEFAULT 0\n);",
    "CREATE TABLE pesanan (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  pelanggan_id INT NOT NULL,\n  tanggal DATE NOT NULL,\n  status ENUM('baru','dikirim','selesai','batal') DEFAULT 'baru',\n  FOREIGN KEY (pelanggan_id) REFERENCES pelanggan(id)\n);",
    "CREATE TABLE detail_pesanan (\n  pesanan_id INT NOT NULL,\n  produk_id INT NOT NULL,\n  jumlah INT NOT NULL,\n  harga_satuan INT NOT NULL,\n  PRIMARY KEY (pesanan_id, produk_id),\n  FOREIGN KEY (pesanan_id) REFERENCES pesanan(id),\n  FOREIGN KEY (produk_id) REFERENCES produk(id)\n);",
    "INSERT INTO pelanggan (nama, kota, telepon) VALUES ('Rina Kartika','Lamongan','081234500001'),('Budi Hartono','Gresik','081234500002'),('Sari Wulan','Surabaya','081234500003'),('Tono Wijaya','Lamongan','081234500004'),('Maya Anggraini','Tuban','081234500005');",
    "INSERT INTO produk (nama, kategori, harga, stok) VALUES ('Kaos Polos','Pakaian',55000,40),('Kemeja Batik','Pakaian',175000,12),('Tas Rajut','Aksesoris',120000,8),('Topi Bordir','Aksesoris',45000,25),('Sandal Kulit','Alas Kaki',95000,15),('Sepatu Kanvas','Alas Kaki',210000,6);",
    "INSERT INTO pesanan (pelanggan_id, tanggal, status) VALUES (1,'2026-10-02','selesai'),(2,'2026-10-05','selesai'),(1,'2026-10-11','dikirim'),(3,'2026-10-15','selesai'),(4,'2026-10-20','batal'),(5,'2026-11-01','baru'),(3,'2026-11-03','baru');",
    "INSERT INTO detail_pesanan VALUES (1,1,2,55000),(1,4,1,45000),(2,2,1,175000),(3,3,1,120000),(3,1,3,55000),(4,6,1,210000),(4,5,2,95000),(5,4,2,45000),(6,2,2,175000),(7,1,1,55000),(7,3,1,120000);"
  ]
};
var LATIHAN = [
  ['UMKM: penjualan', [
    ['Lihat tabel UMKM', 'USE umkm;\nSHOW TABLES;'],
    ['100 transaksi terakhir', 'SELECT no_nota, tanggal, kanal, metode_bayar, status\nFROM penjualan\nORDER BY tanggal DESC, id DESC\nLIMIT 10;'],
    ['Isi satu nota', "SELECT pr.nama, d.jumlah, d.harga_satuan,\n       d.jumlah * d.harga_satuan AS subtotal\nFROM detail_penjualan d\nJOIN produk pr ON pr.id = d.produk_id\nWHERE d.penjualan_id = 1;"],
    ['Omzet per bulan', "SELECT DATE_FORMAT(pj.tanggal, '%Y-%m') AS bulan,\n       COUNT(DISTINCT pj.id) AS transaksi,\n       SUM(d.jumlah * d.harga_satuan) AS omzet\nFROM penjualan pj\nJOIN detail_penjualan d ON d.penjualan_id = pj.id\nWHERE pj.status = 'Selesai'\nGROUP BY bulan\nORDER BY bulan;"],
    ['Produk terlaris', "SELECT pr.nama, pr.kategori, SUM(d.jumlah) AS terjual\nFROM detail_penjualan d\nJOIN produk pr ON pr.id = d.produk_id\nJOIN penjualan pj ON pj.id = d.penjualan_id\nWHERE pj.status = 'Selesai'\nGROUP BY pr.id\nORDER BY terjual DESC\nLIMIT 5;"],
    ['Laba kotor per kategori', "SELECT kategori,\n       SUM(subtotal) AS omzet,\n       SUM(laba_kotor) AS laba_kotor,\n       ROUND(SUM(laba_kotor) * 100.0 / SUM(subtotal), 1) AS margin_persen\nFROM v_penjualan\nWHERE status = 'Selesai'\nGROUP BY kategori\nORDER BY laba_kotor DESC;"],
    ['Penjualan per kanal', "SELECT kanal, COUNT(*) AS transaksi\nFROM penjualan\nWHERE status = 'Selesai'\nGROUP BY kanal\nORDER BY transaksi DESC;"],
    ['Pelanggan paling loyal', "SELECT pl.nama, pl.kota, pl.tipe, COUNT(pj.id) AS kali_belanja\nFROM pelanggan pl\nJOIN penjualan pj ON pj.pelanggan_id = pl.id\nGROUP BY pl.id\nHAVING COUNT(pj.id) >= 3\nORDER BY kali_belanja DESC;"],
    ['Pembeli langsung (tanpa akun)', 'SELECT COUNT(*) AS jumlah\nFROM penjualan\nWHERE pelanggan_id IS NULL;'],
    ['Hari paling ramai', "SELECT DAYNAME(tanggal) AS hari, COUNT(*) AS transaksi\nFROM penjualan\nGROUP BY hari\nORDER BY transaksi DESC;"],
    ['Stok menipis', 'SELECT nama, stok FROM produk\nWHERE stok < 15\nORDER BY stok;']
  ]],
  ['Dasar', [
    ['Lihat semua database', 'SHOW DATABASES;'],
    ['Pilih database', 'USE akademik;\nSHOW TABLES;'],
    ['Struktur tabel', 'DESCRIBE mahasiswa;'],
    ['Semua data', 'SELECT * FROM mahasiswa;'],
    ['Kolom tertentu', 'SELECT nim, nama, prodi FROM mahasiswa;']
  ]],
  ['Filter dan urutan', [
    ['WHERE', "SELECT nama, kota, ipk\nFROM mahasiswa\nWHERE kota = 'Lamongan';"],
    ['AND / OR', "SELECT nama, prodi, ipk\nFROM mahasiswa\nWHERE prodi = 'Bisnis Digital' AND ipk >= 3.5;"],
    ['LIKE', "SELECT nama FROM mahasiswa\nWHERE nama LIKE '%Putri%';"],
    ['BETWEEN dan IN', "SELECT nama, angkatan, ipk FROM mahasiswa\nWHERE ipk BETWEEN 3.0 AND 3.6\n  AND angkatan IN (2023, 2024);"],
    ['IS NULL', 'SELECT nim, nama FROM mahasiswa WHERE ipk IS NULL;'],
    ['ORDER BY dan LIMIT', 'SELECT nama, ipk FROM mahasiswa\nORDER BY ipk DESC\nLIMIT 3;']
  ]],
  ['Agregasi', [
    ['COUNT, AVG, MAX', 'SELECT COUNT(*) AS jumlah,\n       ROUND(AVG(ipk), 2) AS rata_ipk,\n       MAX(ipk) AS ipk_tertinggi\nFROM mahasiswa;'],
    ['GROUP BY', 'SELECT prodi, COUNT(*) AS jumlah, ROUND(AVG(ipk), 2) AS rata_ipk\nFROM mahasiswa\nGROUP BY prodi;'],
    ['HAVING', 'SELECT kota, COUNT(*) AS jumlah\nFROM mahasiswa\nGROUP BY kota\nHAVING COUNT(*) >= 2;']
  ]],
  ['Relasi (JOIN)', [
    ['INNER JOIN', 'SELECT m.nama, mk.nama AS matakuliah, n.nilai_angka, n.nilai_huruf\nFROM nilai n\nJOIN mahasiswa m ON m.nim = n.nim\nJOIN matakuliah mk ON mk.kode = n.kode\nORDER BY m.nama;'],
    ['LEFT JOIN', 'SELECT m.nama, COUNT(n.id) AS jumlah_mk\nFROM mahasiswa m\nLEFT JOIN nilai n ON n.nim = m.nim\nGROUP BY m.nim, m.nama;'],
    ['Tiga tabel + dosen', 'SELECT mk.nama AS matakuliah, d.nama AS dosen, COUNT(n.id) AS peserta\nFROM matakuliah mk\nJOIN dosen d ON d.nidn = mk.nidn\nLEFT JOIN nilai n ON n.kode = mk.kode\nGROUP BY mk.kode;']
  ]],
  ['Subquery dan VIEW', [
    ['Subquery', 'SELECT nama, ipk FROM mahasiswa\nWHERE ipk > (SELECT AVG(ipk) FROM mahasiswa);'],
    ['CREATE VIEW', "CREATE VIEW v_transkrip AS\nSELECT m.nim, m.nama, mk.nama AS matakuliah, n.nilai_huruf\nFROM nilai n\nJOIN mahasiswa m ON m.nim = n.nim\nJOIN matakuliah mk ON mk.kode = n.kode;\n\nSELECT * FROM v_transkrip WHERE nim = '2401001';"]
  ]],
  ['Ubah data (DML)', [
    ['INSERT', "INSERT INTO mahasiswa (nim, nama, jenis_kelamin, prodi, angkatan, kota, ipk)\nVALUES ('2401011', 'Kartika Sari', 'P', 'Teknologi Informasi', 2024, 'Lamongan', 3.30);"],
    ['UPDATE', "UPDATE mahasiswa SET kota = 'Surabaya'\nWHERE nim = '2401011';"],
    ['DELETE', "DELETE FROM mahasiswa WHERE nim = '2401011';"],
    ['Coba langgar FOREIGN KEY', "INSERT INTO nilai (nim, kode, nilai_angka) VALUES ('9999999', 'TI201', 80);"]
  ]],
  ['Struktur (DDL)', [
    ['CREATE DATABASE dan TABLE', "CREATE DATABASE latihan;\nUSE latihan;\n\nCREATE TABLE buku (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  judul VARCHAR(100) NOT NULL,\n  penulis VARCHAR(80),\n  tahun INT,\n  harga DECIMAL(10,2) DEFAULT 0\n) ENGINE=InnoDB;\n\nDESCRIBE buku;"],
    ['ALTER TABLE ADD', 'ALTER TABLE buku ADD COLUMN stok INT DEFAULT 0;\nDESCRIBE buku;'],
    ['DROP TABLE', 'DROP TABLE buku;']
  ]],
  ['Toko online', [
    ['Muat dulu database toko', 'USE toko;\nSHOW TABLES;'],
    ['Total belanja per pesanan', "SELECT p.id, pl.nama, p.tanggal,\n       SUM(d.jumlah * d.harga_satuan) AS total\nFROM pesanan p\nJOIN pelanggan pl ON pl.id = p.pelanggan_id\nJOIN detail_pesanan d ON d.pesanan_id = p.id\nWHERE p.status <> 'batal'\nGROUP BY p.id\nORDER BY total DESC;"],
    ['Produk terlaris', 'SELECT pr.nama, SUM(d.jumlah) AS terjual\nFROM detail_pesanan d\nJOIN produk pr ON pr.id = d.produk_id\nGROUP BY pr.id\nORDER BY terjual DESC;']
  ]]
];

/* ===================== antarmuka ===================== */
function sisip(sql) {
  var ed = $('#editor');
  ed.value = sql; ed.focus(); ed.setSelectionRange(sql.length, sql.length);
  barisNo(); tutupLaci();
}
function barisNo() {
  var n = $('#editor').value.split('\n').length;
  var s = ''; for (var i = 1; i <= Math.max(n, 1); i++) s += i + '\n';
  $('#gutter').textContent = s;
}
function perintahDiKursor() {
  var ed = $('#editor'), v = ed.value, pos = ed.selectionStart;
  if (ed.selectionEnd > ed.selectionStart) return v.slice(ed.selectionStart, ed.selectionEnd);
  var a = v.lastIndexOf(';', pos - 1), b = v.indexOf(';', pos);
  if (b >= 0 && v.slice(pos, b).trim() === '' && a >= 0) { b = a; a = v.lastIndexOf(';', a - 1); }
  return v.slice(a + 1, b < 0 ? v.length : b + 1);
}
function eksekusi(teks) {
  var out = jalankan(teks);
  render(out); renderStruktur();
  if (window.matchMedia('(max-width: 900px)').matches) $('#hasil').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function muatContoh(nama) {
  var out = jalankan(CONTOH[nama].join('\n'));
  var gagal = out.filter(function (o) { return o.err; });
  render(gagal.length ? gagal : [{ sql: 'Muat database contoh: ' + nama, r: { pesan: 'Database "' + nama + '" siap dipakai. Tabel: ' + daftarTabel(dbs[nama]).map(function (v) { return v[0]; }).join(', ') + '.', waktu: 0 } }]);
  renderStruktur();
  if (!$('#editor').value.trim()) sisip('SHOW TABLES;');
}
function dumpSql() {
  if (!cur) return alert('Belum ada database yang dipilih.');
  var db = dbs[cur], out = ['-- Ekspor dari Lab SQL SIPANDA', '-- Database: ' + cur, 'CREATE DATABASE IF NOT EXISTS `' + cur + '`;', 'USE `' + cur + '`;', ''];
  daftarTabel(db).forEach(function (v) {
    var sq = db.exec("SELECT sql FROM sqlite_master WHERE name = '" + v[0].replace(/'/g, "''") + "'")[0].values[0][0];
    out.push(sq.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/ig, 'INT AUTO_INCREMENT PRIMARY KEY') + ';');
    if (v[1] === 'table') {
      var r = db.exec('SELECT * FROM ' + q(v[0]));
      if (r.length) out.push('INSERT INTO `' + v[0] + '` VALUES\n' + r[0].values.map(function (row) {
        return '(' + row.map(function (x) { return x === null ? 'NULL' : (typeof x === 'number' ? x : "'" + String(x).replace(/'/g, "''") + "'"); }).join(', ') + ')';
      }).join(',\n') + ';');
    }
    out.push('');
  });
  var blob = new Blob([out.join('\n')], { type: 'text/sql' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = cur + '.sql'; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function resetSemua() {
  if (!confirm('Hapus semua database di browser ini? Data latihan akan hilang.')) return;
  Object.keys(dbs).forEach(function (n) { dbs[n].close(); }); dbs = {}; cur = '';
  try { localStorage.removeItem(kunci()); } catch (e) {}
  render([{ sql: 'Reset', r: { pesan: 'Semua database dihapus. Muat contoh atau buat database baru.', waktu: null } }]);
  renderStruktur();
}
function bukaLaci() { document.body.classList.add('laci'); }
function tutupLaci() { document.body.classList.remove('laci'); }

function siapkanUI() {
  var ed = $('#editor');
  ed.addEventListener('input', barisNo);
  ed.addEventListener('scroll', function () { $('#gutter').scrollTop = ed.scrollTop; });
  ed.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); eksekusi(e.shiftKey ? perintahDiKursor() : ed.value); return; }
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); var s = ed.selectionStart; ed.setRangeText('  ', s, ed.selectionEnd, 'end'); barisNo(); }
  });
  $('#btnJalan').addEventListener('click', function () { eksekusi(ed.value); });
  $('#btnBaris').addEventListener('click', function () { eksekusi(perintahDiKursor()); });
  $('#btnBersih').addEventListener('click', function () { ed.value = ''; barisNo(); ed.focus(); });
  $('#pilihDb').addEventListener('change', function () { if (this.value) { cur = this.value; simpan(); renderStruktur(); render([{ sql: 'USE ' + cur, r: { pesan: 'Database changed', waktu: null } }]); } });
  $('#btnAkademik').addEventListener('click', function () { muatContoh('akademik'); });
  $('#btnToko').addEventListener('click', function () { muatContoh('toko'); });
  $('#btnDump').addEventListener('click', dumpSql);
  $('#btnReset').addEventListener('click', resetSemua);
  $('#btnLaci').addEventListener('click', bukaLaci);
  $('#tutupLaci').addEventListener('click', tutupLaci);
  $('#selubung').addEventListener('click', tutupLaci);
  document.querySelectorAll('[name="mode"]').forEach(function (r) {
    r.addEventListener('change', function () { mode = this.value; try { localStorage.setItem(SIMPAN + '-mode', mode); } catch (e) {} var o = window.__terakhir; if (o) render(o); });
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ins]'); if (b) { sisip(b.getAttribute('data-ins')); return; }
    var c = e.target.closest('[data-contoh]'); if (c) { var it = LATIHAN[+c.dataset.g][1][+c.dataset.i]; sisip(it[1]); }
  });
  $('#latihan').innerHTML = LATIHAN.map(function (g, gi) {
    return '<div class="lg"><h4>' + esc(g[0]) + '</h4>' + g[1].map(function (it, ii) { return '<button type="button" data-contoh data-g="' + gi + '" data-i="' + ii + '">' + esc(it[0]) + '</button>'; }).join('') + '</div>';
  }).join('');
  var renderAsli = render;
  render = function (o) { window.__terakhir = o; renderAsli(o); };
  try { mode = localStorage.getItem(SIMPAN + '-mode') || 'tabel'; riwayat = JSON.parse(localStorage.getItem(SIMPAN + '-riwayat') || '[]'); } catch (e) {}
  document.querySelector('[name="mode"][value="' + mode + '"]').checked = true;
}

/* ===================== gerbang masuk (NIM terdaftar di SIPANDA) ===================== */
function kirim(d) {
  var ctl = window.AbortController ? new AbortController() : null;
  var to = setTimeout(function () { if (ctl) ctl.abort(); }, 25000);
  return fetch(API, { method: 'POST', body: JSON.stringify(d), signal: ctl ? ctl.signal : undefined, redirect: 'follow' })
    .then(function (r) { return r.json(); })
    .then(function (j) { clearTimeout(to); return j; }, function (e) {
      clearTimeout(to);
      throw new Error(e && e.name === 'AbortError' ? 'Server SIPANDA tidak menjawab. Periksa sinyal lalu coba lagi.' : 'Tidak bisa terhubung ke SIPANDA. Periksa sinyal lalu coba lagi.');
    });
}
function bacaExp(t) {
  try { var b = String(t).split('.')[0].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4))))).e || 0; } catch (e) { return 0; }
}
function simpanAkun(t, j) {
  var a = { t: t, nama: j.nama, nim: j.nim, peran: j.peran, exp: bacaExp(t) };
  try { localStorage.setItem(AUTH, JSON.stringify(a)); } catch (e) {}
  return a;
}
function tampilLogin(pesan) {
  document.body.classList.remove('masuk');
  document.body.classList.add('gerbang');
  var e = $('#gErr'); e.textContent = pesan || ''; e.hidden = !pesan;
  setTimeout(function () { var n = $('#gNim'); if (n) n.focus(); }, 50);
}
function keluar(pesan) {
  if (window.__modeLogin) window.__modeLogin(false);
  try { localStorage.removeItem(AUTH); } catch (e) {}
  Object.keys(dbs).forEach(function (n) { try { dbs[n].close(); } catch (e) {} });
  dbs = {}; cur = ''; akun = null;
  tampilLogin(pesan);
}
function masuk(a) {
  akun = a;
  document.body.classList.remove('gerbang'); document.body.classList.add('masuk');
  $('#siapa').textContent = a.peran === 'dosen' ? 'Dosen' : a.nama;
  $('#siapaNim').textContent = a.peran === 'dosen' ? 'akses dosen' : a.nim;
  var mulai = function () {
    Object.keys(dbs).forEach(function (n) { try { dbs[n].close(); } catch (e) {} }); dbs = {}; cur = '';
    if (!muat()) {
      muatContoh('akademik'); muatContoh('umkm');
      sisip("SELECT no_nota, tanggal, kanal, metode_bayar, status\nFROM penjualan\nORDER BY tanggal DESC\nLIMIT 10;");
      render([{ sql: 'Selamat datang', r: { pesan: 'Halo, ' + (a.peran === 'dosen' ? 'Dosen' : a.nama) + '. Database contoh "akademik" dan "umkm" sudah dimuat. Database aktif: umkm.', waktu: null } }]);
    } else { renderStruktur(); render([{ sql: 'Selamat datang kembali', r: { pesan: 'Database latihan Anda sudah dimuat. Database aktif: ' + (cur || '(belum dipilih)'), waktu: null } }]); }
    document.body.classList.add('siap');
  };
  if (SQL) return mulai();
  initSqlJs({ locateFile: function (f) { return f; } }).then(function (S) { SQL = S; mulai(); }).catch(function (e) {
    $('#hasil').innerHTML = '<section class="blok err"><pre class="msg">Mesin SQL gagal dimuat: ' + esc(e.message || e) + '</pre><p class="saran">Muat ulang halaman. Pastikan file sql-wasm.wasm ikut diunggah ke folder yang sama.</p></section>';
  });
}
function gerbang() {
  var m = /[#&]t=([\w.-]+)/.exec(location.hash);
  if (m) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    $('#gInfo').textContent = 'Memeriksa akses...';
    kirim({ aksi: 'cek', t: m[1] }).then(function (j) {
      $('#gInfo').textContent = '';
      if (j.ok) masuk(simpanAkun(m[1], j)); else tampilLogin(j.pesan);
    }, function (e) { $('#gInfo').textContent = ''; tampilLogin(e.message); });
    return;
  }
  var a = null;
  try { a = JSON.parse(localStorage.getItem(AUTH) || 'null'); } catch (e) {}
  if (a && a.t && a.exp > Date.now()) {
    masuk(a);
    // diperiksa ulang di belakang: bila NIM sudah dihapus dari kelas, akses dicabut
    kirim({ aksi: 'cek', t: a.t }).then(function (j) { if (!j.ok) keluar(j.pesan); }, function () {});
    return;
  }
  tampilLogin(a ? 'Sesi sudah berakhir. Silakan masuk lagi.' : '');
}

window.addEventListener('DOMContentLoaded', function () {
  siapkanUI(); barisNo();
  var buatPin = false, pinLen = 6;
  var aturPanjang = function (n) {
    n = Number(n); if (!(n >= 4 && n <= 8)) return;
    pinLen = n;
    ['#gPin', '#gPin1', '#gPin2'].forEach(function (id) { $(id).maxLength = n; });
    $('#gLbl1').textContent = 'PIN baru (' + n + ' angka)';
  };
  // panjang PIN mengikuti pengaturan SIPANDA
  kirim({ aksi: 'info' }).then(function (j) { if (j && j.ok) aturPanjang(j.panjangPin); }, function () {});
  window.__modeLogin = function (baru) {
    buatPin = baru;
    $('#gLama').hidden = baru; $('#gBaru').hidden = !baru; $('#gNim').readOnly = baru;
    $('#gJudul').textContent = baru ? 'Buat PIN' : 'Masuk ke Lab SQL';
    $('#gSub').textContent = baru ? 'NIM ini belum punya PIN. Buat PIN sendiri. PIN yang sama dipakai juga di Portal Nilai dan Kuis.'
      : 'Khusus mahasiswa yang terdaftar di kelas SIPANDA. Gunakan NIM dan PIN yang sama dengan Portal Nilai dan Kuis.';
    $('#gBtn').textContent = baru ? 'Simpan PIN dan Masuk' : 'Masuk';
    $('#gFoot').innerHTML = baru ? '<a href="#" id="gBatal">Bukan NIM saya, kembali</a>' : 'Baru pertama kali? Isi NIM saja, lalu buat PIN sendiri. Lupa PIN? Minta dosen meresetnya.';
    if (baru) { $('#gBatal').onclick = function (ev) { ev.preventDefault(); $('#gErr').hidden = true; window.__modeLogin(false); }; $('#gPin1').focus(); }
  };
  $('#gForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var b = $('#gBtn'), nim = $('#gNim').value.trim(), label = b.textContent;
    if (!nim) { tampilLogin('Isi NIM terlebih dahulu.'); return; }
    var d = { aksi: 'login', nim: nim, pin: $('#gPin').value.trim() };
    if (buatPin) {
      var p1 = $('#gPin1').value.trim(), p2 = $('#gPin2').value.trim();
      if (!new RegExp('^\\d{' + pinLen + '}$').test(p1)) { tampilLogin('PIN harus ' + pinLen + ' angka.'); return; }
      if (p1 !== p2) { tampilLogin('Kedua PIN tidak sama. Ketik ulang.'); return; }
      d = { aksi: 'buatPin', nim: nim, pin: p1 };
    }
    b.disabled = true; b.textContent = 'Memeriksa...'; $('#gErr').hidden = true;
    kirim(d).then(function (j) {
      b.disabled = false; b.textContent = label;
      if (j.ok) {
        $('#gPin').value = $('#gPin1').value = $('#gPin2').value = '';
        if (buatPin) window.__modeLogin(false);
        masuk(simpanAkun(j.t, j));
      } else if (j.perluPin) { aturPanjang(j.panjangPin); window.__modeLogin(true); }
      else tampilLogin(j.pesan);
    }, function (err) { b.disabled = false; b.textContent = label; tampilLogin(err.message); });
  });
  $('#btnKeluar').addEventListener('click', function () { if (confirm('Keluar dari Lab SQL? Data latihan tetap tersimpan di perangkat ini.')) keluar(''); });
  gerbang();
  // mesin SQL disiapkan sambil menunggu login
  initSqlJs({ locateFile: function (f) { return f; } }).then(function (S) { if (!SQL) SQL = S; }, function () {});
});

// untuk pengujian
window.__lab = { jalankan: jalankan, terjemah: terjemah, dbs: function () { return dbs; }, masuk: masuk };
})();
