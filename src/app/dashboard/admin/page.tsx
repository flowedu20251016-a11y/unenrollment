"use client";

import { useState, useEffect } from "react";
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

  // 필터 State
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedCode, setSelectedCode] = useState<string>("all");

  const fetchRecords = () => {
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
    if (!sessionStr) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    const user = JSON.parse(sessionStr);
    if (user.role !== "admin") {
      alert("기조실 권한이 없습니다.");
      router.push("/dashboard/editor");
      return;
    }
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 목록 추출 (월, 수익코드)
  const monthOptions = Array.from(new Set(records.map(r => r.colA).filter(m => !!m))).sort().reverse();
  const codeOptions = Array.from(new Set(records.map(r => r.code).filter(c => !!c))).sort();

  // 렌더링 필터 통과 조건
  const filteredRecords = records.filter(r => {
    if (selectedMonth !== "all" && r.colA !== selectedMonth) return false;
    if (selectedCode !== "all" && r.code !== selectedCode) return false;
    return true;
  });

  // 상태 업데이트 API 타격 로직 (마감/해제)
  const updateStatusAPI = async (updates: any[]) => {
    try {
      const res = await fetch("/api/records/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 🔥 action: "admin_save" 로 지정하면 AC 열 상태가 업데이트됨 (Z, AA, AB 등과 함께)
        body: JSON.stringify({ action: "admin_save", updates })
      });
      if (!res.ok) throw new Error("서버 오류");
      alert("✅ 상태 변경 및 저장이 완료되었습니다.");
      fetchRecords(); // 리로드
    } catch (e) {
      console.error(e);
      alert("업데이트 중 오류가 발생했습니다.");
    }
  };

  // 단일 항목 마감 토글 (잠금 ↔ 열림)
  const handleToggleLock = (r: InputRecordType) => {
    const isClosed = r.status === "closed";
    const nextStatus = isClosed ? "pending" : "closed";

    // Z, AA, AB 값은 그대로 유지하고 상태만 바꿈
    updateStatusAPI([{
      rowIndex: r.rowIndex,
      zAdminReason1: r.zAdminReason1,
      aaAdminReason2: r.aaAdminReason2,
      abAdminDetail: r.abAdminDetail,
      status: nextStatus
    }]);
  };

  // 해당 월 전체 마감 버튼 (벌크 모드)
  const handleBulkCloseMonth = () => {
    if (selectedMonth === "all") {
      return alert("먼저 상단에서 특정 [월]을 선택한 뒤에 진행해주세요.");
    }
    const targetRecords = filteredRecords; // 현재 필터를 거쳐 눈에 보이는 애들
    const unclosedRecords = targetRecords.filter(r => r.status !== "closed");

    if (targetRecords.length === 0) return alert(`${selectedMonth} 데이터가 없습니다.`);
    if (unclosedRecords.length === 0) return alert(`이미 ${selectedMonth} 달의 모든 데이터가 마감되었습니다.`);

    if (!confirm(`${selectedMonth} 월에 해당하는 ${unclosedRecords.length}개의 데이터를 모두 마감(수정불가) 처리하시겠습니까?`)) return;

    const updates = unclosedRecords.map(r => ({
      rowIndex: r.rowIndex,
      zAdminReason1: r.zAdminReason1,
      aaAdminReason2: r.aaAdminReason2,
      abAdminDetail: r.abAdminDetail,
      status: "closed"
    }));

    updateStatusAPI(updates);
  };

  // 관리자 텍스트 입력값 변경 핸들러
  const handleAdminFieldChange = (id: string, field: "zAdminReason1" | "aaAdminReason2" | "abAdminDetail", val: string) => {
    setRecords(records.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  // 관리자 개별 텍스트만 저장
  const handleSaveAdminData = (r: InputRecordType) => {
    updateStatusAPI([{
      rowIndex: r.rowIndex,
      zAdminReason1: r.zAdminReason1,
      aaAdminReason2: r.aaAdminReason2,
      abAdminDetail: r.abAdminDetail,
      status: r.status // 상태는 그대로
    }]);
  };

  return (
    <>
      <div className="dashboard-header-text" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            🛡️ 관리자 페이지
          </h2>
          <p>사업부 작성 데이터 확인 및 관리</p>
        </div>

        {/* 컨트롤 패널 (월, 수익코드 필터 & 월 마감) */}
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", background: "rgba(255,255,255,0.05)", padding: "1rem", borderRadius: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.95rem", color: "var(--text-secondary)", fontWeight: 600 }}>📅 월:</span>
            <select className="filter-select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              <option value="all">전체보기 (모든 달)</option>
              {monthOptions.map(m => (<option key={m} value={m}>{m}</option>))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.95rem", color: "var(--text-secondary)", fontWeight: 600 }}>🏛️ 수익코드:</span>
            <select className="filter-select" value={selectedCode} onChange={(e) => setSelectedCode(e.target.value)}>
              <option value="all">전체 (모든 코드)</option>
              {codeOptions.map(m => (<option key={m} value={m}>{m}</option>))}
            </select>
          </div>

          <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: "1rem" }}>
            <button className="btn-primary" onClick={handleBulkCloseMonth} style={{ background: "var(--danger)", padding: "0.6rem 1.5rem" }}>
              ⛔ 화면의 목록 전체 일괄 마감하기
            </button>
          </div>
        </div>
      </div>

      <div className="glass-container" style={{ padding: "0" }}>
        {loading ? <p style={{ padding: "2rem" }}>데이터베이스와 동기화 중...</p> : (
          <div className="data-table-container">
            <table className="data-table" style={{ fontSize: "0.85rem" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg-secondary)" }}>
                <tr>
                  <th>{headers.colA || "년월"}</th>
                  <th>{headers.code || "수익코드"}</th>
                  <th>{headers.className || "반명"}</th>
                  <th>{headers.studentName || "학생명"}</th>
                  <th>{headers.vReason1 || "사유분류1"}</th>
                  <th>{headers.wReason2 || "종류구분2"}</th>
                  <th>증빙자료</th>
                  <th style={{ background: "rgba(99,102,241,0.15)", color: "#fff" }}>기조실 사유 메모</th>
                  <th style={{ background: "rgba(99,102,241,0.15)", color: "#fff" }}>상태 제어</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: "center", padding: "3rem", opacity: 0.5 }}>조건에 맞는 데이터가 없습니다.</td></tr>
                ) : filteredRecords.map((r) => {
                  const isClosed = r.status === "closed";
                  return (
                    <tr key={r.id} style={{ background: isClosed ? "rgba(0,0,0,0.4)" : "transparent" }}>
                      <td style={{ color: "var(--text-secondary)" }}>{r.colA}</td>
                      <td style={{ fontWeight: 600, color: "var(--accent-primary)" }}>{r.code}</td>
                      <td>{r.className}</td>
                      <td>{r.studentName}</td>
                      <td>{r.vReason1 || "-"}</td>
                      <td>{r.wReason2 || "-"}</td>
                      <td>
                        {r.xFileLink ? <a href={r.xFileLink} target="_blank" rel="noreferrer" style={{ color: "#34d399" }}>📎 링크</a> : <span style={{ opacity: 0.5 }}>-</span>}
                      </td>

                      {/* 관리자가 기조실 사유를 남길 수 있음 */}
                      <td>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="메모 후 엔터로 저장(혹은 우측 토글)..."
                            value={r.zAdminReason1 || ""}
                            onChange={(e) => handleAdminFieldChange(r.id, "zAdminReason1", e.target.value)}
                            onBlur={() => handleSaveAdminData(r)}
                            style={{ padding: "0.4rem", minWidth: "150px" }}
                          />
                        </div>
                      </td>

                      {/* 스위치 패널 */}
                      <td>
                        {isClosed ? (
                          <button
                            className="btn-secondary"
                            onClick={() => handleToggleLock(r)}
                            style={{ borderColor: "var(--accent-primary)", color: "var(--accent-primary)" }}
                          >
                            🔓 마감 해제 (열림)
                          </button>
                        ) : (
                          <button
                            className="btn-primary"
                            onClick={() => handleToggleLock(r)}
                            style={{ background: "rgba(239, 68, 68, 0.8)", padding: "0.4rem 1rem" }}
                          >
                            🔒 마감 하기 (잠금)
                          </button>
                        )}
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
