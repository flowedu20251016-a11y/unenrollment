"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

interface Notice {
  id: string;
  board_name: string;
  title: string;
  content: string;
  author: string;
  created_at: string;
  view_count: number;
  has_attachment: boolean;
  attachment_url?: string | null;
  attachment_name?: string | null;
}

type ViewMode = "list" | "write" | "edit" | "detail";

const BOARD_OPTIONS = ["공지사항", "업무공지", "시스템안내"];
const SEARCH_OPTIONS = [
  { value: "title", label: "제목" },
  { value: "author", label: "등록자" },
  { value: "content", label: "내용" },
];

function addMonths(dateStr: string, n: number) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  if (!iso) return "";
  return iso.slice(0, 10).replace(/-/g, ".");
}

export default function NoticePage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState("관리자");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // 목록 데이터
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);

  // 필터
  const [startDate, setStartDate] = useState(() => addMonths(todayStr(), -1));
  const [endDate, setEndDate] = useState(() => todayStr());
  const [selectedBoard, setSelectedBoard] = useState("all");
  const [searchType, setSearchType] = useState("title");
  const [searchInput, setSearchInput] = useState("");
  const [searchText, setSearchText] = useState(""); // 실제 검색 적용값

  // 상세보기
  const [detailNotice, setDetailNotice] = useState<Notice | null>(null);

  // 작성/수정 폼
  const [formBoard, setFormBoard] = useState("공지사항");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formFiles, setFormFiles] = useState<File[]>([]);
  const [formSaving, setFormSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<Notice | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("dropout_user");
    if (raw) {
      try {
        const u = JSON.parse(raw);
        setIsAdmin(u.role === "admin");
        setUserName(u.userid || u.name || "관리자");
      } catch { /* ignore */ }
    }
    fetchNotices();
  }, []);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        boardName: selectedBoard,
        searchType,
        searchText,
      });
      const res = await fetch(`/api/notices?${params}`);
      const data = await res.json();
      setNotices(data.notices || []);
    } catch {
      setNotices([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedBoard, searchType, searchText]);

  // 날짜 변경 시 자동 재조회
  useEffect(() => { fetchNotices(); }, [startDate, endDate, selectedBoard, searchText]);

  // 날짜 필터 보정
  const handleStartDate = (v: string) => {
    setStartDate(v);
    const maxEnd = addMonths(v, 1);
    if (endDate > maxEnd) setEndDate(maxEnd);
    if (endDate < v) setEndDate(v);
  };
  const handleEndDate = (v: string) => {
    const maxEnd = addMonths(startDate, 1);
    if (v > maxEnd) { setEndDate(maxEnd); return; }
    if (v < startDate) { setEndDate(startDate); return; }
    setEndDate(v);
  };

  const handleSearch = () => setSearchText(searchInput);

  // ── 상세보기 ──
  const openDetail = async (n: Notice) => {
    setDetailNotice(n);
    setViewMode("detail");
    // 조회수 증가
    await fetch("/api/notices/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: n.id }),
    });
    setNotices(prev => prev.map(item => item.id === n.id ? { ...item, view_count: item.view_count + 1 } : item));
  };

  // ── 작성 화면 진입 ──
  const openWrite = (target?: Notice) => {
    if (target) {
      setEditTarget(target);
      setFormBoard(target.board_name);
      setFormTitle(target.title);
      setFormContent(target.content);
      setViewMode("edit");
    } else {
      setEditTarget(null);
      setFormBoard("공지사항");
      setFormTitle("");
      setFormContent("");
      setViewMode("write");
    }
    setFormFiles([]);
  };

  // ── 저장 ──
  const handleSave = async () => {
    if (!formTitle.trim()) { alert("제목을 입력해주세요."); return; }
    if (!formContent.trim()) { alert("내용을 입력해주세요."); return; }
    setFormSaving(true);

    // 파일 여러 개 업로드
    let attachmentUrls: string[] = [];
    let attachmentNames: string[] = [];

    if (formFiles.length > 0) {
      for (const file of formFiles) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "notices");
        try {
          const upRes = await fetch("/api/upload", { method: "POST", body: fd });
          const upData = await upRes.json();
          const url = upData.webViewLink || upData.url || null;
          if (url) {
            attachmentUrls.push(url);
            attachmentNames.push(file.name);
          } else {
            console.warn("[upload] URL 없음:", upData);
          }
        } catch (e) {
          console.error("[upload] 실패:", e);
        }
      }
    }

    // 기존 첨부 유지 (수정 시 새 파일 없으면 기존 것 그대로)
    const finalUrls = attachmentUrls.length > 0
      ? attachmentUrls
      : editTarget?.attachment_url ? editTarget.attachment_url.split("|") : [];
    const finalNames = attachmentNames.length > 0
      ? attachmentNames
      : editTarget?.attachment_name ? editTarget.attachment_name.split("|") : [];

    const body = {
      id: editTarget?.id,
      boardName: formBoard,
      title: formTitle,
      content: formContent,
      author: userName,
      hasAttachment: finalUrls.length > 0,
      attachmentUrl: finalUrls.join("|") || null,
      attachmentName: finalNames.join("|") || null,
    };

    const method = editTarget ? "PATCH" : "POST";
    const res = await fetch("/api/notices", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.error) {
      alert("저장 실패: " + data.error);
    } else {
      await fetchNotices();
      setViewMode("list");
    }
    setFormSaving(false);
  };

  // ── 삭제 ──
  const handleDelete = async (id: string) => {
    if (!confirm("이 공지를 삭제하시겠습니까?")) return;
    await fetch(`/api/notices?id=${id}`, { method: "DELETE" });
    await fetchNotices();
    if (detailNotice?.id === id) setViewMode("list");
  };

  // ── 렌더: 목록 ──
  const renderList = () => (
    <div>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>📢 공지사항</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", margin: "0.25rem 0 0" }}>
            {loading ? "조회 중..." : `총 ${notices.length}건`}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => openWrite()} style={btnPrimary}>
            ✏️ 글쓰기
          </button>
        )}
      </div>

      {/* 필터 바 */}
      <div style={filterBarStyle}>
        {/* 기간 */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={filterLabel}>기간</span>
          <input type="date" value={startDate} max={todayStr()} onChange={e => handleStartDate(e.target.value)} style={filterInput} />
          <span style={{ color: "#bbb" }}>~</span>
          <input type="date" value={endDate} min={startDate} max={addMonths(startDate, 1)} onChange={e => handleEndDate(e.target.value)} style={filterInput} />
          <span style={{ fontSize: "0.73rem", color: "#bbb" }}>최대 1개월</span>
        </div>

        {/* 게시판 분류 */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={filterLabel}>게시판</span>
          <select value={selectedBoard} onChange={e => setSelectedBoard(e.target.value)} style={filterInput}>
            <option value="all">전체</option>
            {BOARD_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* 검색 */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginLeft: "auto" }}>
          <select value={searchType} onChange={e => setSearchType(e.target.value)} style={filterInput}>
            {SEARCH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input
            type="text" placeholder="검색어 입력"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            style={{ ...filterInput, width: "180px" }}
          />
          <button onClick={handleSearch} style={btnSearch}>검색</button>
          {searchText && (
            <button onClick={() => { setSearchInput(""); setSearchText(""); }} style={btnClear}>✕ 초기화</button>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <div style={tableWrap}>
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: "#ECE7DF" }}>
              <th style={{ ...th, width: "48px" }}>첨부</th>
              <th style={{ ...th, width: "110px" }}>게시판명</th>
              <th style={{ ...th, textAlign: "left", minWidth: "320px" }}>제목</th>
              <th style={{ ...th, width: "100px" }}>등록자</th>
              <th style={{ ...th, width: "110px" }}>등록일</th>
              <th style={{ ...th, width: "72px" }}>조회</th>
              {isAdmin && <th style={{ ...th, width: "100px" }}>관리</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isAdmin ? 7 : 6} style={emptyTd}>데이터를 불러오는 중...</td></tr>
            ) : notices.length === 0 ? (
              <tr><td colSpan={isAdmin ? 7 : 6} style={emptyTd}>등록된 공지사항이 없습니다.</td></tr>
            ) : notices.map((n, i) => (
              <tr
                key={n.id}
                style={{ borderTop: "1px solid rgba(0,0,0,0.05)", background: i % 2 === 0 ? "#fff" : "#fafaf8", transition: "background 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(99,102,241,0.04)")}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafaf8")}
              >
                <td style={{ ...td, textAlign: "center" }}>
                  {n.has_attachment && n.attachment_url
                    ? n.attachment_url.split("|").map((url, i) => {
                        const names = n.attachment_name?.split("|") || [];
                        return (
                          <a key={i} href={url} target="_blank" rel="noreferrer" title={names[i] || "첨부파일"} onClick={e => e.stopPropagation()} style={{ textDecoration: "none", marginRight: "2px" }}>📎</a>
                        );
                      })
                    : ""}
                </td>
                <td style={{ ...td, textAlign: "center" }}>
                  <span style={badgeStyle}>{n.board_name}</span>
                </td>
                <td
                  style={{ ...td, textAlign: "left", cursor: "pointer", fontWeight: 500 }}
                  onClick={() => openDetail(n)}
                >
                  {n.title}
                </td>
                <td style={{ ...td, textAlign: "center" }}>{n.author}</td>
                <td style={{ ...td, textAlign: "center", color: "#777" }}>{formatDate(n.created_at)}</td>
                <td style={{ ...td, textAlign: "center", color: "#aaa" }}>{n.view_count}</td>
                {isAdmin && (
                  <td style={{ ...td, textAlign: "center" }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: "0.3rem", justifyContent: "center" }}>
                      <button onClick={() => openWrite(n)} style={smallBtn("#8B7355")}>수정</button>
                      <button onClick={() => handleDelete(n.id)} style={smallBtn("#ef4444")}>삭제</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── 렌더: 작성/수정 (풀페이지) ──
  const renderForm = () => (
    <div style={{ maxWidth: "860px" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.75rem" }}>
        <button onClick={() => setViewMode("list")} style={btnBack}>← 목록으로</button>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
          {viewMode === "edit" ? "✏️ 공지 수정" : "✏️ 공지 작성"}
        </h2>
      </div>

      {/* 폼 카드 */}
      <div style={formCard}>
        {/* 게시판명 */}
        <div style={formRow}>
          <label style={formLabel}>게시판명 <span style={{ color: "#ef4444" }}>*</span></label>
          <div style={formField}>
            {BOARD_OPTIONS.map(b => (
              <button
                key={b}
                onClick={() => setFormBoard(b)}
                style={{
                  padding: "0.4rem 1rem", borderRadius: "6px", fontSize: "0.85rem",
                  border: formBoard === b ? "2px solid #8B7355" : "1px solid rgba(0,0,0,0.12)",
                  background: formBoard === b ? "rgba(99,102,241,0.08)" : "#fff",
                  color: formBoard === b ? "#8B7355" : "#555",
                  fontWeight: formBoard === b ? 700 : 400,
                  cursor: "pointer", transition: "all 0.12s",
                }}
              >{b}</button>
            ))}
          </div>
        </div>

        {/* 제목 */}
        <div style={formRow}>
          <label style={formLabel}>제목 <span style={{ color: "#ef4444" }}>*</span></label>
          <div style={formField}>
            <input
              type="text" value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="공지 제목을 입력하세요"
              style={{ ...formInput, fontSize: "1rem", fontWeight: 500 }}
            />
          </div>
        </div>

        {/* 내용 */}
        <div style={{ ...formRow, alignItems: "flex-start" }}>
          <label style={{ ...formLabel, paddingTop: "0.5rem" }}>내용 <span style={{ color: "#ef4444" }}>*</span></label>
          <div style={formField}>
            <textarea
              value={formContent}
              onChange={e => setFormContent(e.target.value)}
              placeholder="공지 내용을 입력하세요"
              rows={14}
              style={{ ...formInput, resize: "vertical", lineHeight: 1.75, fontFamily: "inherit" }}
            />
            <div style={{ fontSize: "0.75rem", color: "#bbb", textAlign: "right", marginTop: "0.25rem" }}>
              {formContent.length}자
            </div>
          </div>
        </div>

        {/* 첨부파일 */}
        <div style={{ ...formRow, alignItems: "flex-start" }}>
          <label style={{ ...formLabel, paddingTop: "0.4rem" }}>첨부파일</label>
          <div style={{ ...formField, flexDirection: "column", gap: "0.5rem" }}>
            <input
              type="file"
              multiple
              onChange={e => {
                const files = Array.from(e.target.files || []);
                setFormFiles(prev => {
                  const names = new Set(prev.map(f => f.name));
                  return [...prev, ...files.filter(f => !names.has(f.name))];
                });
                e.target.value = ""; // 같은 파일 재선택 허용
              }}
              style={{ fontSize: "0.85rem" }}
            />
            <div style={{ fontSize: "0.75rem", color: "#bbb" }}>여러 파일 선택 가능, 같은 파일은 중복 추가되지 않음</div>

            {/* 새로 선택한 파일 목록 */}
            {formFiles.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {formFiles.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.83rem", color: "#444", background: "rgba(99,102,241,0.05)", borderRadius: "6px", padding: "0.3rem 0.6rem" }}>
                    <span>📎</span>
                    <span style={{ flex: 1 }}>{f.name} <span style={{ color: "#aaa" }}>({(f.size / 1024).toFixed(1)} KB)</span></span>
                    <button
                      type="button"
                      onClick={() => setFormFiles(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: "0.9rem", padding: 0 }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* 기존 첨부 (수정 시, 새 파일 없을 때) */}
            {editTarget?.has_attachment && formFiles.length === 0 && editTarget.attachment_name && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.78rem", color: "#999" }}>기존 첨부파일:</span>
                {editTarget.attachment_name.split("|").map((name, i) => {
                  const urls = editTarget.attachment_url?.split("|") || [];
                  return (
                    <a key={i} href={urls[i] || "#"} target="_blank" rel="noreferrer" style={{ fontSize: "0.83rem", color: "#8B7355" }}>
                      📎 {name}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 등록자 (읽기전용) */}
        <div style={formRow}>
          <label style={formLabel}>등록자</label>
          <div style={formField}>
            <span style={{ fontSize: "0.88rem", color: "#777", padding: "0.5rem 0" }}>{userName}</span>
          </div>
        </div>

        {/* 버튼 */}
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem", paddingTop: "1.25rem", borderTop: "1px solid rgba(0,0,0,0.07)" }}>
          <button onClick={() => setViewMode("list")} style={btnCancel} disabled={formSaving}>취소</button>
          <button onClick={handleSave} style={{ ...btnPrimary, height: "40px", padding: "0 1.5rem", fontSize: "0.9rem" }} disabled={formSaving}>
            {formSaving ? "저장 중..." : (viewMode === "edit" ? "수정 완료" : "등록")}
          </button>
        </div>
      </div>
    </div>
  );

  // ── 렌더: 상세보기 ──
  const renderDetail = () => {
    if (!detailNotice) return null;
    const n = notices.find(x => x.id === detailNotice.id) || detailNotice;
    return (
      <div style={{ maxWidth: "860px" }}>
        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.75rem" }}>
          <button onClick={() => setViewMode("list")} style={btnBack}>← 목록으로</button>
          {isAdmin && (
            <>
              <button onClick={() => openWrite(n)} style={{ ...btnBack, color: "#8B7355", borderColor: "rgba(99,102,241,0.3)" }}>수정</button>
              <button onClick={() => handleDelete(n.id)} style={{ ...btnBack, color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}>삭제</button>
            </>
          )}
        </div>

        <div style={formCard}>
          {/* 게시판 뱃지 + 제목 */}
          <div style={{ marginBottom: "1.25rem" }}>
            <span style={{ ...badgeStyle, fontSize: "0.78rem", marginBottom: "0.6rem", display: "inline-block" }}>{n.board_name}</span>
            <h1 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 0.75rem", lineHeight: 1.4 }}>{n.title}</h1>
            <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.82rem", color: "#888", paddingBottom: "1rem", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
              <span>등록자: <strong style={{ color: "#444" }}>{n.author}</strong></span>
              <span>등록일: <strong style={{ color: "#444" }}>{formatDate(n.created_at)}</strong></span>
              <span>조회: <strong style={{ color: "#444" }}>{n.view_count}</strong></span>
            </div>
          </div>

          {/* 첨부파일 */}
          {n.has_attachment && n.attachment_name && (
            <div style={{
              background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)",
              borderRadius: "8px", padding: "0.65rem 1rem",
              marginBottom: "1.25rem", display: "flex", flexDirection: "column", gap: "0.35rem",
              fontSize: "0.85rem",
            }}>
              {n.attachment_name.split("|").map((name, i) => {
                const urls = n.attachment_url?.split("|") || [];
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>📎</span>
                    <a href={urls[i] || "#"} target="_blank" rel="noreferrer" style={{ color: "#8B7355", fontWeight: 600 }}>
                      {name}
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          {/* 본문 */}
          <div style={{
            fontSize: "0.93rem", lineHeight: 1.85,
            whiteSpace: "pre-wrap", color: "var(--text-primary)",
            minHeight: "200px",
          }}>
            {n.content}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "1.5rem 2rem" }}>
      {viewMode === "list" && renderList()}
      {(viewMode === "write" || viewMode === "edit") && renderForm()}
      {viewMode === "detail" && renderDetail()}
    </div>
  );
}

// ── 공통 스타일 ──
const btnPrimary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.35rem",
  height: "36px", padding: "0 1.1rem", borderRadius: "8px",
  background: "transparent", border: "1.5px solid #8E7E6B",
  color: "#8E7E6B", fontSize: "0.85rem", fontWeight: 600,
  cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
};

const btnBack: React.CSSProperties = {
  height: "34px", padding: "0 0.9rem", borderRadius: "7px",
  border: "1px solid rgba(0,0,0,0.14)", background: "#fff",
  color: "#555", fontSize: "0.84rem", cursor: "pointer",
};

const btnCancel: React.CSSProperties = {
  height: "40px", padding: "0 1.2rem", borderRadius: "8px",
  border: "1px solid rgba(0,0,0,0.12)", background: "#fff",
  color: "#555", fontSize: "0.88rem", cursor: "pointer",
};

const btnSearch: React.CSSProperties = {
  height: "32px", padding: "0 0.9rem", borderRadius: "6px",
  background: "transparent", border: "1.5px solid #8E7E6B",
  color: "#8E7E6B", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
};

const btnClear: React.CSSProperties = {
  height: "32px", padding: "0 0.75rem", borderRadius: "6px",
  border: "1px solid rgba(0,0,0,0.1)", background: "#fff",
  color: "#888", fontSize: "0.8rem", cursor: "pointer",
};

const filterBarStyle: React.CSSProperties = {
  background: "#fff", border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: "10px", padding: "0.85rem 1.2rem",
  marginBottom: "1rem", display: "flex", flexWrap: "wrap",
  gap: "0.75rem", alignItems: "center",
};

const filterLabel: React.CSSProperties = {
  fontSize: "0.8rem", fontWeight: 700, color: "#555", whiteSpace: "nowrap",
};

const filterInput: React.CSSProperties = {
  height: "32px", padding: "0 0.6rem",
  border: "1px solid rgba(0,0,0,0.12)", borderRadius: "6px",
  fontSize: "0.83rem", background: "#fff", outline: "none",
  color: "var(--text-primary)",
};

const tableWrap: React.CSSProperties = {
  background: "#fff", border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: "10px", overflow: "hidden",
};

const tableStyle: React.CSSProperties = {
  width: "100%", borderCollapse: "collapse",
  textAlign: "center", whiteSpace: "nowrap",
};

const th: React.CSSProperties = {
  padding: "0.7rem 0.9rem", fontWeight: 700,
  fontSize: "0.8rem", color: "#5c534a",
  borderBottom: "1px solid rgba(0,0,0,0.07)",
};

const td: React.CSSProperties = {
  padding: "0.7rem 0.9rem",
  fontSize: "0.85rem", color: "var(--text-primary)",
  borderRight: "1px solid rgba(0,0,0,0.04)",
};

const emptyTd: React.CSSProperties = {
  padding: "3rem", color: "#aaa", fontSize: "0.88rem", textAlign: "center",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block", padding: "0.15rem 0.6rem",
  borderRadius: "999px", fontSize: "0.74rem", fontWeight: 600,
  background: "rgba(99,102,241,0.1)", color: "#5254b3",
};

const formCard: React.CSSProperties = {
  background: "#fff", border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: "12px", padding: "2rem 2.25rem",
  display: "flex", flexDirection: "column", gap: "1.25rem",
  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
};

const formRow: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "1rem",
};

const formLabel: React.CSSProperties = {
  fontSize: "0.85rem", fontWeight: 700, color: "#444",
  minWidth: "72px", textAlign: "right", flexShrink: 0,
};

const formField: React.CSSProperties = {
  flex: 1, display: "flex", gap: "0.5rem",
};

const formInput: React.CSSProperties = {
  width: "100%", padding: "0.6rem 0.85rem",
  border: "1px solid rgba(0,0,0,0.13)", borderRadius: "7px",
  fontSize: "0.9rem", background: "#fff",
  color: "var(--text-primary)", outline: "none",
  transition: "border-color 0.15s",
  boxSizing: "border-box",
};

function smallBtn(color: string): React.CSSProperties {
  return {
    padding: "0.22rem 0.65rem", borderRadius: "5px", border: "none",
    background: color + "18", color, cursor: "pointer",
    fontSize: "0.75rem", fontWeight: 600,
  };
}
