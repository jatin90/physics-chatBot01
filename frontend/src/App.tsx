import { useState } from 'react';
import './App.css';

// ----------------------------------------------------------------------
// 🔧 CONFIGURATION: PASTE YOUR RAILWAY URL HERE
// IMPORTANT: Must start with 'https://' and end with '/chat'
// Example: "https://physics-backend-production.up.railway.app/chat"
// ----------------------------------------------------------------------
const API_URL = "https://physics-chatbot01-production.up.railway.app/chat"; 

function App() {
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: string, content: string }[]>([]);
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
      console.log(`Connecting to Brain at: ${API_URL}`);
      
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: input,
          history: chatHistory // Send recent history for context
        }),
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      const data = await res.json();
      
      const botMessage = { role: "assistant", content: data.answer };
      setChatHistory(prev => [...prev, botMessage]);

    } catch (err) {
      console.error("Connection Failed:", err);
      setError("The Professor is currently offline. Please check your connection.");
      // Optional: Add a system message to the chat
      setChatHistory(prev => [...prev, { role: "assistant", content: "⚠️ Error: I cannot reach the server right now." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>⚛️ Physics Chatbot</h1>
      
      {/* Chat Display Area */}
      <div style={{ 
        border: "1px solid #ddd", 
        borderRadius: "8px", 
        padding: "20px", 
        height: "400px", 
        overflowY: "auto", 
        marginBottom: "20px",
        backgroundColor: "#f9f9f9"
      }}>
        {chatHistory.length === 0 && <p style={{color: "#888", textAlign: "center"}}>Ask me anything about Physics!</p>}
        
        {chatHistory.map((msg, index) => (
          <div key={index} style={{ 
            textAlign: msg.role === "user" ? "right" : "left", 
            marginBottom: "10px" 
          }}>
            <span style={{ 
              display: "inline-block",
              padding: "10px 15px", 
              borderRadius: "15px", 
              backgroundColor: msg.role === "user" ? "#0070f3" : "#e0e0e0",
              color: msg.role === "user" ? "white" : "black",
              maxWidth: "80%"
            }}>
              {msg.content}
            </span>
          </div>
        ))}
        
        {isLoading && <div style={{textAlign: "left", color: "#666"}}>Thinking...</div>}
      </div>

      {/* Input Area */}
      {error && <p style={{color: "red", fontSize: "0.9em"}}>{error}</p>}
      
      <div style={{ display: "flex", gap: "10px" }}>
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type your physics question..."
          style={{ flex: 1, padding: "10px", borderRadius: "5px", border: "1px solid #ccc" }}
          disabled={isLoading}
        />
        <button 
          onClick={handleSendMessage}
          disabled={isLoading}
          style={{ 
            padding: "10px 20px", 
            backgroundColor: isLoading ? "#ccc" : "#0070f3", 
            color: "white", 
            border: "none", 
            borderRadius: "5px", 
            cursor: isLoading ? "not-allowed" : "pointer" 
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default App;