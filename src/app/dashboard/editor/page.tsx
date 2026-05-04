"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import ChatbotOverlay from "@/components/ChatbotOverlay";

// --- 기존 보고서 뷰 용 스키마 ---
interface ReportRecordType {
  id: string; rowIndex: number; month: string; code: string; department: string; brand: string; campus: string; manager: string;
  finalJaewon: string; finalDropout: string; finalRate: string; finalBrandAvg: string; targetRate: string;
  acaNew: string; acaDropout: string; acaHold: string; acaJaewon: string; acaJaewonEnd: string; acaJaewonDiff: string;
  acaRealDropout: string; acaRealRate: string; acaBrandAvg: string;
  exWarn: string; exEnd: string; exEvent: string; exTotal: string; exRate: string; status: string;
}

// --- 신규 입력 폼 (시트3/최종) 용 스키마 ---
interface InputRecordType {
  id: string; rowIndex: number;
  colA: string; downloadDate: string; code: string; classType1: string; classType2: string; className: string;
  studentName: string; startDate: string; endDate: string; school: string; grade: string;
  studentId: string; realDropDate: string; lastAttend: string; reasonOriginal: string;
  colQ: string; colR: string; colS: string; colT: string; colU: string;
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

  const [reportRecords, setReportRecords] = useState<ReportRecordType[]>([]);
  const [inputRecords, setInputRecords] = useState<InputRecordType[]>([]);
  const [categories, setCategories] = useState<Record<string, CategoryOptions[]>>({});
  const [headers, setHeaders] = useState<any>({});

  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // 월 필터
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // 수익코드 다중선택 필터
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);

  // 분류별 통계 펼침 여부
  const [showStats, setShowStats] = useState(false);

  // 기조실 확정 컬럼 접기/펼치기
  const [showAdminCols, setShowAdminCols] = useState(true);

  // 분류별 차이 팝업
  const [diffPopup, setDiffPopup] = useState<{ category: string; records: InputRecordType[] } | null>(null);

  // 보고서 탭 필터
  const [reportViewMode, setReportViewMode] = useState<"month" | "quarter">("month");
  const [reportSelectedMonth, setReportSelectedMonth] = useState("all");
  const [reportSelectedQuarter, setReportSelectedQuarter] = useState("all");

  // 팝업 → 행 이동 시 하이라이트
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);

  // 분류별 보기 모드: 전체 / 수익코드별
  const [statsViewMode, setStatsViewMode] = useState<"overall" | "byCode">("overall");

  // 팝업 드래그
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // 누적 데이터 (초기 로드 시 현재 시트와 함께 불러옴)
  const [accReportRecords, setAccReportRecords] = useState<ReportRecordType[]>([]);
  const [accInputRecords, setAccInputRecords] = useState<InputRecordType[]>([]);

  // 컬럼 정렬
  const [sortConfig, setSortConfig] = useState<{ key: keyof InputRecordType; dir: "asc" | "desc" } | null>(null);

  const handleSort = (key: keyof InputRecordType) => {
    setSortConfig(prev =>
      prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );
  };

  const sortArrow = (key: keyof InputRecordType) => {
    if (sortConfig?.key !== key) return " ↕";
    return sortConfig.dir === "asc" ? " ↑" : " ↓";
  };

  // 현재 시트에 있는 월 집합 (편집 가능 여부 판단용)
  const currentMonthsSet = useMemo(
    () => new Set(inputRecords.map(r => r.colA).filter(Boolean)),
    [inputRecords]
  );

  // 전체 월 목록 (현재/누적 최종 시트 + 보고서 시트, 중복 제거)
  const monthOptions = useMemo(
    () => Array.from(new Set([
      ...inputRecords.map(r => r.colA),
      ...accInputRecords.map(r => r.colA),
      ...reportRecords.map(r => r.month),
      ...accReportRecords.map(r => r.month),
    ].filter(Boolean))).sort().reverse(),
    [inputRecords, accInputRecords, reportRecords, accReportRecords]
  );

  // 분기 목록 추출 (YYYY-QN 형식)
  const quarterOptions = useMemo(() => {
    const set = new Set<string>();
    monthOptions.forEach(m => {
      const parts = m.split("-");
      if (parts.length >= 2) {
        const year = parts[0];
        const mon = parseInt(parts[1]);
        if (!isNaN(mon)) set.add(`${year}-Q${Math.ceil(mon / 3)}`);
      }
    });
    return Array.from(set).sort().reverse();
  }, [monthOptions]);

  // 선택한 월이 누적 시트 데이터(이전달)인지 여부 → 읽기 전용 모드
  // 누적최종 탭에 해당 월 데이터가 있으면 누적최종 우선 (마감 완료된 데이터)
  const isViewingAccumulated = useMemo(() => {
    if (selectedMonth === "all") return false;
    return accInputRecords.some(r => r.colA === selectedMonth);
  }, [selectedMonth, accInputRecords]);

  // 보고서 탭 필터링 — 보고서/누적보고서 시트의 month 컬럼 직접 참조
  const filteredReportRecords = useMemo(() => {
    // 현재 + 누적 보고서를 합쳐서 month 기준으로 필터 (누적 우선: 같은 월이 있으면 누적만 표시)
    const accMonths = new Set(accReportRecords.map(r => r.month).filter(Boolean));
    const allReports = [
      ...accReportRecords,
      ...reportRecords.filter(r => !accMonths.has(r.month)), // 누적에 없는 월만 현재 시트에서 가져옴
    ];

    if (reportViewMode === "month") {
      if (reportSelectedMonth === "all") return allReports;
      return allReports.filter(r => r.month === reportSelectedMonth);
    } else {
      if (reportSelectedQuarter === "all") return allReports;
      const [year, q] = reportSelectedQuarter.split("-Q");
      const qNum = parseInt(q);
      const months = [1, 2, 3].map(i => `${year}-${String((qNum - 1) * 3 + i).padStart(2, "0")}`);
      return allReports.filter(r => months.includes(r.month));
    }
  }, [reportRecords, accReportRecords, reportViewMode, reportSelectedMonth, reportSelectedQuarter]);

  // 현재 유저가 가진 수익코드 목록 (표시된 데이터 기준 — 현재/누적 자동 전환)
  const availableCodes = useMemo(() => {
    if (!userInfo) return [];
    const source = isViewingAccumulated
      ? accInputRecords.filter(r => selectedMonth === "all" || r.colA === selectedMonth)
      : inputRecords;
    const codesFromData = Array.from(new Set(source.map(r => r.code).filter(Boolean))).sort() as string[];
    if (codesFromData.length > 0) return codesFromData;
    return (userInfo.profitCodes || []) as string[];
  }, [inputRecords, accInputRecords, userInfo, isViewingAccumulated, selectedMonth]);

  // 월 필터만 적용한 레코드 (코드 선택과 무관하게 통계용)
  const monthFilteredRecords = useMemo(() =>
    selectedMonth === "all" ? inputRecords : inputRecords.filter(r => r.colA === selectedMonth),
    [inputRecords, selectedMonth]
  );

  // 수익코드별 상태 통계
  const codeStats = useMemo(() => {
    const stats: Record<string, { total: number; written: number; allClosed: boolean }> = {};
    availableCodes.forEach(code => {
      const recs = monthFilteredRecords.filter(r => r.code === code);
      stats[code] = {
        total: recs.length,
        written: recs.filter(r => r.vReason1).length,
        allClosed: recs.length > 0 && recs.every(r => r.status === "closed"),
      };
    });
    return stats;
  }, [monthFilteredRecords, availableCodes]);

  // 수익코드별 마감/해제 (관리자 전용)
  const handleCodeClose = async (code: string, action: "close" | "open") => {
    const recs = monthFilteredRecords.filter(r => r.code === code);
    if (recs.length === 0) return;
    if (!confirm(`[${code}] ${recs.length}건을 ${action === "close" ? "마감" : "마감 해제"}하시겠습니까?`)) return;
    try {
      const updates = recs.map(r => ({
        rowIndex: r.rowIndex,
        zAdminReason1: r.zAdminReason1,
        aaAdminReason2: r.aaAdminReason2,
        abAdminDetail: r.abAdminDetail,
        status: action === "close" ? "closed" : "pending",
      }));
      const res = await fetch("/api/records/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "admin_save", updates }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`${action === "close" ? "마감" : "마감 해제"} 완료!`);
        fetchData(userInfo);
      }
    } catch { alert("오류가 발생했습니다."); }
  };

  // 코드 토글
  const toggleCode = (code: string) => {
    setSelectedCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // 전체선택/해제
  const toggleAllCodes = () => {
    if (selectedCodes.length === availableCodes.length) {
      setSelectedCodes([]);
    } else {
      setSelectedCodes([...availableCodes]);
    }
  };

  // 월 + 수익코드 복합 필터 + 정렬 (이전달이면 누적 시트 사용)
  const filteredInputRecords = useMemo(() => {
    const source = isViewingAccumulated ? accInputRecords : inputRecords;
    let list = source.filter(r => {
      const monthMatch = selectedMonth === "all" || r.colA === selectedMonth;
      const codeMatch = selectedCodes.length === 0 || selectedCodes.includes(r.code);
      return monthMatch && codeMatch;
    });
    if (sortConfig) {
      list = [...list].sort((a, b) => {
        const va = String(a[sortConfig.key] ?? "");
        const vb = String(b[sortConfig.key] ?? "");
        return sortConfig.dir === "asc" ? va.localeCompare(vb, "ko") : vb.localeCompare(va, "ko");
      });
    }
    return list;
  }, [inputRecords, accInputRecords, selectedMonth, selectedCodes, sortConfig, isViewingAccumulated]);

  // 퇴원종류 비교 통계
  const reasonStats = useMemo(() => {
    const editorCounts: Record<string, number> = {};
    const adminCounts: Record<string, number> = {};

    filteredInputRecords.forEach(r => {
      const v = r.vReason1?.trim();
      const a = r.zAdminReason1?.trim();
      if (v) editorCounts[v] = (editorCounts[v] || 0) + 1;
      if (a) adminCounts[a] = (adminCounts[a] || 0) + 1;
    });

    const allCategories = Array.from(new Set([...Object.keys(editorCounts), ...Object.keys(adminCounts)])).sort();

    // 수익코드별 분류 통계
    const codeList = Array.from(new Set(filteredInputRecords.map(r => r.code).filter(Boolean))).sort();
    const byCode = codeList.map(code => {
      const recs = filteredInputRecords.filter(r => r.code === code);
      const ec: Record<string, number> = {};
      const ac: Record<string, number> = {};
      recs.forEach(r => {
        const v = r.vReason1?.trim();
        const a = r.zAdminReason1?.trim();
        if (v) ec[v] = (ec[v] || 0) + 1;
        if (a) ac[a] = (ac[a] || 0) + 1;
      });
      const cats = Array.from(new Set([...Object.keys(ec), ...Object.keys(ac)])).sort();
      return {
        code,
        categories: cats.map(cat => ({ category: cat, editorCount: ec[cat] || 0, adminCount: ac[cat] || 0 })),
      };
    });

    return {
      totalRecords: filteredInputRecords.length,
      editorTotal: filteredInputRecords.filter(r => r.vReason1).length,
      adminTotal: filteredInputRecords.filter(r => r.zAdminReason1).length,
      byCategory: allCategories.map(cat => ({
        category: cat,
        editorCount: editorCounts[cat] || 0,
        adminCount: adminCounts[cat] || 0,
      })),
      byCode,
    };
  }, [filteredInputRecords]);

  // 초기 로더
  useEffect(() => {
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
      // 현재 시트 + 누적 시트 동시 호출 (4개 병렬)
      const [reportRes, inputRes, accReportRes, accInputRes] = await Promise.all([
        fetch("/api/records", { cache: "no-store" }),
        fetch("/api/records/input", { cache: "no-store" }),
        fetch("/api/records?tab=누적보고서", { cache: "no-store" }),
        fetch("/api/records/input?tab=누적최종", { cache: "no-store" }),
      ]);
      const [reportData, inputData, accReportData, accInputData] = await Promise.all([
        reportRes.json(),
        inputRes.json(),
        accReportRes.json(),
        accInputRes.json(),
      ]);
      let rRecords = reportData.records || [];
      let iRecords = inputData.records || [];
      let arRecords = accReportData.records || [];
      let aiRecords = accInputData.records || [];

      if (user && user.role !== "admin") {
        const inputCodes = user.profitCodes || [];
        const reportCodes: string[] = user.reportCodes || [];
        // 보고서: reportCodes가 있으면 그것만, 없으면 입력코드 기준 (mid_admin은 전체)
        const rCodes = user.role === "mid_admin"
          ? null
          : reportCodes.length > 0 ? reportCodes : inputCodes;
        if (rCodes) {
          rRecords = rRecords.filter((r: any) => rCodes.includes(String(r.code)));
          arRecords = arRecords.filter((r: any) => rCodes.includes(String(r.code)));
        }
        // 입력: 항상 profitCodes 기준
        iRecords = iRecords.filter((r: any) => inputCodes.includes(String(r.code)));
        aiRecords = aiRecords.filter((r: any) => inputCodes.includes(String(r.code)));
      }

      setReportRecords(rRecords);
      setAccReportRecords(arRecords);
      setAccInputRecords(aiRecords);

      // 임시저장 데이터가 있으면 복원 여부 확인
      const draftKey = `dropout_draft_${user?.userid}`;
      const draft = localStorage.getItem(draftKey);
      if (draft) {
        try {
          const savedRecords: InputRecordType[] = JSON.parse(draft);
          // 서버 데이터와 id 목록이 동일할 때만 복원 제안
          const isSameSet = savedRecords.length === iRecords.length &&
            savedRecords.every((s: InputRecordType) => iRecords.some((r: any) => r.id === s.id));
          if (isSameSet && window.confirm("저장된 임시데이터가 있습니다. 불러오시겠습니까?\n(취소 시 서버 데이터로 표시됩니다)")) {
            setInputRecords(savedRecords);
          } else {
            setInputRecords(iRecords);
            if (!isSameSet) localStorage.removeItem(draftKey); // 구버전 draft 삭제
          }
        } catch {
          setInputRecords(iRecords);
        }
      } else {
        setInputRecords(iRecords);
      }

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
    const record = inputRecords.find(r => r.id === id);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("code", record?.code || "unknown");
    formData.append("studentName", record?.studentName || "unknown");
    formData.append("month", record?.colA || "unknown");

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.webViewLink) {
        handleInputChange(id, "xFileLink", data.webViewLink);
        alert("업로드 성공!");
      } else {
        alert("업로드 실패: " + data.error + (data.detail ? "\n\n상세: " + data.detail : ""));
      }
    } catch (err: any) {
      alert("업로드 중 오류 발생: " + (err?.message || String(err)));
    } finally {
      setUploadingId(null);
    }
  };

  const handleTempSave = () => {
    if (!userInfo) return;
    try {
      localStorage.setItem(`dropout_draft_${userInfo.userid}`, JSON.stringify(inputRecords));
      alert("임시저장 완료!\n페이지를 새로고침해도 내용이 유지됩니다.");
    } catch {
      alert("임시저장 실패");
    }
  };

  const handleFinalSubmit = async () => {
    const recordsToSave = inputRecords.filter(r => r.vReason1 || r.yDetail);
    if (recordsToSave.length === 0) {
      alert("작성된 사유가 없습니다.");
      return;
    }

    if (!confirm(`총 ${recordsToSave.length}건의 사유를 저장하고 관리자(기조실)에게 알림을 보내시겠습니까?`)) return;

    try {
      const res = await fetch("/api/records/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: recordsToSave })
      });

      const saveData = await res.json();
      if (!saveData.success) throw new Error("스프레드시트 업데이트 실패");

      const notionRes = await fetch("/api/notion", {
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
      if (!notionRes.ok) {
        const notionErr = await notionRes.json().catch(() => ({}));
        console.error("Notion 알림 오류:", notionErr);
        alert(`저장은 완료됐지만 노션 알림 전송에 실패했습니다.\n\n오류: ${JSON.stringify(notionErr?.detail || notionErr)}`);
      } else {
        alert("성공적으로 저장 및 알림이 전송되었습니다!");
      }

      localStorage.removeItem(`dropout_draft_${userInfo?.userid}`);
      fetchData(userInfo);
    } catch (err) {
      alert(String(err));
    }
  };

  // -----------------------------------------------------
  // 유틸리티 로직 (내보내기)
  // -----------------------------------------------------
  const handleExportCSV = () => {
    const records = activeTab === "input" ? filteredInputRecords : reportRecords;
    if (records.length === 0) return alert("다운로드할 데이터가 없습니다.");

    let csvContent = "\uFEFF";
    if (activeTab === "input") {
      csvContent += "년월,NO,명단다운,수익코드,반형태1,반형태2,반명,학생명,시작일,종료일,학교명,학년,학번,퇴원처리일자,마지막출석,Q열,R열,S열,T열,U열,퇴원사유1,퇴원종류2,상세사유,증빙첨부링크,기조실사유1,기조실종류2,기조실상태,상태\n";
      records.forEach((r: any) => {
        const row = [
          r.colA, r.rowIndex, r.downloadDate, r.code, r.classType1, r.classType2, r.className, r.studentName,
          r.startDate, r.endDate, r.school, r.grade, r.studentId, r.realDropDate, r.lastAttend,
          r.colQ, r.colR, r.colS, r.colT, r.colU,
          r.vReason1, r.wReason2, r.yDetail?.replace(/,/g, " "), r.xFileLink,
          r.zAdminReason1, r.aaAdminReason2, r.abAdminDetail,
          r.status === 'closed' ? '마감됨' : '작성가능'
        ];
        csvContent += row.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(",") + "\n";
      });
    } else {
      csvContent += "수익코드,사업부,브랜드,캠퍼스,최종퇴원율,목표퇴원율\n";
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

  const handleRequestEdit = async (record: typeof inputRecords[number]) => {
    const msg = prompt(`[${record.studentName}] 데이터 수정을 요청하시겠습니까?\n사유를 간단히 입력해주세요:`);
    if (msg === null) return;

    try {
      const userInfoStr = localStorage.getItem("dropout_user");
      const reqUser = userInfoStr ? JSON.parse(userInfoStr) : null;

      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "request-edit",
          message: msg,
          profitCodes: record.code,
          userName: reqUser?.userName || userInfo?.userName || "알 수 없는 사용자",
          notionUserId: reqUser?.notionUserId || userInfo?.notionUserId || "",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Notion 수정요청 오류:", err);
        alert("알림 전송 중 오류가 발생했습니다. (서버 오류)");
        return;
      }
      alert("수정 권한 요청이 관리자 노션으로 전송되었습니다.");
    } catch (e) {
      console.error(e);
      alert("알림 전송 중 오류가 발생했습니다.");
    }
  };

  // -----------------------------------------------------
  // 렌더링 부속물
  // -----------------------------------------------------

  // 수익코드 필터 UI
  const renderCodeFilter = () => {
    if (availableCodes.length === 0) return null;
    const allSelected = selectedCodes.length === 0 || selectedCodes.length === availableCodes.length;
    const isAdmin = userInfo?.role === "admin";

    return (
      <div style={{ padding: "0.6rem 1rem", borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", background: "rgba(0,0,0,0.02)" }}>
        <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600, whiteSpace: "nowrap" }}>수익코드:</span>

        {/* 전체 버튼 */}
        <button onClick={toggleAllCodes} style={{
          padding: "0.2rem 0.7rem", borderRadius: "999px", fontSize: "0.78rem", cursor: "pointer",
          border: allSelected ? "1px solid #6366f1" : "1px solid rgba(0,0,0,0.12)",
          background: allSelected ? "rgba(79,70,229,0.12)" : "transparent",
          color: allSelected ? "#4f46e5" : "var(--text-secondary)",
        }}>전체</button>

        {availableCodes.map(code => {
          const active = selectedCodes.includes(code);
          const stat = codeStats[code] || { total: 0, written: 0, allClosed: false };
          const statusLabel = stat.allClosed ? "🔒 마감됨"
            : stat.total === 0 || stat.written === 0 ? "미작성"
              : stat.written === stat.total ? "전송완료"
                : "작성중";
          const statusColor = stat.allClosed ? "#dc2626"
            : stat.written === 0 ? "var(--text-secondary)"
              : stat.written === stat.total ? "#059669"
                : "#d97706";

          return (
            <div key={code} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              {/* 코드 선택 버튼 + 상태 */}
              <button onClick={() => toggleCode(code)} style={{
                padding: "0.25rem 0.8rem", borderRadius: "999px", fontSize: "0.78rem", cursor: "pointer",
                border: active ? "1px solid #6366f1" : "1px solid rgba(0,0,0,0.12)",
                background: active ? "rgba(79,70,229,0.12)" : "transparent",
                color: active ? "#4f46e5" : "var(--text-secondary)",
                display: "flex", alignItems: "center", gap: "0.4rem",
              }}>
                <span style={{ fontWeight: 600 }}>{code}</span>
                <span style={{ fontSize: "0.7rem", color: statusColor, whiteSpace: "nowrap" }}>
                  {statusLabel}
                  {!stat.allClosed && stat.total > 0 && (
                    <span style={{ opacity: 0.7 }}> {stat.written}/{stat.total}</span>
                  )}
                </span>
              </button>

              {/* 관리자 전용: 마감/해제 버튼 */}
              {isAdmin && stat.total > 0 && (
                <button
                  onClick={() => handleCodeClose(code, stat.allClosed ? "open" : "close")}
                  style={{
                    padding: "0.15rem 0.5rem", borderRadius: "4px", fontSize: "0.7rem", cursor: "pointer",
                    border: stat.allClosed
                      ? "1px solid rgba(217,119,6,0.5)"
                      : "1px solid rgba(220,38,38,0.3)",
                    background: stat.allClosed
                      ? "rgba(217,119,6,0.10)"
                      : "rgba(220,38,38,0.08)",
                    color: stat.allClosed ? "#d97706" : "#dc2626",
                    whiteSpace: "nowrap",
                  }}
                >
                  {stat.allClosed ? "해제" : "마감"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // 퇴원종류 비교 통계 UI
  const renderStatsBar = () => (
    <div>
      {/* 요약 바 */}
      <div style={{ padding: "0.6rem 1rem", borderBottom: showStats ? "none" : "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap", background: "rgba(0,0,0,0.02)", fontSize: "0.82rem" }}>
        {reasonStats.byCategory.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <button
              onClick={() => setShowStats(s => !s)}
              style={{ padding: "0.2rem 0.7rem", fontSize: "0.78rem", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.12)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
            >
              {showStats ? "▲ 분류별 닫기" : "▼ 분류별 상세"}
            </button>
            {showStats && (
              <div style={{ display: "flex", borderRadius: "5px", overflow: "hidden", border: "1px solid rgba(0,0,0,0.12)" }}>
                <button onClick={() => setStatsViewMode("overall")}
                  style={{ padding: "0.15rem 0.6rem", fontSize: "0.74rem", cursor: "pointer", border: "none",
                    background: statsViewMode === "overall" ? "rgba(79,70,229,0.15)" : "transparent",
                    color: statsViewMode === "overall" ? "#4f46e5" : "var(--text-secondary)" }}>전체</button>
                <button onClick={() => setStatsViewMode("byCode")}
                  style={{ padding: "0.15rem 0.6rem", fontSize: "0.74rem", cursor: "pointer", border: "none",
                    background: statsViewMode === "byCode" ? "rgba(79,70,229,0.15)" : "transparent",
                    color: statsViewMode === "byCode" ? "#4f46e5" : "var(--text-secondary)" }}>코드별</button>
              </div>
            )}
          </div>
        )}
        <span style={{ color: "var(--text-secondary)" }}>총 <b style={{ color: "var(--text-primary)" }}>{reasonStats.totalRecords}</b>건</span>
        <span style={{ color: "#4f46e5" }}>사업부 작성 <b>{reasonStats.editorTotal}</b>건</span>
        <span style={{ color: "#059669" }}>기조실 확정 <b>{reasonStats.adminTotal}</b>건</span>
        <span style={{ color: "#dc2626" }}>미작성 <b>{reasonStats.totalRecords - reasonStats.editorTotal}</b>건</span>
      </div>

      {/* 분류별 상세 (펼쳐질 때만) */}
      {showStats && reasonStats.byCategory.length > 0 && (
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.03)" }}>
          {statsViewMode === "overall" ? (
            /* 전체 뷰 */
            <table style={{ fontSize: "0.78rem", borderCollapse: "collapse", width: "auto" }}>
              <thead>
                <tr>
                  <th style={{ padding: "0.25rem 0.75rem", textAlign: "left", color: "var(--text-secondary)", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>분류</th>
                  <th style={{ padding: "0.25rem 0.75rem", textAlign: "center", color: "#4f46e5", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>사업부 작성</th>
                  <th style={{ padding: "0.25rem 0.75rem", textAlign: "center", color: "#059669", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>기조실 확정</th>
                  <th style={{ padding: "0.25rem 0.75rem", textAlign: "center", color: "var(--text-secondary)", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>차이</th>
                </tr>
              </thead>
              <tbody>
                {reasonStats.byCategory.map(stat => {
                  const diff = stat.editorCount - stat.adminCount;
                  const hasDiff = stat.editorCount !== stat.adminCount;
                  return (
                    <tr key={stat.category}
                      onClick={hasDiff ? () => {
                        const diffRecords = filteredInputRecords.filter(r =>
                          (r.vReason1 === stat.category && r.zAdminReason1 !== stat.category) ||
                          (r.zAdminReason1 === stat.category && r.vReason1 !== stat.category)
                        );
                        setDiffPopup({ category: stat.category, records: diffRecords });
                      } : undefined}
                      style={{ cursor: hasDiff ? "pointer" : "default", background: hasDiff ? "rgba(217,119,6,0.06)" : "transparent" }}
                      title={hasDiff ? "클릭하여 차이 내역 보기" : ""}
                    >
                      <td style={{ padding: "0.2rem 0.75rem", color: "var(--text-primary)" }}>{stat.category}</td>
                      <td style={{ padding: "0.2rem 0.75rem", textAlign: "center", color: "#4f46e5", fontWeight: "bold" }}>{stat.editorCount}</td>
                      <td style={{ padding: "0.2rem 0.75rem", textAlign: "center", color: "#059669", fontWeight: "bold" }}>{stat.adminCount}</td>
                      <td style={{ padding: "0.2rem 0.75rem", textAlign: "center", color: hasDiff ? "#d97706" : "var(--text-secondary)", fontWeight: hasDiff ? "bold" : "normal" }}>
                        {diff > 0 ? `+${diff}` : diff}
                        {hasDiff && <span style={{ marginLeft: "0.3rem", fontSize: "0.7rem" }}>🔍</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* 수익코드별 뷰 */
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "flex-start" }}>
              {reasonStats.byCode.map(({ code, categories }) => (
                <div key={code}>
                  <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--accent-primary, #4f46e5)", marginBottom: "0.3rem", borderBottom: "1px solid rgba(0,0,0,0.08)", paddingBottom: "0.2rem" }}>
                    {code}
                  </div>
                  <table style={{ fontSize: "0.75rem", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ padding: "0.15rem 0.6rem", textAlign: "left", color: "var(--text-secondary)", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>분류</th>
                        <th style={{ padding: "0.15rem 0.6rem", textAlign: "center", color: "#4f46e5", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>사업부</th>
                        <th style={{ padding: "0.15rem 0.6rem", textAlign: "center", color: "#059669", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>기조실</th>
                        <th style={{ padding: "0.15rem 0.6rem", textAlign: "center", color: "var(--text-secondary)", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>차이</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map(stat => {
                        const diff = stat.editorCount - stat.adminCount;
                        const hasDiff = diff !== 0;
                        return (
                          <tr key={stat.category}
                            onClick={hasDiff ? () => {
                              const diffRecords = filteredInputRecords.filter(r =>
                                r.code === code && (
                                  (r.vReason1 === stat.category && r.zAdminReason1 !== stat.category) ||
                                  (r.zAdminReason1 === stat.category && r.vReason1 !== stat.category)
                                )
                              );
                              setDiffPopup({ category: `${code} — ${stat.category}`, records: diffRecords });
                            } : undefined}
                            style={{ cursor: hasDiff ? "pointer" : "default", background: hasDiff ? "rgba(217,119,6,0.06)" : "transparent" }}
                          >
                            <td style={{ padding: "0.15rem 0.6rem", color: "var(--text-primary)" }}>{stat.category}</td>
                            <td style={{ padding: "0.15rem 0.6rem", textAlign: "center", color: "#4f46e5", fontWeight: "bold" }}>{stat.editorCount}</td>
                            <td style={{ padding: "0.15rem 0.6rem", textAlign: "center", color: "#059669", fontWeight: "bold" }}>{stat.adminCount}</td>
                            <td style={{ padding: "0.15rem 0.6rem", textAlign: "center", color: hasDiff ? "#d97706" : "var(--text-secondary)", fontWeight: hasDiff ? "bold" : "normal" }}>
                              {diff > 0 ? `+${diff}` : diff}
                              {hasDiff && <span style={{ marginLeft: "0.2rem", fontSize: "0.68rem" }}>🔍</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // TAB 1: 보고서 조회
  // 컬럼 순서: 연월 | 수익코드 사업부 브랜드 캠퍼스 작성자 | 재원(15일) 최종퇴원 최종퇴원율 브랜드평균 | 목표퇴원율
  //           | aca재원(말일) aca신규 aca퇴원 aca퇴원율 aca브랜드평균 | 경고 종강 이벤트 합계 퇴원제외율
  //           | aca재원(15일) 재원제외
  const renderReportTab = () => (
    <div className="data-table-container" style={{ padding: 0, margin: 0, border: "none" }}>
      <table className="data-table" style={{ fontSize: "0.80rem" }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ background: "rgba(0,0,0,0.04)", whiteSpace: "nowrap" }}>연월</th>
            <th rowSpan={2} style={{ background: "rgba(0,0,0,0.04)", fontWeight: "bold" }}>수익코드</th>
            <th rowSpan={2} style={{ background: "rgba(0,0,0,0.04)" }}>사업부</th>
            <th rowSpan={2} style={{ background: "rgba(0,0,0,0.04)" }}>브랜드</th>
            <th rowSpan={2} style={{ background: "rgba(0,0,0,0.04)" }}>캠퍼스</th>
            <th rowSpan={2} style={{ background: "rgba(0,0,0,0.04)", borderRight: "1px solid rgba(0,0,0,0.08)" }}>작성자</th>
            <th colSpan={4} style={{ backgroundImage: "linear-gradient(rgba(5,150,105,0.12), rgba(5,150,105,0.12))", color: "#059669", borderTop: "2px solid #059669", borderLeft: "2px solid #059669" }}>최종퇴원율</th>
            <th rowSpan={2} style={{ backgroundImage: "linear-gradient(rgba(37,99,235,0.10), rgba(37,99,235,0.10))", color: "#2563eb", whiteSpace: "nowrap", borderTop: "2px solid #059669", borderRight: "2px solid #059669" }}>목표퇴원율</th>
            <th colSpan={5} style={{ background: "rgba(0,0,0,0.03)", borderRight: "1px solid rgba(0,0,0,0.08)" }}>ACA</th>
            <th colSpan={5} style={{ backgroundImage: "linear-gradient(rgba(245,158,11,0.15), rgba(245,158,11,0.15))", color: "#d97706", borderRight: "1px solid rgba(0,0,0,0.08)" }}>경고·종강·이벤트</th>
            <th colSpan={2} style={{ background: "rgba(0,0,0,0.03)" }}>ACA 재원</th>
          </tr>
          <tr>
            {/* 최종퇴원율 4종 */}
            <th style={{ backgroundImage: "linear-gradient(rgba(5,150,105,0.06), rgba(5,150,105,0.06))", color: "var(--text-secondary)", whiteSpace: "nowrap", borderLeft: "2px solid #059669" }}>재원(15일)</th>
            <th style={{ backgroundImage: "linear-gradient(rgba(5,150,105,0.06), rgba(5,150,105,0.06))", color: "var(--text-secondary)" }}>최종퇴원</th>
            <th style={{ backgroundImage: "linear-gradient(rgba(5,150,105,0.06), rgba(5,150,105,0.06))", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>퇴원율(%)</th>
            <th style={{ backgroundImage: "linear-gradient(rgba(5,150,105,0.06), rgba(5,150,105,0.06))", color: "var(--text-secondary)", borderRight: "1px solid rgba(0,0,0,0.08)", whiteSpace: "nowrap" }}>브랜드평균(%)</th>
            {/* ACA 5종 */}
            <th style={{ background: "rgba(0,0,0,0.02)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>재원(말일)</th>
            <th style={{ background: "rgba(0,0,0,0.02)", color: "var(--text-secondary)" }}>신규</th>
            <th style={{ background: "rgba(0,0,0,0.02)", color: "var(--text-secondary)" }}>퇴원</th>
            <th style={{ background: "rgba(0,0,0,0.02)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>퇴원율(%)</th>
            <th style={{ background: "rgba(0,0,0,0.02)", color: "var(--text-secondary)", borderRight: "1px solid rgba(0,0,0,0.08)", whiteSpace: "nowrap" }}>브랜드평균</th>
            {/* 경고·종강·이벤트 5종 */}
            <th style={{ backgroundImage: "linear-gradient(rgba(245,158,11,0.08), rgba(245,158,11,0.08))", color: "var(--text-secondary)" }}>경고</th>
            <th style={{ backgroundImage: "linear-gradient(rgba(245,158,11,0.08), rgba(245,158,11,0.08))", color: "var(--text-secondary)" }}>종강</th>
            <th style={{ backgroundImage: "linear-gradient(rgba(245,158,11,0.08), rgba(245,158,11,0.08))", color: "var(--text-secondary)" }}>이벤트</th>
            <th style={{ backgroundImage: "linear-gradient(rgba(245,158,11,0.10), rgba(245,158,11,0.10))", color: "var(--text-secondary)" }}>합계</th>
            <th style={{ backgroundImage: "linear-gradient(rgba(245,158,11,0.08), rgba(245,158,11,0.08))", color: "var(--text-secondary)", borderRight: "1px solid rgba(0,0,0,0.08)", whiteSpace: "nowrap" }}>제외율(%)</th>
            {/* ACA 재원 2종 */}
            <th style={{ background: "rgba(0,0,0,0.02)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>재원(15일)</th>
            <th style={{ background: "rgba(0,0,0,0.02)", color: "var(--text-secondary)" }}>재원제외</th>
          </tr>
        </thead>
        <tbody>
          {filteredReportRecords.map(record => {
            const finalRateNum = parseFloat(record.finalRate);
            const targetRateNum = parseFloat(record.targetRate);
            const isOverTarget = !isNaN(finalRateNum) && !isNaN(targetRateNum) && finalRateNum > targetRateNum;
            return (
            <tr key={record.id}>
              <td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{record.month}</td>
              <td style={{ color: "var(--text-primary)", fontWeight: "bold" }}>{record.code}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.department}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.brand}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.campus}</td>
              <td style={{ color: "var(--text-secondary)", borderRight: "1px solid rgba(0,0,0,0.08)" }}>{record.manager}</td>
              {/* 최종퇴원율 */}
              <td style={{ borderLeft: "2px solid #059669" }}>{record.finalJaewon}</td>
              <td style={{ color: "#059669", fontWeight: "bold" }}>{record.finalDropout}</td>
              <td style={{
                color: isOverTarget ? "#fff" : "var(--danger)",
                fontWeight: "bold",
                background: isOverTarget ? "#dc2626" : undefined,
                borderRadius: isOverTarget ? "4px" : undefined,
              }}>{record.finalRate}</td>
              <td style={{ color: "var(--text-secondary)", borderRight: "1px solid rgba(0,0,0,0.08)" }}>{record.finalBrandAvg}</td>
              {/* 목표퇴원율 */}
              <td style={{ color: "#2563eb", fontWeight: "bold", borderRight: "2px solid #059669" }}>{record.targetRate}</td>
              {/* ACA */}
              <td style={{ color: "var(--text-secondary)" }}>{record.acaJaewonEnd}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.acaNew}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.acaDropout}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.acaRealRate}</td>
              <td style={{ color: "var(--text-secondary)", borderRight: "1px solid rgba(0,0,0,0.08)" }}>{record.acaBrandAvg}</td>
              {/* 경고·종강·이벤트 */}
              <td style={{ color: "var(--text-secondary)" }}>{record.exWarn}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.exEnd}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.exEvent}</td>
              <td style={{ color: "#d97706", fontWeight: "bold" }}>{record.exTotal}</td>
              <td style={{ color: "var(--text-secondary)", borderRight: "1px solid rgba(0,0,0,0.08)" }}>{record.exRate}</td>
              {/* ACA 재원 */}
              <td style={{ color: "var(--text-secondary)" }}>{record.acaJaewon}</td>
              <td style={{ color: "var(--text-secondary)" }}>{record.acaJaewonDiff}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );


  // TAB 2: 사유 작성 / 이전달 조회 모드
  const renderInputTab = () => (
    <div className="data-table-container" style={{ padding: 0, margin: 0, border: "none" }}>
      {/* 이전달 조회 중 배너 */}
      {isViewingAccumulated && (
        <div style={{
          padding: "0.6rem 1rem", background: "rgba(217,119,6,0.06)", borderBottom: "2px solid rgba(217,119,6,0.30)",
          display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.84rem",
        }}>
          <span style={{ color: "#d97706", fontWeight: 700 }}>📁 이전 데이터 조회 중 ({selectedMonth})</span>
          <span style={{ color: "var(--text-secondary)" }}>— 누적 시트 데이터입니다. 수정 불가 (읽기 전용)</span>
        </div>
      )}
      {/* 수익코드 필터 */}
      {renderCodeFilter()}

      {/* 퇴원종류 비교 통계 */}
      {renderStatsBar()}

      <table className="data-table" style={{ borderCollapse: "collapse", fontSize: "0.80rem" }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ background: "rgba(0,0,0,0.03)", whiteSpace: "nowrap" }}>#</th>
            <th colSpan={showAdminCols ? 3 : 1} style={{ backgroundImage: "linear-gradient(rgba(5,150,105,0.12), rgba(5,150,105,0.12))", borderRight: "1px solid rgba(0,0,0,0.08)", color: "#059669" }}>
              <span
                onClick={() => setShowAdminCols(v => !v)}
                style={{ cursor: "pointer", userSelect: "none", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                title={showAdminCols ? "기조실 확정 열 접기" : "기조실 확정 열 펼치기"}
              >
                {showAdminCols ? "▼" : "▶"} 기조실 확정
              </span>
            </th>
            <th colSpan={4} style={{ backgroundImage: "linear-gradient(rgba(79,70,229,0.10), rgba(79,70,229,0.10))", borderRight: "1px solid rgba(0,0,0,0.08)", color: "#4f46e5" }}>사업부 작성</th>
            <th colSpan={11} style={{ background: "rgba(0,0,0,0.03)" }}>퇴원생 정보</th>
          </tr>
          <tr style={{ background: "rgba(0,0,0,0.02)", color: "var(--text-secondary)", fontSize: "0.75rem" }}>
            {/* 기조실 확정 3종 (접기/펼치기) */}
            {showAdminCols ? (
              <>
                <th style={{ color: "#059669" }}>{headers.zAdminReason1 || "사유(기조실)"}</th>
                <th style={{ color: "#059669" }}>{headers.aaAdminReason2 || "종류(기조실)"}</th>
                <th style={{ borderRight: "1px solid rgba(0,0,0,0.08)", color: "#059669" }}>{headers.abAdminDetail || "상세(기조실)"}</th>
              </>
            ) : (
              <th style={{ borderRight: "1px solid rgba(0,0,0,0.08)", fontSize: "0.7rem", opacity: 0.5 }}>—</th>
            )}
            {/* 사업부 작성 4종 */}
            <th style={{ color: "#4f46e5" }}>{headers.vReason1 || "퇴원사유(분류1)"}</th>
            <th style={{ color: "#4f46e5" }}>{headers.wReason2 || "퇴원종류(분류2)"}</th>
            <th style={{ color: "#4f46e5" }}>{headers.xFileLink || "증빙여부"}</th>
            <th style={{ borderRight: "1px solid rgba(0,0,0,0.08)", color: "#4f46e5" }}>{headers.yDetail || "상세내역"}</th>
            {/* 퇴원생 정보 11종 — 클릭 시 정렬 */}
            {([
              ["studentName", "학생명"],
              ["school", "학교명"],
              ["grade", "학년"],
              ["lastAttend", "마지막출석일"],
              ["reasonOriginal", "사유원문"],
              ["classType2", "반형태2"],
              ["className", "반명"],
              ["startDate", "시작일"],
              ["endDate", "종료일"],
              ["code", "수익코드"],
              ["downloadDate", "다운일자"],
            ] as [keyof InputRecordType, string][]).map(([key, fallback]) => (
              <th key={String(key)} onClick={() => handleSort(key)}
                style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                {headers[key] || fallback}{sortArrow(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredInputRecords.map((r, idx) => {
            const currentOptions = categories[r.vReason1] || [];
            const isClosed = r.status === "closed" || isViewingAccumulated;
            const isHighlighted = highlightedRowId === r.id;

            return (
              <tr key={r.id} id={`input-row-${r.id}`}
                style={isHighlighted ? { background: "rgba(217,119,6,0.12)", transition: "background 0.5s" } : undefined}
              >
                {/* # */}
                <td style={{ color: "var(--text-secondary)", textAlign: "center" }}>{idx + 1}</td>

                {/* 기조실 확정 3종 (접기/펼치기) */}
                {showAdminCols ? (
                  <>
                    <td style={{ color: "var(--text-primary)" }}>{r.zAdminReason1 || "-"}</td>
                    <td style={{ color: "var(--text-primary)" }}>{r.aaAdminReason2 || "-"}</td>
                    <td style={{ color: "var(--text-primary)", borderRight: "1px solid rgba(0,0,0,0.08)" }}>
                      {r.abAdminDetail || "-"}
                      {isClosed && (
                        <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", color: "#dc2626" }}>🔒마감</span>
                      )}
                    </td>
                  </>
                ) : (
                  <td style={{ borderRight: "1px solid rgba(0,0,0,0.08)", textAlign: "center", opacity: 0.4 }}>
                    {isClosed && <span style={{ fontSize: "0.7rem", color: "#dc2626" }}>🔒</span>}
                  </td>
                )}

                {/* 사업부 작성 4종 */}
                <td>
                  <select className="input-field" value={r.vReason1}
                    onChange={(e) => handleInputChange(r.id, "vReason1", e.target.value)}
                    style={{ minWidth: "110px" }} disabled={isClosed}>
                    <option value="">- 선택 -</option>
                    {Object.keys(categories).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select className="input-field" value={r.wReason2}
                    onChange={(e) => handleInputChange(r.id, "wReason2", e.target.value)}
                    style={{ minWidth: "140px" }} disabled={!r.vReason1 || isClosed}>
                    <option value="">- 선택 -</option>
                    {currentOptions.map(opt => (
                      <option key={opt.label} value={opt.label}>{opt.label}{opt.requireProof ? " (증빙필수)" : ""}</option>
                    ))}
                  </select>
                </td>
                <td>
                  {r.xFileLink ? (
                    <a href={r.xFileLink} target="_blank" rel="noreferrer" style={{ color: "#059669" }}>파일 보기</a>
                  ) : uploadingId === r.id ? (
                    <span style={{ color: "var(--text-secondary)" }}>업로드 중...</span>
                  ) : (
                    <label style={{ cursor: isClosed ? "not-allowed" : "pointer", color: isClosed ? "var(--text-secondary)" : "var(--accent-primary)", fontSize: "0.80rem" }}>
                      {isClosed ? "첨부불가" : "파일 첨부"}
                      <input type="file" style={{ display: "none" }} disabled={isClosed}
                        onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(r.id, e.target.files[0]); }} />
                    </label>
                  )}
                </td>
                <td style={{ borderRight: "1px solid rgba(0,0,0,0.08)" }}>
                  <input type="text" className="input-field" placeholder="상세 내용 기입"
                    value={r.yDetail} onChange={e => handleInputChange(r.id, "yDetail", e.target.value)}
                    style={{ minWidth: "160px" }} disabled={isClosed} />
                  {isClosed && !isViewingAccumulated && (
                    <div style={{ marginTop: "0.3rem" }}>
                      <button onClick={() => handleRequestEdit(r)} className="print-hide"
                        style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: "4px", color: "#dc2626", cursor: "pointer" }}>
                        권한 요청
                      </button>
                    </div>
                  )}
                </td>

                {/* 퇴원생 정보 11종 */}
                <td style={{ color: "#2563eb", fontWeight: "bold" }}>{r.studentName}</td>
                <td>{r.school}</td>
                <td>{r.grade}</td>
                <td style={{ color: "var(--text-secondary)" }}>{r.lastAttend || "-"}</td>
                <td>{r.reasonOriginal || "-"}</td>
                <td>{r.classType2}</td>
                <td>{r.className}</td>
                <td>{r.startDate}</td>
                <td>{r.endDate}</td>
                <td style={{ color: "var(--text-primary)", fontWeight: "bold" }}>{r.code}</td>
                <td style={{ color: "var(--text-secondary)" }}>{r.downloadDate}</td>
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
          <h2>퇴원생 관리</h2>
          <p>퇴원율 보고서 & 퇴원사유 상세내역.</p>
        </div>
        
        {/* 툴바 및 필터 영역 (인쇄 시 숨김) */}
        <div className="print-hide" style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>

          {/* 사유 작성 탭 — 월 필터 */}
          {activeTab === "input" && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.95rem", color: "var(--text-secondary)", fontWeight: 600 }}>월:</span>
              <select className="filter-select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                <option value="all">전체 월</option>
                {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          {/* 보고서 탭 — 년월/분기 필터 */}
          {activeTab === "report" && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", borderRadius: "6px", overflow: "hidden", border: "1px solid rgba(0,0,0,0.12)" }}>
                <button
                  onClick={() => setReportViewMode("month")}
                  style={{ padding: "0.3rem 0.75rem", fontSize: "0.82rem", cursor: "pointer", border: "none",
                    background: reportViewMode === "month" ? "rgba(79,70,229,0.15)" : "transparent",
                    color: reportViewMode === "month" ? "#4f46e5" : "var(--text-secondary)" }}
                >월별</button>
                <button
                  onClick={() => setReportViewMode("quarter")}
                  style={{ padding: "0.3rem 0.75rem", fontSize: "0.82rem", cursor: "pointer", border: "none",
                    background: reportViewMode === "quarter" ? "rgba(79,70,229,0.15)" : "transparent",
                    color: reportViewMode === "quarter" ? "#4f46e5" : "var(--text-secondary)" }}
                >분기별</button>
              </div>
              {reportViewMode === "month" ? (
                <select className="filter-select" value={reportSelectedMonth} onChange={e => setReportSelectedMonth(e.target.value)}>
                  <option value="all">전체 월</option>
                  {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <select className="filter-select" value={reportSelectedQuarter} onChange={e => setReportSelectedQuarter(e.target.value)}>
                  <option value="all">전체 분기</option>
                  {quarterOptions.map(q => <option key={q} value={q}>{q.replace("-Q", "년 Q")}</option>)}
                </select>
              )}
            </div>
          )}

          {/* 내보내기 그룹 — 관리자/중간관리자/보고서권한자만 표시 */}
          {(userInfo?.role === "admin" || userInfo?.role === "mid_admin" || (userInfo?.reportCodes?.length > 0)) && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn-secondary" onClick={handleExportCSV}>
                엑셀다운(cvs)
              </button>
              <button className="btn-secondary" onClick={handlePrintPDF}>
                인쇄 (PDF 저장)
              </button>
            </div>
          )}

          {activeTab === "input" && !isViewingAccumulated && (
            <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto" }}>
              <button className="btn-secondary" onClick={handleTempSave}
                style={{ fontSize: "0.9rem", border: "1px solid rgba(217,119,6,0.5)", color: "#d97706" }}>
                임시저장
              </button>
              <button className="btn-primary" onClick={handleFinalSubmit} style={{ fontSize: "1rem" }}>
                저장 및 전송
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="tabs-container">
        {(userInfo?.role === "admin" || userInfo?.role === "mid_admin" || (userInfo?.reportCodes?.length > 0)) && (
          <button
            className={`tab-button ${activeTab === "report" ? "active" : ""}`}
            onClick={() => setActiveTab("report")}
          >
            보고서 조회
          </button>
        )}
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

      <ChatbotOverlay />

      {/* 분류별 차이 팝업 */}
      {diffPopup && (
        <div
          style={{
            position: "fixed", zIndex: 1000,
            top: `calc(50% + ${popupPos.y}px)`,
            left: `calc(50% + ${popupPos.x}px)`,
            transform: "translate(-50%, -50%)",
            background: "var(--bg-secondary, #f2ece2)", borderRadius: "12px",
            border: "1px solid rgba(0,0,0,0.12)", padding: "0",
            maxWidth: "90vw", maxHeight: "80vh",
            minWidth: "640px", display: "flex", flexDirection: "column",
            boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          }}
        >
          {/* 드래그 핸들 — 헤더 */}
          <div
            onMouseDown={(e) => {
              dragRef.current = { startX: e.clientX, startY: e.clientY, origX: popupPos.x, origY: popupPos.y };
              const onMove = (ev: MouseEvent) => {
                if (!dragRef.current) return;
                setPopupPos({ x: dragRef.current.origX + ev.clientX - dragRef.current.startX, y: dragRef.current.origY + ev.clientY - dragRef.current.startY });
              };
              const onUp = () => { dragRef.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1.2rem 0.7rem",
              borderBottom: "1px solid rgba(0,0,0,0.08)", cursor: "grab", userSelect: "none",
              borderRadius: "12px 12px 0 0", background: "rgba(0,0,0,0.02)" }}
          >
            <h3 style={{ margin: 0, fontSize: "0.95rem" }}>
              🔍 <span style={{ color: "#d97706" }}>{diffPopup.category}</span> — 사업부 vs 기조실 차이 내역
            </h3>
            <button
              onClick={() => { setDiffPopup(null); setPopupPos({ x: 0, y: 0 }); }}
              style={{ background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: "1.2rem", cursor: "pointer", lineHeight: 1 }}
            >✕</button>
          </div>

          {/* 내용 */}
          <div style={{ padding: "1rem 1.2rem", overflow: "auto" }}>
            {diffPopup.records.length === 0 ? (
              <p style={{ opacity: 0.6, fontSize: "0.88rem" }}>차이 내역이 없습니다.</p>
            ) : (
              <table style={{ fontSize: "0.8rem", borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                    <th style={{ padding: "0.4rem 0.75rem", textAlign: "left", color: "var(--text-secondary)" }}>#</th>
                    <th style={{ padding: "0.4rem 0.75rem", textAlign: "left", color: "var(--text-secondary)" }}>학생명</th>
                    <th style={{ padding: "0.4rem 0.75rem", textAlign: "left", color: "var(--text-secondary)" }}>반명</th>
                    <th style={{ padding: "0.4rem 0.75rem", textAlign: "left", color: "var(--text-secondary)" }}>수익코드</th>
                    <th style={{ padding: "0.4rem 0.75rem", textAlign: "left", color: "#4f46e5" }}>사업부 작성</th>
                    <th style={{ padding: "0.4rem 0.75rem", textAlign: "left", color: "#059669" }}>기조실 확정</th>
                  </tr>
                </thead>
                <tbody>
                  {diffPopup.records.map((r, i) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                      <td style={{ padding: "0.35rem 0.75rem", color: "var(--text-secondary)" }}>{i + 1}</td>
                      <td style={{ padding: "0.35rem 0.75rem" }}>
                        <span
                          style={{ color: "#2563eb", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                          title="클릭하면 해당 행으로 이동 (팝업 유지)"
                          onClick={() => {
                            setHighlightedRowId(r.id);
                            document.getElementById(`input-row-${r.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                            setTimeout(() => setHighlightedRowId(null), 2500);
                          }}
                        >{r.studentName}</span>
                      </td>
                      <td style={{ padding: "0.35rem 0.75rem" }}>{r.className}</td>
                      <td style={{ padding: "0.35rem 0.75rem", color: "var(--accent-primary, #4f46e5)", fontWeight: 700 }}>{r.code}</td>
                      <td style={{ padding: "0.35rem 0.75rem", color: r.vReason1?.trim() === diffPopup.category ? "#4f46e5" : "#dc2626" }}>
                        {r.vReason1 || <span style={{ opacity: 0.4 }}>미작성</span>}
                      </td>
                      <td style={{ padding: "0.35rem 0.75rem", color: r.zAdminReason1?.trim() === diffPopup.category ? "#059669" : "#dc2626" }}>
                        {r.zAdminReason1 || <span style={{ opacity: 0.4 }}>미확정</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}
