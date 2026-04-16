"use client";

import { useState, useRef, useEffect } from "react";

type Stage = "home" | "submenu" | "detail" | "search";

interface SubItem {
  no: string;
  title: string;
}

export default function ChatbotOverlay() {
  const [isOpen, setIsOpen] = useState(false);

  // 트리 내비게이션 상태
  const [stage, setStage] = useState<Stage>("home");
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [subItems, setSubItems] = useState<SubItem[]>([]);
  const [detailTitle, setDetailTitle] = useState<string>("");
  const [detailAnswer, setDetailAnswer] = useState<string>("");

  // 텍스트 검색 상태
  const [searchInput, setSearchInput] = useState("");
  const [searchResult, setSearchResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // 챗봇 열릴 때 카테고리 목록 로드
  useEffect(() => {
    if (isOpen && categories.length === 0) {
      loadCategories();
    }
  }, [isOpen]);

  // 스테이지 바뀔 때 스크롤 맨 위로
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [stage]);

  const loadCategories = async () => {
    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "menu" }),
      });
      const data = await res.json();
      setCategories(data.categories || []);
    } catch {
      setCategories([]);
    }
  };

  const handleCategoryClick = async (cat: string) => {
    setSelectedCategory(cat);
    setLoading(true);
    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submenu", keyword: cat }),
      });
      const data = await res.json();
      setSubItems(data.items || []);
      setStage("submenu");
    } catch {
      setSubItems([]);
      setStage("submenu");
    } finally {
      setLoading(false);
    }
  };

  const handleSubItemClick = async (no: string, title: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "detail", keyword: selectedCategory, subNo: no }),
      });
      const data = await res.json();
      setDetailTitle(data.title || title);
      setDetailAnswer(data.answer || "답변을 찾을 수 없습니다.");
      setStage("detail");
    } catch {
      setDetailAnswer("서버 오류가 발생했습니다.");
      setStage("detail");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    setLoading(true);
    setSearchResult("");
    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "query", query: searchInput }),
      });
      const data = await res.json();
      setSearchResult(data.reply || "답변을 찾을 수 없습니다.");
      setStage("search");
    } catch {
      setSearchResult("서버 연결 오류가 발생했습니다.");
      setStage("search");
    } finally {
      setLoading(false);
    }
  };

  const goHome = () => {
    setStage("home");
    setSearchInput("");
    setSearchResult("");
    setDetailTitle("");
    setDetailAnswer("");
    setSubItems([]);
    setSelectedCategory("");
  };

  const BASE: React.CSSProperties = {
    width: "360px",
    height: "520px",
    background: "rgba(10, 10, 15, 0.85)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "16px",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
    overflow: "hidden",
  };

  const HEADER: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    padding: "0.85rem 1rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    gap: "0.5rem",
  };

  const BTN_CLOSE: React.CSSProperties = {
    background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1,
  };

  const BACK_BTN: React.CSSProperties = {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "6px",
    color: "var(--text-secondary, #aaa)",
    fontSize: "0.78rem",
    padding: "0.25rem 0.65rem",
    cursor: "pointer",
  };

  const BODY: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.6rem",
  };

  const CAT_BTN: React.CSSProperties = {
    width: "100%",
    textAlign: "left",
    padding: "0.75rem 1rem",
    background: "rgba(99,102,241,0.12)",
    border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: "10px",
    color: "#c7d2fe",
    fontSize: "0.92rem",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  };

  const SUB_BTN: React.CSSProperties = {
    width: "100%",
    textAlign: "left",
    padding: "0.65rem 0.9rem",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "8px",
    color: "#e2e8f0",
    fontSize: "0.88rem",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
  };

  const FOOTER: React.CSSProperties = {
    padding: "0.75rem",
    background: "rgba(0,0,0,0.25)",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    gap: "0.4rem",
  };

  const SEND_BTN: React.CSSProperties = {
    background: "var(--accent-primary, #6366f1)",
    border: "none",
    borderRadius: "8px",
    padding: "0 1rem",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "0.85rem",
    whiteSpace: "nowrap",
  };

  const INPUT_STYLE: React.CSSProperties = {
    flex: 1,
    padding: "0.65rem 0.8rem",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.07)",
    color: "#fff",
    fontSize: "0.88rem",
  };

  return (
    <div style={{ position: "fixed", bottom: "30px", right: "30px", zIndex: 9999 }}>
      {isOpen ? (
        <div style={BASE}>
          {/* ── HEADER ── */}
          <div style={HEADER}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 0 }}>
              {stage !== "home" && (
                <button style={BACK_BTN} onClick={() => {
                  if (stage === "detail") setStage("submenu");
                  else goHome();
                }}>
                  ← 뒤로
                </button>
              )}
              <h3 style={{ margin: 0, fontSize: "0.95rem", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {stage === "home" ? "🤖 사유 작성 매뉴얼" :
                  stage === "submenu" ? `📂 ${selectedCategory}` :
                  stage === "detail" ? `📌 ${detailTitle}` :
                  "🔍 검색 결과"}
              </h3>
            </div>
            <button style={BTN_CLOSE} onClick={() => setIsOpen(false)}>✖</button>
          </div>

          {/* ── BODY ── */}
          <div style={BODY} ref={bodyRef}>
            {loading && (
              <div style={{ color: "#aaa", fontSize: "0.82rem", fontStyle: "italic", textAlign: "center", padding: "1rem 0" }}>
                불러오는 중...
              </div>
            )}

            {/* HOME: 카테고리 목록 */}
            {!loading && stage === "home" && (
              <>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.25rem" }}>
                  아래 항목을 클릭하거나 아래 검색창에 질문을 입력하세요.
                </p>
                {categories.length === 0 ? (
                  <p style={{ opacity: 0.45, fontSize: "0.84rem" }}>
                    메뉴 항목이 없습니다.<br />구글 시트 Q&A 탭을 확인해 주세요.
                  </p>
                ) : (
                  categories.map(cat => (
                    <button key={cat} style={CAT_BTN} onClick={() => handleCategoryClick(cat)}>
                      {cat}
                      <span style={{ fontSize: "0.9rem", opacity: 0.6 }}>›</span>
                    </button>
                  ))
                )}
              </>
            )}

            {/* SUBMENU: 번호 목록 */}
            {!loading && stage === "submenu" && (
              <>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.25rem" }}>
                  항목을 선택하면 상세 답변을 볼 수 있습니다.
                </p>
                {subItems.length === 0 ? (
                  <p style={{ opacity: 0.45, fontSize: "0.84rem" }}>서브 항목이 없습니다.</p>
                ) : (
                  subItems.map(item => (
                    <button key={item.no} style={SUB_BTN} onClick={() => handleSubItemClick(item.no, item.title)}>
                      <span style={{
                        minWidth: "24px", height: "24px", background: "rgba(99,102,241,0.35)", borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.78rem", fontWeight: 700, color: "#a5b4fc", flexShrink: 0,
                      }}>{item.no}</span>
                      <span>{item.title}</span>
                    </button>
                  ))
                )}
              </>
            )}

            {/* DETAIL: 상세 답변 */}
            {!loading && stage === "detail" && (
              <div style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "10px",
                padding: "1rem",
                fontSize: "0.9rem",
                lineHeight: "1.65",
                color: "#e2e8f0",
                whiteSpace: "pre-wrap",
              }}>
                {detailAnswer}
              </div>
            )}

            {/* SEARCH: 텍스트 검색 결과 */}
            {!loading && stage === "search" && (
              <>
                <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.4)", marginBottom: "0.25rem" }}>
                  검색어: <b style={{ color: "#a5b4fc" }}>{searchInput}</b>
                </div>
                <div style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "10px",
                  padding: "1rem",
                  fontSize: "0.9rem",
                  lineHeight: "1.65",
                  color: "#e2e8f0",
                  whiteSpace: "pre-wrap",
                }}>
                  {searchResult}
                </div>
              </>
            )}
          </div>

          {/* ── FOOTER: 텍스트 검색 ── */}
          <div style={FOOTER}>
            <input
              ref={inputRef}
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="직접 검색..."
              style={INPUT_STYLE}
            />
            <button onClick={handleSearch} style={SEND_BTN}>검색</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: "60px", height: "60px", borderRadius: "30px",
            background: "var(--accent-primary, #6366f1)", border: "none",
            color: "#fff", fontSize: "1.5rem", cursor: "pointer",
            boxShadow: "0 5px 20px rgba(99,102,241,0.5)",
            display: "flex", justifyContent: "center", alignItems: "center",
          }}
        >
          💬
        </button>
      )}
    </div>
  );
}
