const fs = require('fs');
const path = require('path');

// Simple report merger: read all log files in ../logs and produce report.json + report.csv
const logsDir = path.join(__dirname, '..', 'logs');
const outDir = path.join(__dirname, '..', 'reports');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function summarizeLogs() {
  const files = fs.existsSync(logsDir) ? fs.readdirSync(logsDir) : [];
  const report = [];
  for (const f of files) {
    try {
      const content = fs.readFileSync(path.join(logsDir, f), 'utf8');
      // try to guess status
      let status = 'unknown';
      if (/passed/i.test(content) || /OK\b/i.test(content)) status = 'passed';
      if (/failed/i.test(content) || /ERROR/i.test(content)) status = 'failed';
      report.push({ file: f, status, snippet: content.slice(0, 400) });
    } catch (e) {}
  }
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

  const csv = ['file,status,snippet'];
  for (const r of report) csv.push(`${r.file},${r.status},"${(r.snippet||'').replace(/"/g,'""')}"`);
  fs.writeFileSync(path.join(outDir, 'report.csv'), csv.join('\n'), 'utf8');
  console.log('Reports written to', outDir);
}

summarizeLogs();
