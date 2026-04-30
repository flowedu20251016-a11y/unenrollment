"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

interface InputRecordType {
  id: string; rowIndex: number;
  colA: string; downloadDate: string; code: string; classType1: string; classType2: string; className: string; studentName: string;
  startDate: string; endDate: string; school: string; grade: string; studentId: string; realDropDate: string; lastAttend: string;
  vReason1: string; wReason2: string; xFileLink: string; yDetail: string;
  zAdminReason1: string; aaAdminReason2: string; abAdminDetail: string;
  status: string;
}

interface CategoryOptions {
  label: string;
  requireProof: boolean;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [records, setRecords] = useState<InputRecordType[]>([]);
  const [headers, setHeaders] = useState<any>({});
  const [categories, setCategories] = useState<Record<string, CategoryOptions[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"live" | "closed" | "accumulated">("live");

  // 실시간 탭 필터
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);

  // 마감완료 탭 필터
  const [closedYear, setClosedYear] = useState<string>("all");
  const [closedMonth, setClosedMonth] = useState<string>("all");
  const [closedCode, setClosedCode] = useState<string>("all");

  // 누적 데이터 탭
  const [accMonth, setAccMonth] = useState<string>("all");
  const [accInputRecords, setAccInputRecords] = useState<InputRecordType[]>([]);
  const [accLoading, setAccLoading] = useState(false);
  const [accLoaded, setAccLoaded] = useState(false);

  const fetchRecords = () => {
    setLoading(true);
    fetch("/api/records/input")
      .then(res => res.json())
      .then(data => {
        setRecords(data.records || []);
        setHeaders(data.headers || {});
        setCategories(data.categories || {});
        setLoading(false);
      });
  };

  useEffect(() => {
    const sessionStr = localStorage.getItem("dropout_user");
    if (!sessionStr) { alert("로그인이 필요합니다."); router.push("/login"); return; }
    const user = JSON.parse(sessionStr);
    if (user.role !== "admin") { alert("기조실 권한이 없습니다."); router.push("/dashboard/editor"); return; }
    fetchRecords();
  }, []);

  const fetchAccumulatedData = () => {
    setAccLoading(true);
    fetch("/api/records/input?tab=누적최종", { cache: "no-store" })
      .then(res => res.json())
      .then(data => {
        setAccInputRecords(data.records || []);
        setAccLoaded(true);
        setAccLoading(false);
      });
  };

  const accMonthOptions = useMemo(
    () => Array.from(new Set(accInputRecords.map(r => r.colA).filter(Boolean))).sort().reverse() as string[],
    [accInputRecords]
  );

  const filteredAccInputRecords = useMemo(
    () => accMonth === "all" ? accInputRecords : accInputRecords.filter(r => r.colA === accMonth),
    [accInputRecords, accMonth]
  );

  // ── 공통 옵션 ──
  const monthOptions = useMemo(
    () => Array.from(new Set(records.map(r => r.colA).filter(Boolean))).sort().reverse(),
    [records]
  );
  const codeOptions = useMemo(
    () => Array.from(new Set(records.map(r => r.code).filter(Boolean))).sort() as string[],
    [records]
  );

  // ── 실시간 탭 ──
  const monthFilteredRecords = useMemo(
    () => selectedMonth === "all" ? records : records.filter(r => r.colA === selectedMonth),
    [records, selectedMonth]
  );
  const codeStats = useMemo(() => {
    const stats: Record<string, { total: number; written: number; allClosed: boolean }> = {};
    codeOptions.forEach(code => {
      const recs = monthFilteredRecords.filter(r => r.code === code);
      stats[code] = {
        total: recs.length,
        written: recs.filter(r => r.vReason1).length,
        allClosed: recs.length > 0 && recs.every(r => r.status === "closed"),
      };
    });
    return stats;
  }, [monthFilteredRecords, codeOptions]);

