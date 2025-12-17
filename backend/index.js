const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { runTests, getResult } = require('./run_test_agent');
let multer = null;
try {
  multer = require('multer');
} catch (e) {
  console.warn('Optional dependency `multer` not installed — upload endpoints are disabled.');
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = require('./db');

// Note: testcases are now persisted in SQLite via `backend/db.js`.
// For legacy migration, run: `node backend/scripts/migrate_to_sqlite.js`

app.get('/api/testcases', (req, res) => {
  try { res.json(db.getAllTestcases()); } catch (e) { res.status(500).json({ error: e.message }); }
});

// create
function genId() {
  return `TC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}

app.post('/api/testcases', (req, res) => {
  try {
    const item = req.body || {};
    const saved = db.upsertTestcase(item);
    res.status(201).json(saved);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// update
app.put('/api/testcases/:id', (req, res) => {
  const id = req.params.id;
  try {
    const existing = db.getTestcase(id);
    if (!existing) return res.status(404).json({ error: 'not found' });
    const merged = Object.assign({}, existing, req.body);
    const saved = db.upsertTestcase(merged);
    res.json(saved);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// delete
app.delete('/api/testcases/:id', (req, res) => {
  const id = req.params.id;
  try {
    const removed = db.deleteTestcase(id);
    if (!removed) return res.status(404).json({ error: 'not found' });
    res.json(removed);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// setup uploads for baselines
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (multer) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  });
  const upload = multer({ storage });

  app.post('/api/upload-baseline', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'no file' });
    const url = `/uploads/${req.file.filename}`;
    res.json({ filename: req.file.filename, url });
  });
} else {
  app.post('/api/upload-baseline', (req, res) => {
    res.status(501).json({ error: 'upload disabled: optional dependency `multer` not installed. Run `npm install multer` in backend to enable.' });
  });
}

app.use('/uploads', express.static(uploadsDir));

// Import testcases: accept JSON array in body or uploaded CSV (multipart/form-data with 'file')
async function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(l => {
    const cols = l.split(',').map(c => c.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
    return obj;
  });
}

// If multer available, allow file upload for import under '/api/import'
if (multer) {
  const upload = multer();
  app.post('/api/import', upload.single('file'), async (req, res) => {
    try {
      if (req.file) {
        const content = req.file.buffer.toString('utf8');
        const items = await parseCsv(content);
        const list = readTestcases();
        for (const it of items) {
          if (!it.id) it.id = genId();
          list.push(it);
        }
        writeTestcases(list);
        res.json({ imported: items.length });
      } else if (Array.isArray(req.body)) {
        const list = readTestcases();
        for (const it of req.body) { if (!it.id) it.id = genId(); list.push(it); }
        writeTestcases(list);
        res.json({ imported: req.body.length });
      } else {
        res.status(400).json({ error: 'no file or invalid body' });
      }
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
} else {
  app.post('/api/import', express.json(), async (req, res) => {
    try {
      if (Array.isArray(req.body)) {
        const list = readTestcases();
        for (const it of req.body) { if (!it.id) it.id = genId(); list.push(it); }
        writeTestcases(list);
        res.json({ imported: req.body.length });
      } else {
        res.status(400).json({ error: 'multer not installed; send JSON array in request body' });
      }
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
}

// Export testcases as JSON or CSV
app.get('/api/export', (req, res) => {
  const fmt = (req.query.format || 'json').toLowerCase();
  const list = readTestcases();
  if (fmt === 'csv') {
    // simple CSV: flatten keys title,preconditions,steps,assertions,baseline,id
    const rows = [['id','title','preconditions','baseline']];
    for (const t of list) rows.push([t.id||'', t.title||'', (t.preconditions||[]).join('|'), t.baseline||'']);
    const csv = rows.map(r => r.map(c=>String(c).replace(/"/g,'""')).join(',')).join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="testcases.csv"');
    res.send(csv);
  } else {
    res.json(list);
  }
});

app.post('/api/run', async (req, res) => {
  const { ids, options } = req.body || {};
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be array' });

  try {
    const results = [];
    for (const id of ids) {
      // allow passing per-run options or global options
      const opt = (options && options[id]) || options || {};
      const r = await runTests(id, opt);
      results.push(r);
    }
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// async run: enqueue runs and return job descriptors (id + logFile) immediately
app.post('/api/run-async', (req, res) => {
  const { ids, options } = req.body || {};
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be array' });
  const jobs = [];
  for (const id of ids) {
    const logName = `${id}-${Date.now()}.log`;
    const opt = (options && options[id]) || options || {};
    opt.logName = logName;
    // start run but do not await
    runTests(id, opt).catch(() => {});
    jobs.push({ id, logFile: `/logs/${logName}` });
  }
  res.json({ jobs });
});

// query results for ids (returns any completed results cached by runner)
app.get('/api/run-results', (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean);
  if (ids.length === 0) return res.status(400).json({ error: 'ids query required' });
  const out = [];
  for (const id of ids) {
    const r = getResult(id);
    if (r) out.push(r);
  }
  res.json({ results: out });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Autotest backend listening on ${PORT}`));

