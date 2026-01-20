import { useState } from 'react';
import './App.css';
import 'katex/dist/katex.min.css'; // Don't forget this for the math styles!
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';


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
      
      const botMessage = { 
							role: "assistant", 
							content: data.answer,
							sources: data.sources // Store the sources here
							};
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

return 
	(
		<div style={{ 
		  padding: "12px 18px", 
		  borderRadius: "18px", 
		  backgroundColor: msg.role === "user" ? "#0070f3" : "#f0f2f5",
		  color: msg.role === "user" ? "white" : "#1c1e21",
		  maxWidth: "85%",
		  lineHeight: "1.6"
		}}>
		  <ReactMarkdown 
			remarkPlugins={[remarkMath]} 
			rehypePlugins={[rehypeKatex]}
		  >
			{msg.content}
		  </ReactMarkdown>

		  {/* NEW: Display Sources as small tags */}
		  {msg.sources && msg.sources.length > 0 && (
			<div style={{ marginTop: "10px", borderTop: "1px solid #ccc", paddingTop: "5px" }}>
			  <p style={{ fontSize: "0.75rem", fontWeight: "bold", margin: "5px 0" }}>Sources:</p>
			  <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
				{msg.sources.map((src: string, i: number) => (
				  <span key={i} style={{ 
					fontSize: "0.7rem", 
					backgroundColor: "#fff", 
					padding: "2px 8px", 
					borderRadius: "10px",
					border: "1px solid #ddd"
				  }}>
					📖 {src}
				  </span>
				))}
			  </div>
			</div>
			)}
			</div>
	);
}

export default App;