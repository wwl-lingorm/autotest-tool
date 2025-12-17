const path = require('path');
const fs = require('fs');
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  throw new Error('Please install dependency `better-sqlite3` in backend: run `npm install better-sqlite3`');
}

const DB_PATH = path.join(__dirname, 'autotest.db');
const db = new Database(DB_PATH);

// initialize
db.exec(`
CREATE TABLE IF NOT EXISTS testcases (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT
);
`);

const getAllStmt = db.prepare('SELECT data FROM testcases ORDER BY createdAt DESC');
const getOneStmt = db.prepare('SELECT data FROM testcases WHERE id = ?');
const insertStmt = db.prepare('INSERT OR REPLACE INTO testcases (id, data, createdAt, updatedAt) VALUES (?, ?, ?, ?)');
const deleteStmt = db.prepare('DELETE FROM testcases WHERE id = ?');

function parseRow(row) {
  if (!row) return null;
  try { return JSON.parse(row.data); } catch (e) { return null; }
}

function getAllTestcases() {
  const rows = getAllStmt.all();
  return rows.map(r => parseRow(r)).filter(Boolean);
}

function getTestcase(id) {
  const row = getOneStmt.get(id);
  return parseRow(row);
}

function upsertTestcase(obj) {
  const now = new Date().toISOString();
  if (!obj.id) {
    obj.id = `TC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    obj.createdAt = now;
  }
  obj.updatedAt = now;
  const data = JSON.stringify(obj);
  insertStmt.run(obj.id, data, obj.createdAt || now, obj.updatedAt);
  return obj;
}

function deleteTestcase(id) {
  const existing = getTestcase(id);
  if (!existing) return null;
  deleteStmt.run(id);
  return existing;
}

module.exports = { getAllTestcases, getTestcase, upsertTestcase, deleteTestcase, DB_PATH };
