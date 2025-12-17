const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Runner adapter with queue, concurrency and timeout
const logsDir = path.join(__dirname, 'logs');
const reportsDir = path.join(__dirname, 'reports');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);

const QUEUE = [];
let runningCount = 0;
const CONCURRENCY = parseInt(process.env.RUNNER_CONCURRENCY || '2', 10);
const DEFAULT_TIMEOUT = parseInt(process.env.RUNNER_TIMEOUT_MS || '120000', 10);

const RESULTS = new Map();

function enqueue(task) {
  return new Promise((resolve) => {
    QUEUE.push({ task, resolve });
    processQueue();
  });
}

function processQueue() {
  if (runningCount >= CONCURRENCY) return;
  const item = QUEUE.shift();
  if (!item) return;
  runningCount++;
  item.task()
    .then((r) => item.resolve(r))
    .catch((e) => item.resolve({ error: e.message }))
    .finally(() => {
      runningCount--;
      processQueue();
    });
}

async function runTests(id, options = {}) {
  return enqueue(async () => {
    const start = new Date();
    const result = { id, status: 'running', startedAt: start.toISOString() };

    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT;
    const logName = options.logName || `${id}-${Date.now()}.log`;
    const logFile = path.join(logsDir, logName);
    const outStream = fs.createWriteStream(logFile, { flags: 'a' });

    // determine command
    const cmd = options.cmd || process.env.RUNNER_CMD || null;
    const args = options.args || [];

    if (!cmd) {
      result.status = 'skipped';
      result.endedAt = new Date().toISOString();
      result.log = 'No runner command configured. Set RUNNER_CMD env or pass options.cmd.';
      fs.writeFileSync(logFile, result.log);
      RESULTS.set(id, result);
      return result;
    }

    let child;
    try {
      child = spawn(cmd, args, { shell: false });
    } catch (e) {
      outStream.write('\nERROR spawn: ' + String(e));
      outStream.end();
      result.endedAt = new Date().toISOString();
      result.status = 'error';
      result.error = e.message;
      RESULTS.set(id, result);
      return result;
    }

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        try { child.kill(); } catch (e) {}
      }
    }, timeoutMs);

    if (child.stdout) child.stdout.on('data', (d) => { const s = d.toString(); stdout += s; outStream.write(s); });
    if (child.stderr) child.stderr.on('data', (d) => { const s = d.toString(); stderr += s; outStream.write(s); });

    const exitInfo = await new Promise((resolve) => {
      child.on('error', (err) => { outStream.write('\nERROR: ' + err.message); resolve({ code: 1, err }); });
      child.on('close', (code, signal) => { clearTimeout(timer); finished = true; resolve({ code, signal }); });
    });

    outStream.end();

    result.endedAt = new Date().toISOString();
    result.stdout = stdout;
    result.stderr = stderr;
    result.logFile = `/logs/${path.basename(logFile)}`;

    // default status mapping
    if (exitInfo && exitInfo.code === 0) result.status = 'passed';
    else result.status = 'failed';
    result.exit = exitInfo;

    // If runner produced a report file (for robot/qtest), try to attach it
    try {
      const candidate = path.join(reportsDir, `report-${id}.json`);
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, 'utf8');
        result.report = JSON.parse(raw);
      }
    } catch (e) {
      // ignore parse errors
    }

    RESULTS.set(id, result);
    return result;
  });
}

function getResult(id) {
  return RESULTS.has(id) ? RESULTS.get(id) : null;
}

module.exports = { runTests, getResult };
