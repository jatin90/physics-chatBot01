import { useState } from 'react'

function App() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  // This state now holds the whole conversation
  const [chatLog, setChatLog] = useState<{role: string, content: string}[]>([]);

  const askPhysics = async () => {
    if (!question.trim()) return;
    
    const userMessage = { role: "user", content: question };
    const newHistory = [...chatLog, userMessage]; // Add current question to history
    
    setLoading(true);
    setQuestion(""); // Clear input early for better UI feel

    try {
      const res = await fetch("http://localhost:3001/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: chatLog }) // Send history to backend
      });
      const data = await res.json();
      
      const assistantMessage = { role: "assistant", content: data.answer };
      setChatLog([...newHistory, assistantMessage]); // Update log with the AI's answer
    } catch (err) {
      alert("Professor is offline!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '20px auto', display: 'flex', flexDirection: 'column', height: '90vh' }}>
      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #ccc', padding: '15px', borderRadius: '8px', marginBottom: '10px' }}>
        {chatLog.map((msg, i) => (
          <div key={i} style={{ marginBottom: '15px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <div style={{ 
              display: 'inline-block', 
              padding: '10px', 
              borderRadius: '10px', 
              backgroundColor: msg.role === 'user' ? '#007bff' : '#e9ecef',
              color: msg.role === 'user' ? 'white' : 'black',
              maxWidth: '80%'
            }}>
              {msg.content.replace(/<think>[\s\S]*?<\/think>/g, "")}
            </div>
          </div>
        ))}
        {loading && <p>Professor is thinking...</p>}
      </div>
      
      <div style={{ display: 'flex', gap: '5px' }}>
        <input style={{ flex: 1, padding: '10px' }} value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && askPhysics()} />
        <button onClick={askPhysics} style={{ padding: '10px 20px' }}>Ask</button>
      </div>
    </div>
  );
}

export default App;