import React, { useState } from 'react';
import Papa from 'papaparse';
import { Trash2, MessageSquare, ShieldCheck, Play } from 'lucide-react';

const API = 'http://localhost:5000';

const App = () => {
    const [data, setData] = useState([]);
    const [cols, setCols] = useState([]);
    const [anomalies, setAnomalies] = useState([]);
    const [chat, setChat] = useState([]);
    const [input, setInput] = useState("");
    const [auditLoading, setAuditLoading] = useState(false);
    const [chatLoading, setChatLoading] = useState(false);
    const [biasConfig, setBiasConfig] = useState({ protected: '', outcome: '', target: '' });
    const [biasResults, setBiasResults] = useState(null);

    // 1. File Upload & Parse
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
            }
        });
    };

    // 2. AI Data Auditor
    const runAudit = async () => {
        setAuditLoading(true);
        try {
            const res = await fetch(`${API}/api/audit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataSample: data.slice(0, 20) })
            });
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            const result = await res.json();
            // Ensure result is array with expected shape
            if (Array.isArray(result)) {
                setAnomalies(result.filter(a => a.index !== undefined && a.reason));
            } else {
                console.error('Unexpected audit response shape:', result);
            }
        } catch (err) {
            console.error('Audit failed:', err.message);
            alert(`Audit failed: ${err.message}`);
        } finally {
            setAuditLoading(false);
        }
    };

    // 3. Remove Anomalous Row
    const removeRow = (idx) => {
        setData(prev => prev.filter((_, i) => i !== idx));
        setAnomalies(prev => prev.filter(a => a.index !== idx));
    };

    // 4. Bias Calculation
    const calculateBias = () => {
        if (!biasConfig.protected || !biasConfig.outcome || !biasConfig.target) {
            alert('Please fill all bias config fields.');
            return;
        }
        const groups = [...new Set(data.map(d => d[biasConfig.protected]))];
        const stats = groups.map(g => {
            const groupRows = data.filter(d => d[biasConfig.protected] === g);
            const success = groupRows.filter(d => d[biasConfig.outcome] === biasConfig.target).length;
            return { group: g, rate: (success / groupRows.length).toFixed(2) };
        });
        setBiasResults(stats);
        handleChat(`Explain this bias data: ${JSON.stringify(stats)} for attribute "${biasConfig.protected}"`);
    };

    // 5. Chat
    const handleChat = async (overridePrompt) => {
        const text = overridePrompt || input.trim();
        if (!text) return;

        setChat(prev => [...prev, { role: 'user', text }]);
        setInput("");
        setChatLoading(true);

        try {
            const res = await fetch(`${API}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: text, contextData: data.slice(0, 5) })
            });
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            const result = await res.json();
            setChat(prev => [...prev, { role: 'ai', text: result.text }]);
        } catch (err) {
            setChat(prev => [...prev, { role: 'ai', text: `Error: ${err.message}` }]);
        } finally {
            setChatLoading(false);
        }
    };

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            {/* LEFT: Data & Bias Tool */}
            <div className="w-2/3 p-6 overflow-y-auto border-r bg-white shadow-inner">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-indigo-700">
                        <ShieldCheck /> DataGuardian AI
                    </h1>
                    <input type="file" onChange={handleFile} className="text-sm" accept=".csv" />
                </div>

                {data.length > 0 && (
                    <div className="space-y-6">
                        {/* Bias Config */}
                        <div className="p-4 bg-indigo-50 rounded-xl grid grid-cols-4 gap-2 items-end">
                            <div>
                                <label className="text-xs font-bold">Protected Column</label>
                                <select className="w-full p-2 rounded border" onChange={e => setBiasConfig({ ...biasConfig, protected: e.target.value })}>
                                    <option value="">Select...</option>
                                    {cols.map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold">Outcome Column</label>
                                <select className="w-full p-2 rounded border" onChange={e => setBiasConfig({ ...biasConfig, outcome: e.target.value })}>
                                    <option value="">Select...</option>
                                    {cols.map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                            <input
                                className="p-2 border rounded"
                                placeholder="Target Val (e.g. Yes)"
                                onChange={e => setBiasConfig({ ...biasConfig, target: e.target.value })}
                            />
                            <button onClick={calculateBias} className="bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700 flex justify-center">
                                <Play size={20} />
                            </button>
                        </div>

                        {/* Bias Results Table — was missing before */}
                        {biasResults && (
                            <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                                <h3 className="font-bold text-yellow-800 mb-2">Bias Analysis Results</h3>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-yellow-700">
                                            <th className="p-2">Group</th>
                                            <th className="p-2">Success Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {biasResults.map((r, i) => (
                                            <tr key={i} className="border-t border-yellow-100">
                                                <td className="p-2">{r.group}</td>
                                                <td className="p-2">{(r.rate * 100).toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Audit Button */}
                        <button onClick={runAudit} className="w-full py-3 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-xl hover:bg-indigo-50 font-medium">
                            {auditLoading ? "AI is scanning rows..." : "Filter False Data with Gemini AI"}
                        </button>

                        {/* Anomalies */}
                        {anomalies.map((a, i) => (
                            <div key={i} className="flex justify-between bg-red-50 border-l-4 border-red-500 p-3 rounded shadow-sm">
                                <div className="text-sm">
                                    <span className="font-bold text-red-700">Anomaly Row {a.index}:</span> {a.reason}
                                </div>
                                <button onClick={() => removeRow(a.index)} className="text-red-500 hover:scale-110 transition">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}

                        {/* Data Preview */}
                        <div className="overflow-x-auto border rounded-lg">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-200">
                                    <tr>{cols.map(c => <th key={c} className="p-2 border">{c}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {data.slice(0, 10).map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-50 border-b">
                                            {Object.values(row).map((v, j) => <td key={j} className="p-2 border">{v}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* RIGHT: Chatbot */}
            <div className="w-1/3 flex flex-col bg-white">
                <div className="p-4 border-b bg-indigo-600 text-white font-bold flex items-center gap-2">
                    <MessageSquare size={20} /> Gemini Assistant
                </div>
                <div className="flex-grow p-4 overflow-y-auto space-y-4">
                    {chat.map((m, i) => (
                        <div key={i} className={`p-3 rounded-2xl max-w-[85%] ${m.role === 'user' ? 'ml-auto bg-indigo-500 text-white' : 'bg-gray-100 text-gray-800 shadow-sm'}`}>
                            <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                        </div>
                    ))}
                    {chatLoading && <div className="text-xs text-gray-400 animate-pulse">Gemini is thinking...</div>}
                </div>
                <div className="p-4 border-t flex gap-2">
                    <input
                        className="flex-grow p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="Ask about data or anything else..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleChat()}
                    />
                    <button onClick={() => handleChat()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg">Send</button>
                </div>
            </div>
        </div>
    );
};

export default App;