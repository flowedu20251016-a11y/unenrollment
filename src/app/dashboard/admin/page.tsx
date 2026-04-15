"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

interface InputRecordType {
  id: string; rowIndex: number;
  colA: string; downloadDate: string; code: string; classType1: string; classType2: string; className: string; studentName: string;
  startDate: string; endDate: string; school: string; grade: string; studentId: string; realDropDate: string; lastAttend: string;
  vReason1: string; wReason2: string; xFileLink: string; yDetail: string; zAdminReason1: string; aaAdminReason2: string; abAdminDetail: string;
  status: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [records, setRecords] = useState<InputRecordType[]>([]);
  const [headers, setHeaders] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);

  const fetchRecords = () => {
    setLoading(true);
    fetch("/api/records/input")
      .then(res => res.json())
      .then(data => {
        setRecords(data.records || []);
        setHeaders(data.headers || {});
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

  const monthOptions = useMemo(
    () => Array.from(new Set(records.map(r => r.colA).filter(Boolean))).sort().reverse(),
    [records]
  );
  const codeOptions = useMemo(
    () => Array.from(new Set(records.map(r => r.code).filter(Boolean))).sort() as string[],
    [records]
  );

  // 월 필터만 적용한 레코드 (코드 선택과 무관)
  const monthFilteredRecords = useMemo(
    () => selectedMonth === "all" ? records : records.filter(r => r.colA === selectedMonth),
    [records, selectedMonth]
  );

  // 수익코드별 상태 통계
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

  // 코드 토글
  const toggleCode = (code: string) =>
    setSelectedCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  const toggleAllCodes = () =>
    setSelectedCodes(prev => prev.length === codeOptions.length ? [] : [...codeOptions]);

  // 최종 필터 (월 + 코드 선택)
  const filteredRecords = useMemo(() => {
    const base = monthFilteredRecords;
    if (selectedCodes.length === 0) return base;
    return base.filter(r => selectedCodes.includes(r.code));
  }, [monthFilteredRecords, selectedCodes]);

  // API 공통 호출
  const updateStatusAPI = async (updates: any[]) => {
    try {
      const res = await fetch("/api/records/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "admin_save", updates }),
      });
      if (!res.ok) throw new Error("서버 오류");
      fetchRecords();
    } catch (e) {
      alert("업데이트 중 오류가 발생했습니다.");
    }
  };

  // 수익코드별 마감/해제
  const handleCodeClose = async (code: string, action: "close" | "open") => {
    const recs = monthFilteredRecords.filter(r => r.code === code);
    if (recs.length === 0) return;
    if (!confirm(`[${code}] ${recs.length}건을 ${action === "close" ? "마감" : "마감 해제"}하시겠습니까?`)) return;
    await updateStatusAPI(recs.map(r => ({
      rowIndex: r.rowIndex,
      zAdminReason1: r.zAdminReason1,
      aaAdminReason2: r.aaAdminReason2,
      abAdminDetail: r.abAdminDetail,
      status: action === "close" ? "closed" : "pending",
    })));
    alert(`${action === "close" ? "마감" : "마감 해제"} 완료!`);
  };

  // 일괄 마감
  const handleBulkClose = () => {
    if (selectedMonth === "all") return alert("먼저 상단에서 특정 [월]을 선택해주세요.");
    const unclosed = filteredRecords.filter(r => r.status !== "closed");
    if (unclosed.length === 0) return alert("이미 모든 데이터가 마감되었습니다.");
    if (!confirm(`화면에 표시된 ${unclosed.length}건을 모두 마감하시겠습니까?`)) return;
    updateStatusAPI(unclosed.map(r => ({
      rowIndex: r.rowIndex,
      zAdminReason1: r.zAdminReason1,
      aaAdminReason2: r.aaAdminReason2,
      abAdminDetail: r.abAdminDetail,
      status: "closed",
    })));
  };

  // 관리자 메모 변경
  const handleAdminFieldChange = (id: string, field: "zAdminReason1" | "aaAdminReason2" | "abAdminDetail", val: string) =>
    setRecords(records.map(r => r.id === id ? { ...r, [field]: val } : r));

  const handleSaveAdminData = (r: InputRecordType) => updateStatusAPI([{
    rowIndex: r.rowIndex,
    zAdminReason1: r.zAdminReason1,
    aaAdminReason2: r.aaAdminReason2,
    abAdminDetail: r.abAdminDetail,
    status: r.status,
  }]);

  const allSelected = selectedCodes.length === 0 || selectedCodes.length === codeOptions.length;

  return (
    <>
      <div className="dashboard-header-text" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>🛡️ 관리자 페이지</h2>
          <p>사업부 작성 데이터 확인 및 관리</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          {/* 월 필터 */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 600 }}>📅 월:</span>
            <select className="filter-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
              <option value="all">전체보기 (모든 달)</option>
              {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {/* 일괄 마감 */}
          <button className="btn-primary" onClick={handleBulkClose}
            style={{ background: "rgba(239,68,68,0.8)", padding: "0.5rem 1.2rem", fontSize: "0.88rem" }}>
            ⛔ 화면 목록 전체 일괄 마감
          </button>
        </div>
      </div>

      {/* 수익코드 필터 — 상태 배지 + 마감/해제 버튼 */}
      <div style={{ padding: "0.75rem 1rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600, whiteSpace: "nowrap" }}>수익코드:</span>

        <button onClick={toggleAllCodes} style={{
          padding: "0.25rem 0.8rem", borderRadius: "999px", fontSize: "0.78rem", cursor: "pointer",
          border: allSelected ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.2)",
          background: allSelected ? "rgba(99,102,241,0.25)" : "transparent",
          color: allSelected ? "#a5b4fc" : "var(--text-secondary)",
        }}>전체</button>

        {codeOptions.map(code => {
          const stat = codeStats[code] || { total: 0, written: 0, allClosed: false };
          const active = selectedCodes.includes(code);
          const statusLabel = stat.allClosed ? "🔒 마감됨"
            : stat.written === 0 ? "미작성"
            : stat.written === stat.total ? "전송완료"
            : "작성중";
          const statusColor = stat.allClosed ? "#f87171"
            : stat.written === 0 ? "rgba(255,255,255,0.4)"
            : stat.written === stat.total ? "#34d399"
            : "#fbbf24";

          return (
            <div key={code} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <button onClick={() => toggleCode(code)} style={{
                padding: "0.25rem 0.9rem", borderRadius: "999px", fontSize: "0.78rem", cursor: "pointer",
                border: active ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.2)",
                background: active ? "rgba(99,102,241,0.25)" : "transparent",
                color: active ? "#a5b4fc" : "var(--text-secondary)",
                display: "flex", alignItems: "center", gap: "0.4rem",
              }}>
                <span style={{ fontWeight: 700 }}>{code}</span>
                <span style={{ fontSize: "0.7rem", color: statusColor, whiteSpace: "nowrap" }}>
                  {statusLabel}
                  {!stat.allClosed && stat.total > 0 && (
                    <span style={{ opacity: 0.7 }}> {stat.written}/{stat.total}</span>
                  )}
                </span>
              </button>
              {stat.total > 0 && (
                <button onClick={() => handleCodeClose(code, stat.allClosed ? "open" : "close")} style={{
                  padding: "0.15rem 0.55rem", borderRadius: "4px", fontSize: "0.7rem", cursor: "pointer",
                  border: stat.allClosed ? "1px solid rgba(251,191,36,0.5)" : "1px solid rgba(239,68,68,0.4)",
                  background: stat.allClosed ? "rgba(251,191,36,0.12)" : "rgba(239,68,68,0.12)",
                  color: stat.allClosed ? "#fbbf24" : "#f87171",
                  whiteSpace: "nowrap",
                }}>{stat.allClosed ? "해제" : "마감"}</button>
              )}
            </div>
          );
        })}
      </div>

      {/* 통계 요약 */}
      <div style={{ padding: "0.5rem 1rem", marginBottom: "0.5rem", fontSize: "0.82rem", display: "flex", gap: "1.5rem", flexWrap: "wrap", color: "var(--text-secondary)" }}>
        <span>총 <b style={{ color: "var(--text-primary)" }}>{filteredRecords.length}</b>건</span>
        <span style={{ color: "#a5b4fc" }}>사업부 작성 <b>{filteredRecords.filter(r => r.vReason1).length}</b>건</span>
        <span style={{ color: "#f87171" }}>미작성 <b>{filteredRecords.filter(r => !r.vReason1).length}</b>건</span>
        <span style={{ color: "#34d399" }}>마감 <b>{filteredRecords.filter(r => r.status === "closed").length}</b>건</span>
      </div>

      {/* 데이터 테이블 */}
      <div className="glass-container" style={{ padding: "0" }}>
        {loading ? <p style={{ padding: "2rem" }}>데이터베이스와 동기화 중...</p> : (
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
                  <th>증빙자료</th>
                  <th style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>기조실 메모</th>
                  <th style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: "center", padding: "3rem", opacity: 0.5 }}>조건에 맞는 데이터가 없습니다.</td></tr>
                ) : filteredRecords.map((r, idx) => {
                  const isClosed = r.status === "closed";
                  return (
                    <tr key={r.id} style={{ background: isClosed ? "rgba(0,0,0,0.3)" : "transparent" }}>
                      <td style={{ color: "var(--text-secondary)", textAlign: "center" }}>{idx + 1}</td>
                      <td style={{ color: "var(--text-secondary)" }}>{r.colA}</td>
                      <td style={{ fontWeight: 700, color: "var(--accent-primary)" }}>{r.code}</td>
                      <td>{r.className}</td>
                      <td style={{ color: "#60a5fa", fontWeight: 600 }}>{r.studentName}</td>
                      <td>{r.vReason1 || <span style={{ opacity: 0.4 }}>-</span>}</td>
                      <td>{r.wReason2 || <span style={{ opacity: 0.4 }}>-</span>}</td>
                      <td>
                        {r.xFileLink
                          ? <a href={r.xFileLink} target="_blank" rel="noreferrer" style={{ color: "#34d399" }}>📎 보기</a>
                          : <span style={{ opacity: 0.4 }}>-</span>}
                      </td>
                      <td>
                        <input type="text" className="input-field"
                          placeholder="메모 입력 후 포커스 이탈 시 저장..."
                          value={r.zAdminReason1 || ""}
                          onChange={e => handleAdminFieldChange(r.id, "zAdminReason1", e.target.value)}
                          onBlur={() => handleSaveAdminData(r)}
                          style={{ padding: "0.35rem 0.6rem", minWidth: "160px", fontSize: "0.8rem" }}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {isClosed
                          ? <span style={{ fontSize: "0.75rem", color: "#f87171", fontWeight: 600 }}>🔒 마감됨</span>
                          : <span style={{ fontSize: "0.75rem", color: r.vReason1 ? "#34d399" : "rgba(255,255,255,0.35)" }}>
                              {r.vReason1 ? "✅ 전송완료" : "⏳ 미작성"}
                            </span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
