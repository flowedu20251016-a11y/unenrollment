"use client";

import { useState, useRef, useEffect } from "react";

type Stage = "home" | "submenu" | "detail" | "search";

export default function ChatbotOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("home");

  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  const [subItems, setSubItems] = useState<string[]>([]);
  const [selectedSub, setSelectedSub] = useState("");

  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<{ category: string; subcategory: string; detail: string }[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && categories.length === 0) loadCategories();
  }, [isOpen]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [stage]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "menu" }),
      });
      const data = await res.json();
      setCategories(data.categories || []);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = async (cat: string) => {
    setSelectedCategory(cat);
    setLoading(true);
    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submenu", category: cat }),
      });
      const data = await res.json();
      setSubItems(data.items || []);
      setStage("submenu");
    } finally {
      setLoading(false);
    }
  };

  const handleSubClick = async (sub: string) => {
    setSelectedSub(sub);
    setLoading(true);
    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "detail", category: selectedCategory, subcategory: sub }),
      });
      const data = await res.json();
      setDetail(data.detail || "상세 내용이 없습니다.");
      setStage("detail");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    const q = searchInput.trim();
    if (!q) return;
    setLoading(true);
    setSearchResults([]);
    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "query", query: q }),
      });
      const data = await res.json();
      setSearchResults(data.results || []);
      setStage("search");
    } finally {
      setLoading(false);
    }
  };

  const goHome = () => {
    setStage("home");
    setSelectedCategory("");
    setSelectedSub("");
    setSubItems([]);
    setDetail("");
    setSearchInput("");
    setSearchResults([]);
  };

  const goBack = () => {
    if (stage === "detail") {
      setStage("submenu");
      setDetail("");
    } else if (stage === "search") {
      goHome();
    } else {
      goHome();
    }
  };

  const BASE: React.CSSProperties = {
    width: "360px",
    height: "520px",
    background: "rgba(10, 10, 15, 0.88)",
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
    flexShrink: 0,
  };

  const BODY: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
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
    gap: "0.5rem",
  };

  const BACK_BTN: React.CSSProperties = {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "6px",
    color: "#aaa",
    fontSize: "0.78rem",
    padding: "0.25rem 0.65rem",
    cursor: "pointer",
    flexShrink: 0,
  };

  const headerTitle =
    stage === "home" ? "📋 퇴원사유 매뉴얼" :
    stage === "submenu" ? `📂 ${selectedCategory}` :
    stage === "detail" ? `📌 ${selectedSub}` :
    `🔍 "${searchInput}" 검색결과`;

  return (
    <div style={{ position: "fixed", bottom: "30px", right: "30px", zIndex: 9999 }}>
      {isOpen ? (
        <div style={BASE}>
          {/* HEADER */}
          <div style={HEADER}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 0 }}>
              {stage !== "home" && (
                <button style={BACK_BTN} onClick={goBack}>← 뒤로</button>
              )}
              <span style={{
                fontSize: "0.92rem", fontWeight: 700, color: "#fff",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {headerTitle}
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1 }}
            >✖</button>
          </div>

          {/* BODY */}
          <div style={BODY} ref={bodyRef}>
            {loading && (
              <div style={{ color: "#aaa", fontSize: "0.82rem", textAlign: "center", padding: "2rem 0" }}>
                불러오는 중...
              </div>
            )}

            {/* HOME: 대분류 */}
            {!loading && stage === "home" && (
              <>
                <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.45)" }}>
                  항목을 선택하면 상세 내용을 확인할 수 있습니다.
                </p>
                {categories.length === 0 ? (
                  <p style={{ opacity: 0.45, fontSize: "0.84rem", color: "#fff" }}>
                    Q&A 시트에 데이터가 없습니다.
                  </p>
                ) : (
                  categories.map(cat => (
                    <button key={cat} style={CAT_BTN} onClick={() => handleCategoryClick(cat)}>
                      <span>{cat}</span>
                      <span style={{ opacity: 0.5, fontSize: "0.85rem" }}>›</span>
                    </button>
                  ))
                )}
              </>
            )}

            {/* SUBMENU: 중분류 */}
            {!loading && stage === "submenu" && (
              <>
                <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.45)" }}>
                  세부 항목을 선택하세요.
                </p>
                {subItems.length === 0 ? (
                  <p style={{ opacity: 0.45, fontSize: "0.84rem", color: "#fff" }}>
                    중분류 항목이 없습니다.
                  </p>
                ) : (
                  subItems.map((item, i) => (
                    <button key={i} style={SUB_BTN} onClick={() => handleSubClick(item)}>
                      <span style={{
                        minWidth: "22px", height: "22px",
                        background: "rgba(99,102,241,0.35)", borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.72rem", fontWeight: 700, color: "#a5b4fc", flexShrink: 0,
                      }}>{i + 1}</span>
                      <span>{item}</span>
                    </button>
                  ))
                )}
              </>
            )}

            {/* DETAIL: 소분류/상세내역 */}
            {!loading && stage === "detail" && (
              <div style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "10px",
                padding: "1rem",
                fontSize: "0.9rem",
                lineHeight: "1.7",
                color: "#e2e8f0",
                whiteSpace: "pre-wrap",
              }}>
                {detail}
              </div>
            )}

            {/* SEARCH: 키워드 검색 결과 */}
            {!loading && stage === "search" && (
              <>
                {searchResults.length === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.86rem", textAlign: "center", paddingTop: "1rem" }}>
                    일치하는 항목이 없습니다.
                  </p>
                ) : (
                  searchResults.map((r, i) => (
                    <button key={i} style={{ ...SUB_BTN, flexDirection: "column", alignItems: "flex-start", gap: "0.25rem" }}
                      onClick={() => {
                        setSelectedCategory(r.category);
                        setSelectedSub(r.subcategory);
                        setDetail(r.detail);
                        setStage("detail");
                      }}
                    >
                      <span style={{ fontSize: "0.75rem", color: "#a5b4fc", fontWeight: 600 }}>
                        {r.category}{r.subcategory ? ` › ${r.subcategory}` : ""}
                      </span>
                      {r.detail && (
                        <span style={{ fontSize: "0.82rem", color: "#cbd5e1", opacity: 0.8 }}
                          dangerouslySetInnerHTML={{ __html: r.detail.length > 60 ? r.detail.slice(0, 60) + "…" : r.detail }}
                        />
                      )}
                    </button>
                  ))
                )}
              </>
            )}
          </div>

          {/* FOOTER: 검색 입력창 */}
          <div style={{
            padding: "0.75rem",
            background: "rgba(0,0,0,0.25)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            gap: "0.4rem",
            flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="키워드 검색..."
              style={{
                flex: 1,
                padding: "0.6rem 0.8rem",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.07)",
                color: "#fff",
                fontSize: "0.88rem",
                outline: "none",
              }}
            />
            <button
              onClick={handleSearch}
              style={{
                background: "var(--accent-primary, #6366f1)",
                border: "none",
                borderRadius: "8px",
                padding: "0 1rem",
                color: "#fff",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "0.85rem",
                whiteSpace: "nowrap",
              }}
            >검색</button>
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
