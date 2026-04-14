"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "bot";
  content: string;
}

export default function ChatbotOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", content: "무엇이든 물어보세요! (예: 거리상의 이유, 이관 시기 기준이 뭔가요?)" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const toggleChat = () => setIsOpen(!isOpen);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    // 유저 메시지 추가
    setMessages(prev => [...prev, { role: "user", content: input }]);
    const currentInput = input;
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: currentInput })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "bot", content: data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "bot", content: "통신 오류가 발생했습니다." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", bottom: "30px", right: "30px", zIndex: 9999 }}>
      {isOpen ? (
        <div style={{
          width: "350px", height: "500px", 
          background: "rgba(10, 10, 15, 0.8)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "16px",
          display: "flex", flexDirection: "column",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          overflow: "hidden"
        }}>
          {/* Header */}
          <div style={{
            background: "rgba(255,255,255,0.05)",
            padding: "1rem",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.1)"
          }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#fff" }}>🤖 사유 작성 매뉴얼 챗봇</h3>
            <button onClick={toggleChat} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: "1.2rem" }}>✖</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, padding: "1rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {messages.map((msg, idx) => (
               <div key={idx} style={{
                 alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                 background: msg.role === "user" ? "var(--accent-primary)" : "rgba(255,255,255,0.1)",
                 color: "#fff",
                 padding: "0.8rem 1rem",
                 borderRadius: "12px",
                 maxWidth: "80%",
                 lineHeight: "1.4",
                 fontSize: "0.95rem"
               }}>
                 {msg.content}
               </div>
            ))}
            {loading && (
              <div style={{ alignSelf: "flex-start", color: "#aaa", fontSize: "0.8rem", fontStyle: "italic" }}>답변 탐색 중...</div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div style={{
            padding: "1rem", background: "rgba(0,0,0,0.2)", borderTop: "1px solid rgba(255,255,255,0.05)",
            display: "flex", gap: "0.5rem"
          }}>
            <input 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="질문을 기입하세요" 
              style={{ flex: 1, padding: "0.8rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", color: "#fff" }}
            />
            <button onClick={handleSend} style={{
              background: "var(--accent-primary)", border: "none", borderRadius: "8px", padding: "0 1.2rem",
              color: "#fff", cursor: "pointer", fontWeight: "bold"
            }}>전송</button>
          </div>
        </div>
      ) : (
        <button 
          onClick={toggleChat}
          style={{
            width: "60px", height: "60px", borderRadius: "30px",
            background: "var(--accent-primary)", border: "none",
            color: "#fff", fontSize: "1.5rem", cursor: "pointer",
            boxShadow: "0 5px 20px rgba(99,102,241,0.5)",
            display: "flex", justifyContent: "center", alignItems: "center"
          }}
        >
          💬
        </button>
      )}
    </div>
  );
}