  const toggleCode = (code: string) =>
    setSelectedCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  const toggleAllCodes = () =>
    setSelectedCodes(prev => prev.length === codeOptions.length ? [] : [...codeOptions]);

  const liveRecords = useMemo(() => {
    const base = monthFilteredRecords.filter(r => r.status !== "closed");
    if (selectedCodes.length === 0) return base;
    return base.filter(r => selectedCodes.includes(r.code));
  }, [monthFilteredRecords, selectedCodes]);

  // ── 마감완료 탭 ──
  const closedRecords = useMemo(() => records.filter(r => r.status === "closed"), [records]);

  // 연도 추출 (colA 형식: "2026- 3" 또는 "2026-03" 등)
  const yearOptions = useMemo(() =>
    Array.from(new Set(closedRecords.map(r => r.colA?.split(/[-년]/)[0]?.trim()).filter(Boolean))).sort().reverse(),
    [closedRecords]
  );
  const closedMonthOptions = useMemo(() => {
    const base = closedYear === "all" ? closedRecords : closedRecords.filter(r => r.colA?.startsWith(closedYear));
    return Array.from(new Set(base.map(r => r.colA).filter(Boolean))).sort().reverse();
  }, [closedRecords, closedYear]);
  const closedCodeOptions = useMemo(() =>
    Array.from(new Set(closedRecords.map(r => r.code).filter(Boolean))).sort(),
    [closedRecords]
  );

  const filteredClosedRecords = useMemo(() => {
    return closedRecords.filter(r => {
      if (closedYear !== "all" && !r.colA?.startsWith(closedYear)) return false;
      if (closedMonth !== "all" && r.colA !== closedMonth) return false;
      if (closedCode !== "all" && r.code !== closedCode) return false;
      return true;
    });
  }, [closedRecords, closedYear, closedMonth, closedCode]);

