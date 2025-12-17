import React, { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Testcases from './pages/Testcases'

export default function App() {
  const [route, setRoute] = useState('dashboard')

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Autotest</h2>
        <nav>
          <button onClick={() => setRoute('dashboard')}>仪表盘</button>
          <button onClick={() => setRoute('testcases')}>用例管理</button>
        </nav>
      </aside>
      <main className="main">
        {route === 'dashboard' && <Dashboard />}
        {route === 'testcases' && <Testcases />}
      </main>
    </div>
  )
}
