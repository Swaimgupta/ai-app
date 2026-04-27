import React, { useState, useMemo,useRef } from "react";
import Papa from "papaparse";
import { 
  Trash2, MessageSquare, ShieldCheck, Play, 
  Upload, BarChart3, AlertCircle, Send, Layers 
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const App = () => {
  const fileInputRef = useRef(null);
  const [data, setData] = useState([]);
  const [cols, setCols] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  
  const [biasConfig, setBiasConfig] = useState({ 
    protected: "", 
    outcome: "", 
    target: "" 
  });
  const [biasResults, setBiasResults] = useState(null);

  // --- Logic: File Handling ---
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => {
        setData(r.data);
        setCols(Object.keys(r.data[0]));
        setAnomalies([]);
        setBiasResults(null);
      },
    });
  };

  // --- Logic: Grouping Anomalies by Reason ---
  const groupedAnomalies = useMemo(() => {
    return anomalies.reduce((acc, curr) => {
      if (!acc[curr.reason]) acc[curr.reason] = [];
      acc[curr.reason].push(curr.index);
      return acc;
    }, {});
  }, [anomalies]);

  const removeGroup = (indices) => {
    const sortedIndices = [...indices].sort((a, b) => b - a);
    setData((prev) => {
      let newData = [...prev];
      sortedIndices.forEach(idx => newData.splice(idx, 1));
      return newData;
    });
    setAnomalies((prev) => prev.filter(a => !indices.includes(a.index)));
  };

  const runAudit = async () => {
    setAuditLoading(true);
    try {
      const res = await fetch(`${API}/api/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataSample: data }),
      });
      const result = await res.json();
      if (Array.isArray(result)) {
        setAnomalies(result.filter((a) => typeof a.index === "number" && a.reason));
      }
    } catch (err) {
      console.error("Audit failed:", err.message);
    } finally {
      setAuditLoading(false);
    }
  };

  // --- Logic: Bias Calculation ---
  const calculateBias = () => {
    if (!biasConfig.protected || !biasConfig.outcome || !biasConfig.target) return;
    
    const groups = [...new Set(data.map((d) => d[biasConfig.protected]))];
    
    const stats = groups.map((g) => {
      const groupRows = data.filter((d) => d[biasConfig.protected] === g);
      
      // IMPROVED LOGIC: 
      // 1. Convert everything to lowercase
      // 2. Remove extra spaces (trim)
      const success = groupRows.filter((d) => {
        const val = String(d[biasConfig.outcome] || "").trim().toLowerCase();
        const target = biasConfig.target.trim().toLowerCase();
        return val === target;
      }).length;

      return { group: g, rate: (success / groupRows.length).toFixed(2) };
    });

    setBiasResults(stats);
    handleChat(`Analyze this bias data for "${biasConfig.protected}": ${JSON.stringify(stats)}`);
  };

  // --- Logic: Chat ---
  const handleChat = async (overridePrompt) => {
    const text = overridePrompt || input.trim();
    if (!text) return;
    setChat((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setChatLoading(true);
    try {
      const res = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, contextData: data.slice(0, 5) }),
      });
      const result = await res.json();
      setChat((prev) => [...prev, { role: "ai", text: result.text }]);
    } catch (err) {
      setChat((prev) => [...prev, { role: "ai", text: `Error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="app-layout">
      {/* MAIN CONTENT AREA */}
      <main className="main-content">
        <header className="top-nav">
          <div className="logo">
            <div className="logo-icon"><ShieldCheck size={22} /></div>
            <span>DataGuardian <span className="brand-accent">AI</span></span>
          </div>
           <label className="file-upload-btn">
  <Upload size={16} />
  <span>{data.length > 0 ? "Change Dataset" : "Upload CSV"}</span>

  <input
    type="file"
    ref={fileInputRef}
    onChange={handleFile}
    accept=".csv"
    hidden
  />
</label>
        </header>

        {data.length > 0 ? (
          <div className="dashboard-content">
            
            {/* 1. BIAS CONFIGURATION SECTION */}
            <section className="card modern-card">
              <div className="card-header">
                <BarChart3 size={18} className="text-indigo-500" />
                <h3>Bias & Fairness Configuration</h3>
              </div>
              <div className="bias-controls-grid">
                <div className="modern-input-group">
                  <label>Protected Attribute</label>
                  <select
                    value={biasConfig.protected}
                    onChange={(e) => setBiasConfig({ ...biasConfig, protected: e.target.value })}
                  >
                    <option value="">Select Column...</option>
                    {cols.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="modern-input-group">
                  <label>Outcome Column</label>
                  <select
                    value={biasConfig.outcome}
                    onChange={(e) => setBiasConfig({ ...biasConfig, outcome: e.target.value })}
                  >
                    <option value="">Select Column...</option>
                    {cols.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="modern-input-group">
                  <label>Target Value</label>
                  <input
                    placeholder="e.g. Approved / 1"
                    value={biasConfig.target}
                    onChange={(e) => setBiasConfig({ ...biasConfig, target: e.target.value })}
                  />
                </div>
                <button onClick={calculateBias} className="icon-run-btn">
                  <Play size={20} fill="currentColor" />
                </button>
              </div>

              {biasResults && (
                <div className="bias-results-row">
                  {biasResults.map((r, i) => (
                    <div key={i} className="bias-chip">
                      <span className="label">{r.group}:</span>
                      <span className="value">{(r.rate * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 2. AUDIT SECTION */}
            <button 
              onClick={runAudit} 
              className={`audit-hero-btn ${auditLoading ? 'is-loading' : ''}`}
            >
              <AlertCircle size={20} />
              {auditLoading ? "AI Engine scanning rows..." : "Run AI Anomaly Audit"}
            </button>

            {/* 3. GROUPED ANOMALIES SECTION */}
            {Object.keys(groupedAnomalies).length > 0 && (
              <div className="anomaly-section">
                <div className="section-title">
                   <Layers size={16} /> 
                   <span>Identified Quality Issues ({anomalies.length})</span>
                </div>
                <div className="grouped-anomaly-grid">
                  {Object.entries(groupedAnomalies).map(([reason, indices], i) => (
                    <div key={i} className="anomaly-group-card">
                      <div className="anomaly-group-header">
                        <span className="count-badge">{indices.length} Affected Rows</span>
                        <button onClick={() => removeGroup(indices)} className="bulk-delete-btn">
                          <Trash2 size={14} /> Remove All
                        </button>
                      </div>
                      <h4 className="anomaly-group-reason">{reason}</h4>
                      <div className="anomaly-row-tags">
                        {indices.map(idx => (
                          <span key={idx} className="row-tag">Row {idx}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. DATA PREVIEW TABLE */}
            <div className="card table-card">
              <div className="table-header-info">
                Dataset Preview <span className="count">({data.length} records)</span>
              </div>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      {cols.map((c) => <th key={c}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((v, j) => <td key={j}>{v}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-dashboard">
            <div
  className="upload-illustration"
  onClick={() => fileInputRef.current.click()}
  style={{ cursor: "pointer" }}
>
  <Upload size={40} className="text-indigo-400" />
</div>
            <h2>No Data Loaded</h2>
            <p>Upload a CSV file to analyze bias and audit data quality using AI.</p>
          </div>
        )}
      </main>

      {/* CHAT ASSISTANT PANEL */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <MessageSquare size={20} className="text-indigo-400" />
          <h2>Data Assistant</h2>
        </div>
        
        <div className="chat-feed">
          {chat.length === 0 && (
            <div className="chat-placeholder">
              Ask me to explain the audit results or calculate specific statistics...
            </div>
          )}
          {chat.map((m, i) => (
            <div key={i} className={`chat-msg-row ${m.role}`}>
              <div className="chat-bubble">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
              </div>
            </div>
          ))}
          {chatLoading && <div className="chat-typing">Assistant is generating...</div>}
        </div>

        <div className="chat-input-container">
          <div className="chat-input-bar">
            <input
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleChat()}
            />
            <button onClick={() => handleChat()} disabled={!input.trim()} className="send-msg-btn">
              <Send size={18} />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default App;