import React, { useState, useEffect } from 'react'
import Button from '../components/Button'
import FileUpload from '../components/FileUpload'
import { createTestcase, updateTestcase, uploadBaseline } from '../api'

export default function TestcaseEditor({ initial = null, onSave, onCancel }) {
  const empty = { title: '', preconditions: [], steps: [], assertions: [] }
  const [item, setItem] = useState(initial && Object.keys(initial).length ? initial : empty)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setItem(initial && Object.keys(initial).length ? initial : empty)
  }, [initial])

  function setField(k, v) {
    setItem((s) => ({ ...s, [k]: v }))
  }

  async function handleSave() {
    if (!item.title) return alert('请填写标题')
    try {
      let res
      if (item.id) res = await updateTestcase(item.id, item)
      else res = await createTestcase(item)
      if (onSave) onSave(res)
    } catch (e) {
      alert('保存失败:' + e.message)
    }
  }

  async function handleFile(file) {
    setUploading(true)
    try {
      const res = await uploadBaseline(file)
      // attach baseline url to item
      setItem((s) => ({ ...s, baseline: res.url }))
    } catch (e) {
      alert('上传失败:' + e.message)
    }
    setUploading(false)
  }
  function addStep() {
    setItem((s) => ({ ...s, steps: [...(s.steps||[]), { action: '', target: '', args: {} }] }))
  }

  function updateStep(i, key, value) {
    setItem((s) => {
      const steps = [...(s.steps||[])];
      steps[i] = { ...steps[i], [key]: value };
      return { ...s, steps };
    })
  }

  function removeStep(i) {
    setItem((s) => ({ ...s, steps: (s.steps||[]).filter((_, idx) => idx !== i) }))
  }

  function addAssertion() {
    setItem((s) => ({ ...s, assertions: [...(s.assertions||[]), { type: '', target: '', baseline: '', threshold: 0.98 }] }))
  }

  function updateAssertion(i, key, value) {
    setItem((s) => {
      const assertions = [...(s.assertions||[])];
      assertions[i] = { ...assertions[i], [key]: value };
      return { ...s, assertions };
    })
  }

  function removeAssertion(i) {
    setItem((s) => ({ ...s, assertions: (s.assertions||[]).filter((_, idx) => idx !== i) }))
  }

  return (
    <div className="editor card">
      <div>
        <label>标题</label>
        <input value={item.title} onChange={(e) => setField('title', e.target.value)} />
      </div>
      <div>
        <label>前置条件（逗号分隔）</label>
        <input value={(item.preconditions || []).join(',')} onChange={(e) => setField('preconditions', e.target.value.split(',').map(s=>s.trim()))} />
      </div>
      <div>
        <label>基线图</label>
        <FileUpload onFile={handleFile} />
        {uploading && <div>上传中...</div>}
        {item.baseline && <div>已上传：<a href={item.baseline} target="_blank" rel="noreferrer">查看</a></div>}
      </div>

      <div>
        <label>步骤</label>
        {(item.steps||[]).map((s, i) => (
          <div key={i} style={{ border: '1px solid #ececec', padding:8, marginTop:6 }}>
            <div>
              <label>动作</label>
              <input value={s.action||''} onChange={(e)=>updateStep(i,'action',e.target.value)} />
            </div>
            <div>
              <label>目标</label>
              <input value={s.target||''} onChange={(e)=>updateStep(i,'target',e.target.value)} />
            </div>
            <div>
              <label>参数（JSON）</label>
              <input value={JSON.stringify(s.args||{})} onChange={(e)=>{
                try{ const v = JSON.parse(e.target.value); updateStep(i,'args',v);}catch(err){}}
              } />
            </div>
            <div style={{ marginTop:6 }}>
              <Button variant="secondary" onClick={()=>removeStep(i)}>删除步骤</Button>
            </div>
          </div>
        ))}
        <div style={{ marginTop:8 }}><Button onClick={addStep}>添加步骤</Button></div>
      </div>

      <div>
        <label>断言</label>
        {(item.assertions||[]).map((a,i)=>(
          <div key={i} style={{ border: '1px solid #ececec', padding:8, marginTop:6 }}>
            <div>
              <label>类型</label>
              <input value={a.type||''} onChange={(e)=>updateAssertion(i,'type',e.target.value)} />
            </div>
            <div>
              <label>目标</label>
              <input value={a.target||''} onChange={(e)=>updateAssertion(i,'target',e.target.value)} />
            </div>
            <div>
              <label>基线文件</label>
              <input value={a.baseline||''} onChange={(e)=>updateAssertion(i,'baseline',e.target.value)} />
            </div>
            <div>
              <label>阈值</label>
              <input type="number" step="0.01" value={a.threshold||0} onChange={(e)=>updateAssertion(i,'threshold',parseFloat(e.target.value))} />
            </div>
            <div style={{ marginTop:6 }}>
              <Button variant="secondary" onClick={()=>removeAssertion(i)}>删除断言</Button>
            </div>
          </div>
        ))}
        <div style={{ marginTop:8 }}><Button onClick={addAssertion}>添加断言</Button></div>
      </div>

      <div className="editor-actions">
        <Button onClick={handleSave}>保存</Button>
        <Button variant="secondary" onClick={onCancel}>取消</Button>
      </div>
    </div>
  )
}
