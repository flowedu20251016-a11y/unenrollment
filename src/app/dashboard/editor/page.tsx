"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ChatbotOverlay from "@/components/ChatbotOverlay";

// --- 기존 보고서 뷰 용 스키마 ---
interface ReportRecordType {
  id: string; rowIndex: number; code: string; department: string; brand: string; campus: string; manager: string;
  finalJaewon: string; finalDropout: string; finalRate: string; finalBrandAvg: string; targetRate: string;
  acaNew: string; acaDropout: string; acaHold: string; acaJaewon: string; acaJaewonEnd: string; acaJaewonDiff: string;
  acaRealDropout: string; acaRealRate: string; acaBrandAvg: string;
  exWarn: string; exEnd: string; exEvent: string; exTotal: string; exRate: string; status: string;
}

// --- 신규 입력 폼 (시트3/최종) 용 스키마 ---
interface InputRecordType {
  id: string; rowIndex: number;
  colA: string; downloadDate: string; code: string; classType1: string; classType2: string; className: string; studentName: string;
  startDate: string; endDate: string; school: string; grade: string; studentId: string; realDropDate: string; lastAttend: string;
  vReason1: string; wReason2: string; xFileLink: string; yDetail: string; zAdminReason1: string; aaAdminReason2: string; abAdminDetail: string;
  status?: string;
}

interface CategoryOptions {
  label: string;
  requireProof: boolean;
}

