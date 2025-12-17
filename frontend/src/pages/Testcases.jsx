import React, { useEffect, useState } from 'react'
import { fetchTestcases, runTestcases, runTestcasesAsync, getRunResults, deleteTestcase, importTestcasesFile, exportTestcases } from '../api'
import TestcaseEditor from './TestcaseEditor'
import Button from '../components/Button'

export default function Testcases() {
  const [cases, setCases] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState([])
  const [liveLogs, setLiveLogs] = useState({})
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    fetchTestcases().then(setCases)
  }, [])

  function toggle(id) {
    const s = new Set(selected)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    setSelected(s)
  }

  async function run() {
    if (selected.size === 0) return alert('请选择要运行的用例')
    setRunning(true)
    setResults([])
    setLiveLogs({})
    const ids = Array.from(selected)

    // start async runs and get job descriptors with logFile
    const { jobs } = await runTestcasesAsync(ids)

    // open SSE for each job
    const sources = {}
    const logs = {}
    for (const j of jobs) {
      const file = j.logFile.replace(/^\//, '')
      logs[j.id] = ''
      try {
        const es = new EventSource(`${window.location.origin.replace(/:\d+$/, ':4000')}/api/stream?file=${encodeURIComponent(file)}`)
        es.onmessage = (ev) => {
          // SSE sends data lines
          logs[j.id] += ev.data.replace(/\\n/g,'\n')
          setLiveLogs({ ...logs })
        }
        sources[j.id] = es
      } catch (e) {
        logs[j.id] = `SSE error: ${e.message}`
        setLiveLogs({ ...logs })
      }
    }

    // poll for completion
    const pending = new Set(ids)
    const poll = setInterval(async () => {
      try {
        const res = await getRunResults(ids)
        if (res.results && res.results.length) {
          // update results list and remove completed
          const newResults = [...results]
          for (const r of res.results) {
            // push or replace
            const idx = newResults.findIndex(x=>x.id===r.id)
            if (idx===-1) newResults.push(r)
            else newResults[idx] = r
            pending.delete(r.id)
          }
          setResults(newResults)
        }
        if (pending.size === 0) {
          clearInterval(poll)
          // close SSE
          for (const id of Object.keys(sources)) try { sources[id].close() } catch(e){}
          setRunning(false)
        }
      } catch (e) {
        console.warn('poll error', e)
      }
    }, 1500)
  }

  async function handleDelete(id) {
    if (!confirm('确认删除？')) return
    try {
      await deleteTestcase(id)
      setCases((s) => s.filter((c) => c.id !== id))
    } catch (e) {
      alert('删除失败:' + e.message)
    }
  }

  function openNew() { setEditing({}) }
  function openEdit(item) { setEditing(item) }
  function onSaved(newItem) {
    // refresh list
    fetchTestcases().then((list) => { setCases(list); setEditing(null) })
  }

  async function handleImport(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return; 
    try {
      const res = await importTestcasesFile(f);
      alert('导入完成: ' + JSON.stringify(res));
      fetchTestcases().then(setCases);
    } catch (err) { alert('导入失败: ' + err.message) }
  }

  async function handleExportCsv() {
    try {
      const csv = await exportTestcases('csv');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'testcases.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert('导出失败:' + e.message) }
  }

  return (
    <div>
      <h1>用例管理</h1>
      <div className="controls">
        <Button onClick={run} disabled={running}>{running ? '运行中...' : '运行选中用例'}</Button>
        <Button onClick={openNew} style={{ marginLeft: 8 }}>新建用例</Button>
        <Button onClick={handleExportCsv} style={{ marginLeft: 8 }}>导出 CSV</Button>
        <label style={{ marginLeft: 8 }} className="btn secondary">
          导入
          <input type="file" accept=".csv,application/json" onChange={handleImport} style={{ display: 'none' }} />
        </label>
      </div>
      <ul className="case-list">
        {cases.map((c) => (
          <li key={c.id} className="case">
            <label>
              <input type="checkbox" onChange={() => toggle(c.id)} />
              <strong>{c.id}</strong> — {c.title}
            </label>
            <div style={{ float: 'right' }}>
              <Button onClick={() => openEdit(c)}>编辑</Button>
              <Button variant="secondary" onClick={() => handleDelete(c.id)} style={{ marginLeft: 6 }}>删除</Button>
            </div>
          </li>
        ))}
      </ul>

      <h2>结果</h2>
      <ul>
        {results.map((r) => (
          <li key={r.id}>{r.id}: {r.status} — {r.log || (r.stdout && r.stdout.slice(0,120))}</li>
        ))}
      </ul>
      <h2>实时日志</h2>
      {Object.keys(liveLogs).length === 0 && <div>无实时日志</div>}
      {Object.entries(liveLogs).map(([id, txt]) => (
        <div key={id} className="card" style={{ marginTop: 8 }}>
          <h4>{id}</h4>
          <pre style={{ maxHeight: 240, overflow: 'auto' }}>{txt}</pre>
        </div>
      ))}
      {editing && (
        <TestcaseEditor initial={editing.id ? editing : null} onSave={onSaved} onCancel={() => setEditing(null)} />
      )}
    </div>
  )
}
