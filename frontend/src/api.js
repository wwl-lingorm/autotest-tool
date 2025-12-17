const API_ROOT = import.meta.env.VITE_API_ROOT || 'http://localhost:4000'

export async function fetchTestcases() {
  const r = await fetch(`${API_ROOT}/api/testcases`)
  if (!r.ok) throw new Error('fetch failed')
  return r.json()
}

export async function runTestcases(ids) {
  const r = await fetch(`${API_ROOT}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  })
  if (!r.ok) throw new Error('run failed')
  return r.json()
}

export async function createTestcase(item) {
  const r = await fetch(`${API_ROOT}/api/testcases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  })
  if (!r.ok) throw new Error('create failed')
  return r.json()
}

export async function updateTestcase(id, item) {
  const r = await fetch(`${API_ROOT}/api/testcases/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  })
  if (!r.ok) throw new Error('update failed')
  return r.json()
}

export async function deleteTestcase(id) {
  const r = await fetch(`${API_ROOT}/api/testcases/${id}`, { method: 'DELETE' })
  if (!r.ok) throw new Error('delete failed')
  return r.json()
}

export async function uploadBaseline(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch(`${API_ROOT}/api/upload-baseline`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error('upload failed')
  return r.json()
}

export async function importTestcasesFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch(`${API_ROOT}/api/import`, { method: 'POST', body: fd });
  if (!r.ok) throw new Error('import failed');
  return r.json();
}

export async function exportTestcases(format = 'json') {
  const r = await fetch(`${API_ROOT}/api/export?format=${format}`);
  if (!r.ok) throw new Error('export failed');
  if (format === 'csv') return r.text();
  return r.json();
}

export async function runTestcasesAsync(ids, options) {
  const r = await fetch(`${API_ROOT}/api/run-async`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, options })
  });
  if (!r.ok) throw new Error('run async failed');
  return r.json();
}

export async function getRunResults(ids) {
  const q = ids.join(',');
  const r = await fetch(`${API_ROOT}/api/run-results?ids=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error('get results failed');
  return r.json();
}