// serve logs statically and provide SSE streaming endpoint
const logsStatic = path.join(__dirname, 'logs');
if (fs.existsSync(logsStatic)) app.use('/logs', express.static(logsStatic));

// serve reports directory so frontend/CI can download persisted JSON reports
const reportsStatic = path.join(__dirname, 'reports');
if (!fs.existsSync(reportsStatic)) fs.mkdirSync(reportsStatic);
app.use('/reports', express.static(reportsStatic));

app.get('/api/stream', (req, res) => {
  // SSE endpoint: ?file=<filename>
  const file = req.query.file;
  if (!file) return res.status(400).end('file required');
  const filepath = path.join(__dirname, 'logs', path.basename(file));
  if (!fs.existsSync(filepath)) return res.status(404).end('not found');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  // send existing content then watch for changes
  const sendChunk = (chunk) => res.write(`data: ${chunk.replace(/\n/g,'\\n')}\n\n`);
  const stream = fs.createReadStream(filepath, { encoding: 'utf8' });
  stream.on('data', (c) => sendChunk(c));

  const watcher = fs.watch(filepath, (ev) => {
    if (ev === 'change') {
      // read tail
      try {
        const tail = fs.readFileSync(filepath, 'utf8');
        sendChunk(tail);
      } catch (e) {}
    }
  });

  req.on('close', () => {
    try { stream.close(); } catch (e) {}
    try { watcher.close(); } catch (e) {}
  });
});

// Run Robot Framework via Python runner (enqueue)
app.post('/api/run-robot', (req, res) => {
  const { ids, suiteDir } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
  const pythonCmd = process.env.PYTHON_CMD || 'python';
  const jobs = [];
  for (const id of ids) {
    const logName = `${id}-${Date.now()}.log`;
    const sd = suiteDir || 'smoke/robot';
    const opt = {
      cmd: pythonCmd,
      args: ['scripts/run_robot.py', '--suite-dir', sd, '--output-dir', 'reports', '--run-id', id],
      logName,
      type: 'robot'
    };
    runTests(id, opt).catch(() => {});
    jobs.push({ id, logFile: `/logs/${logName}`, report: `/reports/report-${id}.json` });
  }
  res.json({ jobs });
});

// Run QTest binary via Python adapter (enqueue)
app.post('/api/run-qtest', (req, res) => {
  const { ids, bin } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
  if (!bin) return res.status(400).json({ error: 'bin path required' });
  const pythonCmd = process.env.PYTHON_CMD || 'python';
  const jobs = [];
  for (const id of ids) {
    const logName = `${id}-${Date.now()}.log`;
    const opt = {
      cmd: pythonCmd,
      args: ['scripts/run_qtest.py', '--bin', bin, '--output-dir', 'reports', '--run-id', id],
      logName,
      type: 'qtest'
    };
    runTests(id, opt).catch(() => {});
    jobs.push({ id, logFile: `/logs/${logName}`, report: `/reports/report-${id}.json` });
  }
  res.json({ jobs });
});