export default function EditorDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"report" | "input">("input");
  const [userInfo, setUserInfo] = useState<any>(null);

  // 데이터 스테이트
  const [reportRecords, setReportRecords] = useState<ReportRecordType[]>([]);
  const [inputRecords, setInputRecords] = useState<InputRecordType[]>([]);
  const [categories, setCategories] = useState<Record<string, CategoryOptions[]>>({});
  const [headers, setHeaders] = useState<any>({});

  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // --- 새로 추가된 기능용 State ---
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // 월(colA) 목록 추출
  const monthOptions = Array.from(new Set(inputRecords.map(r => r.colA).filter(m => !!m))).sort().reverse();

  // 선택된 월에 따라 필터링된 데이터
  const filteredInputRecords = selectedMonth === "all" ? inputRecords : inputRecords.filter(r => r.colA === selectedMonth);
  const filteredReportRecords = selectedMonth === "all" ? reportRecords : reportRecords; // 보고서는 월 필드가 없다면 우선 전체 표시 또는 동일하게 필터링 적용 가능

  // 초기 로더
  useEffect(() => {
    // 세션 검증
    const sessionStr = localStorage.getItem("dropout_user");
    if (!sessionStr) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    const user = JSON.parse(sessionStr);
    setUserInfo(user);

    fetchData(user);
  }, []);

  const fetchData = async (user: any) => {
    setLoading(true);
    try {
      // 보고서용
      const reportRes = await fetch("/api/records");
      const reportData = await reportRes.json();
      let rRecords = reportData.records || [];

      // 입력용
      const inputRes = await fetch("/api/records/input");
      const inputData = await inputRes.json();
      let iRecords = inputData.records || [];

      // admin이 아니면 자신에게 할당된 수익코드만 필터링
      if (user && user.role !== "admin") {
        const myCodes = user.profitCodes || [];
        rRecords = rRecords.filter((r: any) => myCodes.includes(String(r.code)));
        iRecords = iRecords.filter((r: any) => myCodes.includes(String(r.code)));
      }

      setReportRecords(rRecords);
      setInputRecords(iRecords);
      setCategories(inputData.categories || {});
      setHeaders(inputData.headers || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------------------
  // 기능 로직
  // -----------------------------------------------------

  const handleInputChange = (id: string, field: keyof InputRecordType, value: string) => {
    setInputRecords(records =>
      records.map(r => {
        if (r.id === id) {
          const updated = { ...r, [field]: value };
          // 분류 1이 바뀌면 분류 2(wReason2) 초기화
          if (field === "vReason1") {
            updated.wReason2 = "";
          }
          return updated as InputRecordType;
        }
        return r;
      })
    );
  };

  const handleFileUpload = async (id: string, file: File) => {
    if (!file) return;
    setUploadingId(id);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.webViewLink) {
        handleInputChange(id, "xFileLink", data.webViewLink);
        alert("업로드 성공!");
      } else {
        alert("업로드 실패: " + data.error);
      }
    } catch (err) {
      alert("업로드 중 오류 발생");
    } finally {
      setUploadingId(null);
    }
  };

  // V, W, X, Y 등 값이 있는 것들만 모아 저장
  const handleFinalSubmit = async () => {
    const recordsToSave = inputRecords.filter(r => r.vReason1 || r.yDetail);
    if (recordsToSave.length === 0) {
      alert("작성된 사유가 없습니다.");
      return;
    }

    if (!confirm(`총 ${recordsToSave.length}건의 사유를 저장하고 관리자(기조실)에게 알림을 보내시겠습니까?`)) return;

    try {
      // 1. Google Sheets 저장
      const res = await fetch("/api/records/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: recordsToSave })
      });

      const saveData = await res.json();
      if (!saveData.success) throw new Error("스프레드시트 업데이트 실패");

      // 2. Notion 알림 전송
      await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalSavedCount: recordsToSave.length,
          currentMonth: "결산",
          userName: userInfo?.userName || "담당자",
          profitCodes: userInfo?.profitCodes || [],
          notionUserId: userInfo?.notionUserId || ""
        })
      });

      alert("성공적으로 저장 및 알림이 전송되었습니다!");
      fetchData(userInfo); // 재조회
    } catch (err) {
      alert(String(err));
    }
  };


  // -----------------------------------------------------
  // 유틸리티 로직 (내보내기)
  // -----------------------------------------------------
  const handleExportCSV = () => {
    // 엑셀(CSV) 다운로드 함수
    const records = activeTab === "input" ? filteredInputRecords : reportRecords;
    if (records.length === 0) return alert("다운로드할 데이터가 없습니다.");

    // CSV 파일 헤더 구성
    let csvContent = "\uFEFF"; // 한글 깨짐 방지 BOM
    if (activeTab === "input") {
      csvContent += "년월,NO,명단다운,수익코드,반형태1,반형태2,반명,학생명,시작일,종료일,학교명,학년,학번,퇴원처리일자,마지막출석,퇴원사유1,퇴원종류2,상세사유,증빙첨부링크,기조실사유1,기조실종류2,기조실상태,상태\n";
      // @ts-ignore
      records.forEach((r: any) => {
        const row = [
          r.colA, r.rowIndex, r.downloadDate, r.code, r.classType1, r.classType2, r.className, r.studentName,
          r.startDate, r.endDate, r.school, r.grade, r.studentId, r.realDropDate, r.lastAttend,
          r.vReason1, r.wReason2, r.yDetail?.replace(/,/g, " "), r.xFileLink,
          r.zAdminReason1, r.aaAdminReason2, r.abAdminDetail,
          r.status === 'closed' ? '마감됨' : '작성가능'
        ];
        // 개행문자나 빈 문자열 치환 처리
        csvContent += row.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(",") + "\n";
      });
    } else {
      csvContent += "수익코드,사업부,브랜드,캠퍼스,최종퇴원율,목표퇴원율\n";
      // @ts-ignore
      records.forEach((r: any) => {
        const row = [r.code, r.department, r.brand, r.campus, r.finalRate, r.targetRate];
        csvContent += row.join(",") + "\n";
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `퇴원데이터_${selectedMonth !== "all" ? selectedMonth : "전체"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  // 관리자 권한 요청 핑(수정 요청)
  const handleRequestEdit = async (record: typeof inputRecords[number]) => {
    const msg = prompt(`[${record.studentName}] 데이터 수정을 요청하시겠습니까?\n사유를 간단히 입력해주세요:`);
    if (msg === null) return;

    try {
      const userInfoStr = localStorage.getItem("userInfo");
      const userInfo = userInfoStr ? JSON.parse(userInfoStr) : null;

      await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "request-edit",
          message: msg,
          profitCodes: record.code,
          userName: userInfo?.name || "알 수 없는 사용자",
        }),
      });
      alert("✅ 수정 권한 요청이 관리자 노션으로 전송되었습니다.");
    } catch (e) {
      console.error(e);
      alert("알림 전송 중 오류가 발생했습니다.");
    }
  };

  // -----------------------------------------------------
  // 렌더링 부속물
  // -----------------------------------------------------

  // TAB 1: 보고서 조회
  const renderReportTab = () => (
    <div className="data-table-container" style={{ padding: 0, margin: 0, border: "none" }}>
      <table className="data-table" style={{ borderCollapse: "collapse", fontSize: "0.80rem" }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ background: "rgba(255,255,255,0.08)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>수익코드</th>
            <th rowSpan={2} style={{ background: "rgba(255,255,255,0.08)" }}>사업부</th>
            <th rowSpan={2} style={{ background: "rgba(255,255,255,0.08)" }}>브랜드</th>
            <th rowSpan={2} style={{ background: "rgba(255,255,255,0.08)" }}>캠퍼스</th>
            <th rowSpan={2} style={{ background: "rgba(255,255,255,0.08)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>작성자</th>
            <th colSpan={4} style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399", borderRight: "1px solid rgba(255,255,255,0.1)" }}>최종퇴원율</th>
            <th rowSpan={2} style={{ background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", borderRight: "1px solid rgba(255,255,255,0.1)" }}>목표퇴원율</th>
            <th colSpan={6} style={{ background: "rgba(255, 255, 255, 0.05)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>ACA 기초데이터</th>
            <th colSpan={3} style={{ background: "rgba(255, 255, 255, 0.1)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>ACA 퇴원율</th>
            <th colSpan={5} style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", borderRight: "1px solid rgba(255,255,255,0.1)" }}>경고 * 종강 * 이벤트 퇴원</th>
          </tr>
          <tr>
            <th style={{ background: "rgba(16, 185, 129, 0.08)", color: "var(--text-secondary)" }}>재원(15일)</th>
            <th style={{ background: "rgba(16, 185, 129, 0.08)", color: "var(--text-secondary)" }}>최종퇴원</th>
            <th style={{ background: "rgba(16, 185, 129, 0.08)", color: "var(--text-secondary)" }}>최종퇴원율(%)</th>
            <th style={{ background: "rgba(16, 185, 129, 0.08)", color: "var(--text-secondary)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>브랜드평균</th>
            <th style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)" }}>신규</th>
            <th style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)" }}>퇴원</th>
            <th style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)" }}>휴원</th>
            <th style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)" }}>재원(15일)</th>
            <th style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)" }}>재원수(말일)</th>
            <th style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>재원(15-말일)</th>
            <th style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-secondary)" }}>퇴원</th>
            <th style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-secondary)" }}>퇴원율(%)</th>
            <th style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-secondary)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>브랜드평균</th>
            <th style={{ background: "rgba(245, 158, 11, 0.08)", color: "var(--text-secondary)" }}>8.경고</th>
            <th style={{ background: "rgba(245, 158, 11, 0.08)", color: "var(--text-secondary)" }}>9.종강</th>
            <th style={{ background: "rgba(245, 158, 11, 0.08)", color: "var(--text-secondary)" }}>10.이벤트</th>
            <th style={{ background: "rgba(245, 158, 11, 0.12)", color: "var(--text-secondary)" }}>계</th>
            <th style={{ background: "rgba(245, 158, 11, 0.08)", color: "var(--text-secondary)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>제외율(%)</th>
          </tr>
        </thead>
        <tbody>
          {reportRecords.map(record => (
            <tr key={record.id}>
              <td style={{ color: "var(--text-primary)", fontWeight: "bold" }}>{record.code}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.department}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.brand}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.campus}</td>
              <td style={{ color: "var(--text-secondary)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>{record.manager}</td>
              <td style={{ color: "var(--text-primary)" }}>{record.finalJaewon}</td>
              <td style={{ color: "#34d399", fontWeight: "bold" }}>{record.finalDropout}</td>
              <td style={{ color: "var(--danger)", fontWeight: "bold" }}>{record.finalRate}</td>
              <td style={{ color: "var(--text-secondary)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>{record.finalBrandAvg}</td>
              <td style={{ color: "#60a5fa", fontWeight: "bold", borderRight: "1px solid rgba(255,255,255,0.1)" }}>{record.targetRate}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.acaNew}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.acaDropout}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.acaHold}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.acaJaewon}</td>
              <td style={{ background: "rgba(255,255,255,0.02)", color: "var(--text-secondary)" }}>{record.acaJaewonEnd}</td>
              <td style={{ background: "rgba(255,255,255,0.02)", color: "var(--text-secondary)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>{record.acaJaewonDiff}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.acaRealDropout}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.acaRealRate}</td>
              <td style={{ color: "var(--text-secondary)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>{record.acaBrandAvg}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.exWarn}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.exEnd}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.exEvent}</td>
              <td style={{ color: "#fbbf24", fontWeight: "bold" }}>{record.exTotal}</td>
              <td style={{ color: "var(--text-secondary)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>{record.exRate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // TAB 2: 사유 작성 모드 (드롭다운 & 첨부)
  const renderInputTab = () => (
    <div className="data-table-container" style={{ padding: 0, margin: 0, border: "none" }}>
      <table className="data-table" style={{ borderCollapse: "collapse", fontSize: "0.80rem" }}>
        <thead>
          <tr>
            <th colSpan={13} style={{ background: "rgba(255,255,255,0.05)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>퇴원생 정보</th>
            <th colSpan={4} style={{ background: "rgba(99,102,241,0.2)", borderRight: "1px solid rgba(255,255,255,0.1)", color: "#a5b4fc" }}>사업부 작성</th>
            <th colSpan={3} style={{ background: "rgba(60,60,60,0.5)" }}>기조실 확정</th>
          </tr>
          <tr style={{ background: "rgba(255,255,255,0.02)", color: "var(--text-secondary)", fontSize: "0.75rem" }}>
            {/* 기본정보 13종 */}
            <th>{headers.colA || "/"}</th>
            <th>{headers.downloadDate || "명단다운"}</th>
            <th>{headers.code || "수익코드"}</th>
            <th>{headers.classType1 || "형태1"}</th>
            <th>{headers.classType2 || "형태2"}</th>
            <th>{headers.className || "반명"}</th>
            <th>{headers.studentName || "학생명"}</th>
            <th>{headers.startDate || "시작일"}</th>
            <th>{headers.endDate || "종료일"}</th>
            <th>{headers.studentId || "학번"}</th>
            <th>{headers.realDropDate || "퇴원처리일자"}</th>
            <th>{headers.lastAttend || "마지막출석"}</th>
            <th style={{ borderRight: "1px solid rgba(255,255,255,0.1)" }}>사유(원문)</th>

            {/* 담당자 작성 4종 */}
            <th style={{ color: "#fff" }}>{headers.vReason1 || "퇴원사유(분류1)"}</th>
            <th style={{ color: "#fff" }}>{headers.wReason2 || "퇴원종류(분류2)"}</th>
            <th style={{ color: "#fff" }}>{headers.xFileLink || "증빙 첨부파일"}</th>
            <th style={{ borderRight: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}>{headers.yDetail || "상세 사유"}</th>

            {/* 기조실 작성 3종 */}
            <th>{headers.zAdminReason1 || "사유(기조실)"}</th>
            <th>{headers.aaAdminReason2 || "종류(기조실)"}</th>
            <th>{headers.abAdminDetail || "상세(기조실)"}</th>
          </tr>
        </thead>
        <tbody>
          {filteredInputRecords.map((r) => {
            const currentOptions = categories[r.vReason1] || [];
            const isClosed = r.status === "closed";

            return (
              <tr key={r.id}>
                <td style={{ color: "var(--text-secondary)" }}>{r.colA}</td>
                <td>{r.downloadDate}</td>
                <td style={{ color: "var(--text-primary)", fontWeight: "bold" }}>{r.code}</td>
                <td>{r.classType1}</td>
                <td>{r.classType2}</td>
                <td>{r.className}</td>
                <td style={{ color: "#60a5fa", fontWeight: "bold" }}>{r.studentName}</td>
                <td>{r.startDate}</td>
                <td>{r.endDate}</td>
                <td>{r.studentId}</td>
                <td>{r.realDropDate}</td>
                <td>{r.lastAttend}</td>
                {/* 시트3 원문에 있는 원래 사유 열 (임시로 colL을 생략했으나 요구사항상 A~T 참조) */}
                <td style={{ borderRight: "1px solid rgba(255,255,255,0.1)" }}>-</td>

                {/* 입력 V, W, X, Y (마감 상태면 disabled) */}
                <td>
                  <select
                    className="input-field"
                    value={r.vReason1}
                    onChange={(e) => handleInputChange(r.id, "vReason1", e.target.value)}
                    style={{ minWidth: "120px" }}
                    disabled={isClosed}
                  >
                    <option value="">- 선택 -</option>
                    {Object.keys(categories).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="input-field"
                    value={r.wReason2}
                    onChange={(e) => handleInputChange(r.id, "wReason2", e.target.value)}
                    style={{ minWidth: "160px" }}
                    disabled={!r.vReason1 || isClosed}
                  >
                    <option value="">- 선택 -</option>
                    {currentOptions.map(opt => (
                      <option key={opt.label} value={opt.label}>{opt.label} {opt.requireProof ? "(증빙필수)" : ""}</option>
                    ))}
                  </select>
                </td>
                <td>
                  {r.xFileLink ? (
                    <a href={r.xFileLink} target="_blank" rel="noreferrer" style={{ color: "#34d399", marginRight: "0.5rem" }}>📎 파일 보기</a>
                  ) : uploadingId === r.id ? (
                    <span style={{ color: "var(--text-secondary)" }}>업로드 중...</span>
                  ) : (
                    <label style={{ cursor: isClosed ? "not-allowed" : "pointer", color: isClosed ? "var(--text-secondary)" : "var(--accent-primary)", fontSize: "0.80rem" }}>
                      ☁️ {isClosed ? "첨부불가" : "파일 첨부"}
                      <input
                        type="file"
                        style={{ display: "none" }}
                        disabled={isClosed}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) handleFileUpload(r.id, e.target.files[0]);
                        }}
                      />
                    </label>
                  )}
                </td>
                <td style={{ borderRight: "1px solid rgba(255,255,255,0.1)" }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="상세 내용 기입"
                    value={r.yDetail}
                    onChange={e => handleInputChange(r.id, "yDetail", e.target.value)}
                    style={{ minWidth: "200px" }}
                    disabled={isClosed}
                  />
                  {isClosed && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <span style={{ display: 'inline-block', fontSize: '0.75rem', color: '#f87171', marginRight: "0.5rem" }}>🔒 마감됨</span>
                      <button
                        onClick={() => handleRequestEdit(r)}
                        className="print-hide"
                        style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "4px", color: "white", cursor: "pointer" }}
                      >
                        🔔 권한 요청
                      </button>
                    </div>
                  )}
                </td>

                <td style={{ opacity: 0.6 }}>{r.zAdminReason1 || "-"}</td>
                <td style={{ opacity: 0.6 }}>{r.aaAdminReason2 || "-"}</td>
                <td style={{ opacity: 0.6 }}>{r.abAdminDetail || "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="dashboard-header-text" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h2>퇴원관리 대시보드</h2>
          <p>월별 퇴원보고서 & 퇴원사유작성 및 확인.</p>
        </div>

        {/* 툴바 및 필터 영역 (인쇄 시 숨김) */}
        <div className="print-hide" style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>

          {/* 월별 필터 드롭다운 */}
          {activeTab === "input" && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.95rem", color: "var(--text-secondary)", fontWeight: 600 }}>📅 월:</span>
              <select
                className="filter-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="all">모든 달 보기 열기</option>
                {monthOptions.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {/* 내보내기 그룹 */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn-secondary" onClick={handleExportCSV}>
              📥 CSV 엑셀 다운
            </button>
            <button className="btn-secondary" onClick={handlePrintPDF}>
              🖨 인쇄 (PDF 저장)
            </button>
          </div>

          {activeTab === "input" && (
            <button className="btn-primary" onClick={handleFinalSubmit} style={{ marginLeft: "auto", fontSize: "1rem" }}>
              ✅ 전체저장
            </button>
          )}
        </div>
      </div>

      <div className="tabs-container">
        <button
          className={`tab-button ${activeTab === "report" ? "active" : ""}`}
          onClick={() => setActiveTab("report")}
        >
          보고서 조회
        </button>
        <button
          className={`tab-button ${activeTab === "input" ? "active" : ""}`}
          onClick={() => setActiveTab("input")}
        >
          퇴원 사유 작성 (담당자용)
        </button>
      </div>

      <div className="glass-container" style={{ padding: "0" }}>
        {loading ? (
          <p style={{ padding: "2rem" }}>데이터를 동기화하는 중입니다...</p>
        ) : (
          activeTab === "report" ? renderReportTab() : renderInputTab()
        )}
      </div>

      {/* 챗봇 추가 (퇴원 사유 작성 탭에서만 보이게 하려면 조건부 렌더링해도 되나, 보통 범용으로 사용) */}
      <ChatbotOverlay />
    </>
  );
}