  // ── API ──
  const updateStatusAPI = async (updates: any[]) => {
    try {
      const res = await fetch("/api/records/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "admin_save", updates }),
      });
      if (!res.ok) throw new Error("서버 오류");
      fetchRecords();
    } catch { alert("업데이트 중 오류가 발생했습니다."); }
  };

  const handleCodeClose = async (code: string, action: "close" | "open") => {
    const recs = monthFilteredRecords.filter(r => r.code === code);
    if (recs.length === 0) return;
    if (!confirm(`[${code}] ${recs.length}건을 ${action === "close" ? "마감" : "마감 해제"}하시겠습니까?`)) return;
    await updateStatusAPI(recs.map(r => ({
      rowIndex: r.rowIndex, zAdminReason1: r.zAdminReason1,
      aaAdminReason2: r.aaAdminReason2, abAdminDetail: r.abAdminDetail,
      status: action === "close" ? "closed" : "pending",
    })));
    alert(`${action === "close" ? "마감" : "마감 해제"} 완료!`);
  };

  const handleBulkClose = () => {
    if (selectedMonth === "all") return alert("먼저 특정 [월]을 선택해주세요.");
    const targets = (selectedCodes.length === 0 ? monthFilteredRecords : monthFilteredRecords.filter(r => selectedCodes.includes(r.code)))
      .filter(r => r.status !== "closed");
    if (targets.length === 0) return alert("이미 모든 데이터가 마감되었습니다.");
    if (!confirm(`${targets.length}건을 모두 마감하시겠습니까?`)) return;
    updateStatusAPI(targets.map(r => ({
      rowIndex: r.rowIndex, zAdminReason1: r.zAdminReason1,
      aaAdminReason2: r.aaAdminReason2, abAdminDetail: r.abAdminDetail, status: "closed",
    })));
  };

  const handleAdminFieldChange = (id: string, field: "zAdminReason1" | "aaAdminReason2" | "abAdminDetail", val: string) =>
    setRecords(records.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: val };
      if (field === "zAdminReason1") updated.aaAdminReason2 = "";
      return updated;
    }));

  const handleSaveAdminData = (r: InputRecordType) => updateStatusAPI([{
    rowIndex: r.rowIndex, zAdminReason1: r.zAdminReason1,
    aaAdminReason2: r.aaAdminReason2, abAdminDetail: r.abAdminDetail, status: r.status,
  }]);

  const allSelected = selectedCodes.length === 0 || selectedCodes.length === codeOptions.length;

  // 마감완료 탭 통계
  const closedStats = useMemo(() => {
    const byCode: Record<string, number> = {};
    filteredClosedRecords.forEach(r => { byCode[r.code] = (byCode[r.code] || 0) + 1; });
    return { total: filteredClosedRecords.length, byCode };
  }, [filteredClosedRecords]);

  return (
    <>
      <div className="dashboard-header-text" style={{ marginBottom: "1rem" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>🛡️ 관리자 페이지</h2>
        <p>사업부 작성 데이터 확인 및 관리</p>
      </div>

      {/* 탭 버튼 */}
      <div className="tabs-container" style={{ marginBottom: "1rem" }}>
        <button className={`tab-button ${activeTab === "live" ? "active" : ""}`} onClick={() => setActiveTab("live")}>
          📋 실시간 작성 현황
        </button>
        <button className={`tab-button ${activeTab === "closed" ? "active" : ""}`} onClick={() => setActiveTab("closed")}>
          🔒 마감완료 내역 <span style={{ marginLeft: "0.4rem", fontSize: "0.75rem", background: "rgba(220,38,38,0.08)", color: "#dc2626", padding: "0.1rem 0.4rem", borderRadius: "999px" }}>{closedRecords.length}</span>
        </button>
        <button className={`tab-button ${activeTab === "accumulated" ? "active" : ""}`} onClick={() => { setActiveTab("accumulated"); if (!accLoaded) fetchAccumulatedData(); }}>
          📦 누적 데이터
        </button>
      </div>

      {/* ══════════════════════════════════════
          TAB 1: 실시간 작성 현황
      ══════════════════════════════════════ */}
      {activeTab === "live" && (
        <>
          {/* 컨트롤 */}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 600 }}>📅 월:</span>
              <select className="filter-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                <option value="all">전체보기</option>
                {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* 월별 마감 버튼 */}
            <div style={{
              display: "flex", alignItems: "center", gap: "0.6rem",
              padding: "0.45rem 0.9rem", borderRadius: "8px",
              background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.20)",
            }}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>🔒 월별 마감:</span>
              {selectedMonth === "all" ? (
                <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", opacity: 0.5 }}>위에서 월을 선택하세요</span>
              ) : (
                <>
                  <span style={{ fontSize: "0.82rem", color: "#d97706", fontWeight: 700 }}>{selectedMonth}</span>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    미마감 {monthFilteredRecords.filter(r => r.status !== "closed").length}건
                  </span>
                  <button
                    onClick={handleBulkClose}
                    disabled={monthFilteredRecords.filter(r => r.status !== "closed").length === 0}
                    style={{
                      padding: "0.3rem 0.9rem", fontSize: "0.82rem", cursor: "pointer",
                      background: monthFilteredRecords.filter(r => r.status !== "closed").length === 0
                        ? "rgba(0,0,0,0.04)" : "rgba(220,38,38,0.75)",
                      border: "none", borderRadius: "6px", color: "white", fontWeight: 600,
                      opacity: monthFilteredRecords.filter(r => r.status !== "closed").length === 0 ? 0.4 : 1,
                    }}
                  >
                    ⛔ {selectedMonth} 전체 마감
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 수익코드 필터 */}
          <div style={{ padding: "0.75rem 1rem", background: "rgba(0,0,0,0.02)", borderRadius: "8px", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>수익코드:</span>
            <button onClick={toggleAllCodes} style={{
              padding: "0.25rem 0.8rem", borderRadius: "999px", fontSize: "0.78rem", cursor: "pointer",
              border: allSelected ? "1px solid #6366f1" : "1px solid rgba(0,0,0,0.12)",
              background: allSelected ? "rgba(79,70,229,0.12)" : "transparent",
              color: allSelected ? "#4f46e5" : "var(--text-secondary)",
            }}>전체</button>
            {codeOptions.map(code => {
              const stat = codeStats[code] || { total: 0, written: 0, allClosed: false };
              const active = selectedCodes.includes(code);
              const statusLabel = stat.allClosed ? "🔒 마감됨"
                : stat.written === 0 ? "미작성"
                : stat.written === stat.total ? "전송완료" : "작성중";
              const statusColor = stat.allClosed ? "#dc2626"
                : stat.written === 0 ? "var(--text-secondary)"
                : stat.written === stat.total ? "#059669" : "#d97706";
              return (
                <div key={code} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <button onClick={() => toggleCode(code)} style={{
                    padding: "0.25rem 0.9rem", borderRadius: "999px", fontSize: "0.78rem", cursor: "pointer",
                    border: active ? "1px solid #6366f1" : "1px solid rgba(0,0,0,0.12)",
                    background: active ? "rgba(79,70,229,0.12)" : "transparent",
                    color: active ? "#4f46e5" : "var(--text-secondary)",
                    display: "flex", alignItems: "center", gap: "0.4rem",
                  }}>
                    <span style={{ fontWeight: 700 }}>{code}</span>
                    <span style={{ fontSize: "0.7rem", color: statusColor, whiteSpace: "nowrap" }}>
                      {statusLabel}{!stat.allClosed && stat.total > 0 && <span style={{ opacity: 0.7 }}> {stat.written}/{stat.total}</span>}
                    </span>
                  </button>
                  {stat.total > 0 && (
                    <button onClick={() => handleCodeClose(code, stat.allClosed ? "open" : "close")} style={{
                      padding: "0.15rem 0.55rem", borderRadius: "4px", fontSize: "0.7rem", cursor: "pointer",
                      border: stat.allClosed ? "1px solid rgba(217,119,6,0.5)" : "1px solid rgba(220,38,38,0.3)",
                      background: stat.allClosed ? "rgba(217,119,6,0.10)" : "rgba(220,38,38,0.08)",
                      color: stat.allClosed ? "#d97706" : "#dc2626", whiteSpace: "nowrap",
                    }}>{stat.allClosed ? "해제" : "마감"}</button>
                  )}
                </div>
              );
            })}
          </div>

          {/* 통계 */}
          <div style={{ padding: "0.4rem 0.5rem", marginBottom: "0.5rem", fontSize: "0.82rem", display: "flex", gap: "1.5rem", color: "var(--text-secondary)" }}>
            <span>총 <b style={{ color: "var(--text-primary)" }}>{liveRecords.length}</b>건</span>
            <span style={{ color: "#4f46e5" }}>작성완료 <b>{liveRecords.filter(r => r.vReason1).length}</b>건</span>
            <span style={{ color: "#dc2626" }}>미작성 <b>{liveRecords.filter(r => !r.vReason1).length}</b>건</span>
          </div>

          {/* 테이블 */}
          <div className="glass-container" style={{ padding: 0 }}>
            {loading ? <p style={{ padding: "2rem" }}>동기화 중...</p> : (
              <div className="data-table-container">
                <table className="data-table" style={{ fontSize: "0.83rem" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg-secondary)" }}>
                    <tr>
                      <th rowSpan={2}>#</th>
                      <th colSpan={3} style={{ background: "rgba(5,150,105,0.12)", color: "#059669" }}>기조실 확정 (편집 가능)</th>
                      <th colSpan={4} style={{ background: "rgba(79,70,229,0.10)", color: "#4f46e5" }}>사업부 작성 (읽기 전용)</th>
                      <th rowSpan={2}>{headers.studentName || "학생명"}</th>
                      <th rowSpan={2}>{headers.code || "수익코드"}</th>
                      <th rowSpan={2}>{headers.className || "반명"}</th>
                      <th rowSpan={2}>{headers.colA || "년월"}</th>
                      <th rowSpan={2}>상태</th>
                    </tr>
                    <tr style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      <th style={{ background: "rgba(5,150,105,0.06)" }}>{headers.zAdminReason1 || "사유(기조실)"}</th>
                      <th style={{ background: "rgba(5,150,105,0.06)" }}>{headers.aaAdminReason2 || "종류(기조실)"}</th>
                      <th style={{ background: "rgba(5,150,105,0.06)", borderRight: "1px solid rgba(0,0,0,0.08)" }}>{headers.abAdminDetail || "상세(기조실)"}</th>
                      <th style={{ background: "rgba(79,70,229,0.06)", color: "#4f46e5" }}>{headers.vReason1 || "퇴원사유"}</th>
                      <th style={{ background: "rgba(79,70,229,0.06)", color: "#4f46e5" }}>{headers.wReason2 || "퇴원종류"}</th>
                      <th style={{ background: "rgba(79,70,229,0.06)", color: "#4f46e5" }}>{headers.yDetail || "상세내역"}</th>
                      <th style={{ background: "rgba(79,70,229,0.06)", color: "#4f46e5", borderRight: "1px solid rgba(0,0,0,0.08)" }}>증빙</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveRecords.length === 0
                      ? <tr><td colSpan={13} style={{ textAlign: "center", padding: "3rem", opacity: 0.5 }}>데이터가 없습니다.</td></tr>
                      : liveRecords.map((r, idx) => {
                          const adminOptions = categories[r.zAdminReason1] || [];
                          return (
                            <tr key={r.id}>
                              <td style={{ color: "var(--text-secondary)", textAlign: "center" }}>{idx + 1}</td>

                              {/* 기조실 확정 3종 — 편집 가능 */}
                              <td>
                                <select className="input-field"
                                  value={r.zAdminReason1 || ""}
                                  onChange={e => handleAdminFieldChange(r.id, "zAdminReason1", e.target.value)}
                                  onBlur={() => handleSaveAdminData(r)}
                                  style={{ minWidth: "110px", fontSize: "0.8rem" }}>
                                  <option value="">- 선택 -</option>
                                  {Object.keys(categories).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <select className="input-field"
                                  value={r.aaAdminReason2 || ""}
                                  onChange={e => handleAdminFieldChange(r.id, "aaAdminReason2", e.target.value)}
                                  onBlur={() => handleSaveAdminData(r)}
                                  disabled={!r.zAdminReason1}
                                  style={{ minWidth: "140px", fontSize: "0.8rem" }}>
                                  <option value="">- 선택 -</option>
                                  {adminOptions.map(opt => (
                                    <option key={opt.label} value={opt.label}>{opt.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td style={{ borderRight: "1px solid rgba(0,0,0,0.08)" }}>
                                <input type="text" className="input-field"
                                  placeholder="상세 내용..."
                                  value={r.abAdminDetail || ""}
                                  onChange={e => handleAdminFieldChange(r.id, "abAdminDetail", e.target.value)}
                                  onBlur={() => handleSaveAdminData(r)}
                                  style={{ minWidth: "150px", fontSize: "0.8rem" }}
                                />
                              </td>

                              {/* 사업부 작성 4종 — 읽기 전용 */}
                              <td style={{ opacity: 0.6 }}>{r.vReason1 || <span style={{ opacity: 0.4 }}>-</span>}</td>
                              <td style={{ opacity: 0.6 }}>{r.wReason2 || <span style={{ opacity: 0.4 }}>-</span>}</td>
                              <td style={{ opacity: 0.6, fontSize: "0.78rem" }}>{r.yDetail || <span style={{ opacity: 0.4 }}>-</span>}</td>
                              <td style={{ borderRight: "1px solid rgba(0,0,0,0.08)" }}>
                                {r.xFileLink ? <a href={r.xFileLink} target="_blank" rel="noreferrer" style={{ color: "#059669" }}>📎</a> : <span style={{ opacity: 0.4 }}>-</span>}
                              </td>

                              {/* 퇴원생 정보 */}
                              <td style={{ color: "#2563eb", fontWeight: 600 }}>{r.studentName}</td>
                              <td style={{ fontWeight: 700, color: "var(--accent-primary)" }}>{r.code}</td>
                              <td>{r.className}</td>
                              <td style={{ color: "var(--text-secondary)" }}>{r.colA}</td>
                              <td style={{ textAlign: "center" }}>
                                <span style={{ fontSize: "0.75rem", color: r.vReason1 ? "#059669" : "var(--text-secondary)", fontWeight: 600 }}>
                                  {r.vReason1 ? "✅ 전송완료" : "⏳ 미작성"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                    }
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════
          TAB 2: 마감완료 내역
      ══════════════════════════════════════ */}
      {activeTab === "closed" && (
        <>
          {/* 필터 */}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.75rem", background: "rgba(0,0,0,0.02)", padding: "0.75rem 1rem", borderRadius: "8px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>🔍 필터:</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>연도</span>
              <select className="filter-select" value={closedYear} onChange={e => { setClosedYear(e.target.value); setClosedMonth("all"); }}>
                <option value="all">전체</option>
                {yearOptions.map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>월</span>
              <select className="filter-select" value={closedMonth} onChange={e => setClosedMonth(e.target.value)}>
                <option value="all">전체</option>
                {closedMonthOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>수익코드</span>
              <select className="filter-select" value={closedCode} onChange={e => setClosedCode(e.target.value)}>
                <option value="all">전체</option>
                {closedCodeOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* 통계 */}
          <div style={{ padding: "0.4rem 0.5rem", marginBottom: "0.5rem", fontSize: "0.82rem", display: "flex", gap: "1.5rem", flexWrap: "wrap", color: "var(--text-secondary)" }}>
            <span>총 <b style={{ color: "#dc2626" }}>{closedStats.total}</b>건 마감</span>
            {Object.entries(closedStats.byCode).map(([code, cnt]) => (
              <span key={code}><b style={{ color: "var(--accent-primary)" }}>{code}</b> {cnt}건</span>
            ))}
          </div>

          {/* 테이블 */}
          <div className="glass-container" style={{ padding: 0 }}>
            {loading ? <p style={{ padding: "2rem" }}>동기화 중...</p> : (
              <div className="data-table-container">
                <table className="data-table" style={{ fontSize: "0.83rem" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg-secondary)" }}>
                    <tr>
                      <th>#</th>
                      <th>{headers.colA || "년월"}</th>
                      <th>{headers.code || "수익코드"}</th>
                      <th>{headers.className || "반명"}</th>
                      <th>{headers.studentName || "학생명"}</th>
                      <th>{headers.vReason1 || "퇴원사유"}</th>
                      <th>{headers.wReason2 || "퇴원종류"}</th>
                      <th>{headers.yDetail || "상세내역"}</th>
                      <th>증빙</th>
                      <th style={{ background: "rgba(0,0,0,0.04)" }}>기조실 메모</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClosedRecords.length === 0
                      ? <tr><td colSpan={10} style={{ textAlign: "center", padding: "3rem", opacity: 0.5 }}>마감완료 데이터가 없습니다.</td></tr>
                      : filteredClosedRecords.map((r, idx) => (
                        <tr key={r.id} style={{ background: "rgba(0,0,0,0.02)" }}>
                          <td style={{ color: "var(--text-secondary)", textAlign: "center" }}>{idx + 1}</td>
                          <td style={{ color: "var(--text-secondary)" }}>{r.colA}</td>
                          <td style={{ fontWeight: 700, color: "var(--accent-primary)" }}>{r.code}</td>
                          <td>{r.className}</td>
                          <td style={{ color: "#2563eb", fontWeight: 600 }}>{r.studentName}</td>
                          <td>{r.vReason1 || <span style={{ opacity: 0.4 }}>-</span>}</td>
                          <td>{r.wReason2 || <span style={{ opacity: 0.4 }}>-</span>}</td>
                          <td style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>{r.yDetail || <span style={{ opacity: 0.4 }}>-</span>}</td>
                          <td>{r.xFileLink ? <a href={r.xFileLink} target="_blank" rel="noreferrer" style={{ color: "#059669" }}>📎</a> : <span style={{ opacity: 0.4 }}>-</span>}</td>
                          <td style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>{r.zAdminReason1 || <span style={{ opacity: 0.4 }}>-</span>}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════
          TAB 3: 누적 데이터
      ══════════════════════════════════════ */}
      {activeTab === "accumulated" && (
        <>
          {/* 월 선택 */}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.75rem", background: "rgba(0,0,0,0.02)", padding: "0.75rem 1rem", borderRadius: "8px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>📅 월 선택:</span>
            <select className="filter-select" value={accMonth} onChange={e => setAccMonth(e.target.value)}>
              <option value="all">전체</option>
              {accMonthOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              총 <b style={{ color: "var(--text-primary)" }}>{filteredAccInputRecords.length}</b>건
            </span>
          </div>

          <div className="glass-container" style={{ padding: 0 }}>
            {accLoading ? <p style={{ padding: "2rem" }}>동기화 중...</p> : (
              <div className="data-table-container">
                <table className="data-table" style={{ fontSize: "0.83rem" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg-secondary)" }}>
                    <tr>
                      <th>#</th>
                      <th>년월</th>
                      <th>수익코드</th>
                      <th>반명</th>
                      <th>학생명</th>
                      <th>퇴원사유(분류1)</th>
                      <th>퇴원종류(분류2)</th>
                      <th>상세내역</th>
                      <th>증빙</th>
                      <th>기조실 사유</th>
                      <th>기조실 종류</th>
                      <th>기조실 비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccInputRecords.length === 0
                      ? <tr><td colSpan={12} style={{ textAlign: "center", padding: "3rem", opacity: 0.5 }}>누적 데이터가 없습니다.</td></tr>
                      : filteredAccInputRecords.map((r, idx) => (
                        <tr key={r.id} style={{ background: "rgba(0,0,0,0.02)" }}>
                          <td style={{ color: "var(--text-secondary)", textAlign: "center" }}>{idx + 1}</td>
                          <td style={{ color: "var(--text-secondary)" }}>{r.colA}</td>
                          <td style={{ fontWeight: 700, color: "var(--accent-primary)" }}>{r.code}</td>
                          <td>{r.className}</td>
                          <td style={{ color: "#2563eb", fontWeight: 600 }}>{r.studentName}</td>
                          <td>{r.vReason1 || <span style={{ opacity: 0.4 }}>-</span>}</td>
                          <td>{r.wReason2 || <span style={{ opacity: 0.4 }}>-</span>}</td>
                          <td style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>{r.yDetail || <span style={{ opacity: 0.4 }}>-</span>}</td>
                          <td>{r.xFileLink ? <a href={r.xFileLink} target="_blank" rel="noreferrer" style={{ color: "#059669" }}>📎</a> : <span style={{ opacity: 0.4 }}>-</span>}</td>
                          <td style={{ opacity: 0.8 }}>{r.zAdminReason1 || <span style={{ opacity: 0.4 }}>-</span>}</td>
                          <td style={{ opacity: 0.8 }}>{r.aaAdminReason2 || <span style={{ opacity: 0.4 }}>-</span>}</td>
                          <td style={{ opacity: 0.8, fontSize: "0.78rem" }}>{r.abAdminDetail || <span style={{ opacity: 0.4 }}>-</span>}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
