import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './App.css';

// Update this with your actual Railway URL
const API_URL = "https://physics-chatbot01-production.up.railway.app/chat"; 

function App() {
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setChatHistory(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: input,
          history: chatHistory.slice(-5) // Send last 5 messages for context
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      
      const botMessage = { 
        role: "assistant", 
        content: data.answer,
        sources: data.sources 
      };
      setChatHistory(prev => [...prev, botMessage]);

    } catch (err: any) {
      console.error("Connection Failed:", err);
      setError("The Professor is currently offline.");
    } finally {
      setIsLoading(false);
    }
  };

  // THE RETURN MUST BE INSIDE THE APP FUNCTION
  return (
    <div style={{ maxWidth: "1000px", margin: "40px auto", padding: "0 20px", fontFamily: "sans-serif" }}>
      <h1 style={{ textAlign: "center", color: "#0070f3" }}>⚛️ Physics Research Portal</h1>
      
      <div style={{ 
        border: "1px solid #e0e0e0", borderRadius: "12px", padding: "25px", 
        height: "550px", overflowY: "auto", marginBottom: "20px", backgroundColor: "#fff" 
      }}>
        {chatHistory.length === 0 && <p style={{ textAlign: "center", color: "#888" }}>Ask a physics question...</p>}
        
        {chatHistory.map((msg, index) => (
          <div key={index} style={{ 
            display: "flex", 
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start", 
            marginBottom: "20px" 
          }}>
            <div style={{ 
              padding: "12px 18px", borderRadius: "18px", 
              backgroundColor: msg.role === "user" ? "#0070f3" : "#f0f2f5",
              color: msg.role === "user" ? "white" : "#1c1e21",
              maxWidth: "80%"
            }}>
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {msg.content}
              </ReactMarkdown>

              {msg.sources && msg.sources.length > 0 && (
                <div style={{ marginTop: "10px", borderTop: "1px solid #ccc", paddingTop: "5px" }}>
                  <p style={{ fontSize: "0.7rem", fontWeight: "bold", margin: "2px 0" }}>Sources:</p>
                  {msg.sources.map((src: string, i: number) => (
                    <span key={i} style={{ fontSize: "0.65rem", marginRight: "5px", opacity: 0.8 }}>📖 {src}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && <div style={{ color: "#0070f3" }}>Professor is thinking...</div>}
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ccc" }}
          placeholder="Type your question..."
        />
        <button 
          onClick={handleSendMessage} 
          disabled={isLoading}
          style={{ padding: "12px 24px", backgroundColor: "#0070f3", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
        >
          Ask
        </button>
      </div>
      {error && <p style={{ color: "red", textAlign: "center" }}>{error}</p>}
    </div>
  );
} // <--- THIS BRACE CLOSES THE APP FUNCTION

export default App;