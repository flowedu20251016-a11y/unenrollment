"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

function EditorDashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"report" | "input" | "kpi-student" | "kpi-report">("input");
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

  // 1차 vs 최종 비교 모달
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareSection, setCompareSection] = useState<"students" | "report">("students");
  const [compareExpandedCodes, setCompareExpandedCodes] = useState<Set<string>>(new Set());
  const [compareMonth, setCompareMonth] = useState<string>("all");

  // 보고서 탭 필터
  const [reportViewMode, setReportViewMode] = useState<"month" | "quarter">("month");
  const [reportSelectedMonth, setReportSelectedMonth] = useState("all");
  const [reportSelectedQuarter, setReportSelectedQuarter] = useState("all");
  const [reportSelectedDepts, setReportSelectedDepts] = useState<string[]>([]);
  const [reportSelectedBrands, setReportSelectedBrands] = useState<string[]>([]);
  const [reportSelectedCampuses, setReportSelectedCampuses] = useState<string[]>([]);

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

  // KPI 데이터
  const [kpiInputRecords, setKpiInputRecords] = useState<InputRecordType[]>([]);
  const [kpiReportRecords, setKpiReportRecords] = useState<ReportRecordType[]>([]);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiLoaded, setKpiLoaded] = useState(false);
  const [kpiMonth, setKpiMonth] = useState("all");
  const [kpiCode, setKpiCode] = useState("all");
  const [kpiReportMonth, setKpiReportMonth] = useState("all");
  const [kpiReportCode, setKpiReportCode] = useState("all");
  const [kpiReportDepts, setKpiReportDepts] = useState<string[]>([]);
  const [kpiReportBrands, setKpiReportBrands] = useState<string[]>([]);
  const [kpiReportCampuses, setKpiReportCampuses] = useState<string[]>([]);

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

  // 보고서 탭 기본 데이터 (현재+누적 합산, 누적 우선)
  const allEditorReportRecords = useMemo(() => {
    const accMonths = new Set(accReportRecords.map(r => r.month).filter(Boolean));
    return [...accReportRecords, ...reportRecords.filter(r => !accMonths.has(r.month))];
  }, [reportRecords, accReportRecords]);

  const reportDeptOptions = useMemo(() => Array.from(new Set(allEditorReportRecords.map(r => r.department).filter(Boolean))).sort() as string[], [allEditorReportRecords]);
  const reportBrandOptions = useMemo(() => Array.from(new Set(allEditorReportRecords.map(r => r.brand).filter(Boolean))).sort() as string[], [allEditorReportRecords]);
  const reportCampusOptions = useMemo(() => Array.from(new Set(allEditorReportRecords.map(r => r.campus).filter(Boolean))).sort() as string[], [allEditorReportRecords]);

  // 보고서 탭 필터링 — 보고서/누적보고서 시트의 month 컬럼 직접 참조
  const filteredReportRecords = useMemo(() => {
    let result = allEditorReportRecords;
    if (reportViewMode === "month") {
      if (reportSelectedMonth !== "all") result = result.filter(r => r.month === reportSelectedMonth);
    } else {
      if (reportSelectedQuarter !== "all") {
        const [year, q] = reportSelectedQuarter.split("-Q");
        const qNum = parseInt(q);
        const months = [1, 2, 3].map(i => `${year}-${String((qNum - 1) * 3 + i).padStart(2, "0")}`);
        result = result.filter(r => months.includes(r.month));
      }
    }
    if (reportSelectedDepts.length > 0) result = result.filter(r => reportSelectedDepts.includes(r.department));
    if (reportSelectedBrands.length > 0) result = result.filter(r => reportSelectedBrands.includes(r.brand));
    if (reportSelectedCampuses.length > 0) result = result.filter(r => reportSelectedCampuses.includes(r.campus));
    return result;
  }, [allEditorReportRecords, reportViewMode, reportSelectedMonth, reportSelectedQuarter, reportSelectedDepts, reportSelectedBrands, reportSelectedCampuses]);

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
    let source: InputRecordType[];
    if (selectedMonth === "all") {
      // 전체보기: 누적최종(마감 완료) + 최종(누적에 없는 월만)
      const accMonths = new Set(accInputRecords.map(r => r.colA).filter(Boolean));
      source = [...accInputRecords, ...inputRecords.filter(r => !accMonths.has(r.colA))];
    } else {
      source = isViewingAccumulated ? accInputRecords : inputRecords;
    }
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
    const initSection = searchParams?.get("section");
    if (initSection === "report" && (user.role === "admin" || user.role === "mid_admin" || user.reportCodes?.length > 0)) {
      setActiveTab("report");
    } else if (initSection === "input") {
      setActiveTab("input");
    } else if (user.role === "admin" || user.role === "mid_admin" || (user.reportCodes?.length > 0)) {
      setActiveTab("report");
    }
    fetchData(user);
  }, []);

  // 사이드바 section 파라미터 → 탭 전환
  useEffect(() => {
    const s = searchParams?.get("section");
    if (s === "report") setActiveTab("report");
    else if (s === "input") setActiveTab("input");
    else if (s === "input-final") setActiveTab("kpi-student");
    else if (s === "report-final") setActiveTab("kpi-report");
  }, [searchParams]);

  // KPI 탭 진입 시 lazy load
  useEffect(() => {
    if ((activeTab === "kpi-student" || activeTab === "kpi-report") && !kpiLoaded && !kpiLoading) {
      const sessionStr = typeof window !== "undefined" ? localStorage.getItem("dropout_user") : null;
      const user = sessionStr ? JSON.parse(sessionStr) : null;
      fetchKpiData(user);
    }
  }, [activeTab]);

  const fetchKpiData = async (user: any) => {
    setKpiLoading(true);
    try {
      const [kpiCurRes, kpiAccRes, kpiRepRes] = await Promise.all([
        fetch("/api/records/input?tab=kpi최종", { cache: "no-store" }),
        fetch("/api/records/input?tab=kpi누적최종", { cache: "no-store" }),
        fetch("/api/records?tab=kpi누적보고서", { cache: "no-store" }),
      ]);
      const [kpiCur, kpiAcc, kpiRep] = await Promise.all([kpiCurRes.json(), kpiAccRes.json(), kpiRepRes.json()]);

      let iCur = kpiCur.records || [];
      let iAcc = kpiAcc.records || [];
      let rKpi = kpiRep.records || [];

      if (user && user.role !== "admin" && user.role !== "mid_admin") {
        const inputCodes = user.profitCodes || [];
        const reportCodes: string[] = user.reportCodes?.length > 0 ? user.reportCodes : inputCodes;
        iCur = iCur.filter((r: any) => inputCodes.includes(String(r.code)));
        iAcc = iAcc.filter((r: any) => inputCodes.includes(String(r.code)));
        rKpi = rKpi.filter((r: any) => reportCodes.includes(String(r.code)));
      }

      const accMonths = new Set(iAcc.map((r: any) => r.colA).filter(Boolean));
      const merged = [...iAcc, ...iCur.filter((r: any) => !accMonths.has(r.colA))];
      setKpiInputRecords(merged);
      setKpiReportRecords(rKpi);
      setKpiLoaded(true);
    } catch (err) {
      console.error(err);
    } finally {
      setKpiLoading(false);
    }
  };

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
  // 1차 vs 최종 비교 로직
  // -----------------------------------------------------

  const handleOpenCompare = () => {
    setShowCompareModal(true);
    setCompareSection("students");
    // 현재 탭 월 필터를 초기값으로
    setCompareMonth(activeTab === "kpi-student" ? kpiMonth : selectedMonth);
    if (!kpiLoaded && userInfo) fetchKpiData(userInfo);
  };

  const compareResult = useMemo(() => {
    if (!showCompareModal) return null;

    // 1차 탭(inputRecords) vs 최종 탭(kpiInputRecords) 비교
    const firstRecs = compareMonth === "all"
      ? inputRecords
      : inputRecords.filter(r => r.colA === compareMonth);
    const finalRecs = compareMonth === "all"
      ? kpiInputRecords
      : kpiInputRecords.filter(r => r.colA === compareMonth);

    const makeKey = (r: InputRecordType) => `${r.code}||${r.className}||${r.studentName}`;
    const firstMap = new Map(firstRecs.map(r => [makeKey(r), r]));
    const finalMap = new Map(finalRecs.map(r => [makeKey(r), r]));

    type CompareRow = {
      key: string; code: string; className: string; studentName: string;
      type: "추가" | "삭제" | "변경" | "동일";
      first: InputRecordType | null; final: InputRecordType | null;
    };
    const students: CompareRow[] = [];

    finalRecs.forEach(r => {
      const key = makeKey(r);
      const f = firstMap.get(key);
      if (!f) {
        students.push({ key, code: r.code, className: r.className, studentName: r.studentName, type: "추가", first: null, final: r });
      } else {
        const changed = f.zAdminReason1 !== r.zAdminReason1 || f.aaAdminReason2 !== r.aaAdminReason2 || f.vReason1 !== r.vReason1;
        students.push({ key, code: r.code, className: r.className, studentName: r.studentName, type: changed ? "변경" : "동일", first: f, final: r });
      }
    });
    firstRecs.forEach(r => {
      const key = makeKey(r);
      if (!finalMap.has(key)) {
        students.push({ key, code: r.code, className: r.className, studentName: r.studentName, type: "삭제", first: r, final: null });
      }
    });

    const typeOrder: Record<string, number> = { "추가": 0, "변경": 1, "삭제": 2, "동일": 3 };
    students.sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9));

    // 보고서용: 수익코드별 집계
    const codes = Array.from(new Set([...finalRecs.map(r => r.code), ...firstRecs.map(r => r.code)].filter(Boolean))).sort();
    const reportRows = codes.map(code => {
      const fc = firstRecs.filter(r => r.code === code);
      const fn = finalRecs.filter(r => r.code === code);
      const reasonBreakdown: Record<string, { first: number; final: number }> = {};
      [...new Set([...fc.map(r => r.zAdminReason1), ...fn.map(r => r.zAdminReason1)].filter(Boolean))].forEach(reason => {
        reasonBreakdown[reason] = {
          first: fc.filter(r => r.zAdminReason1 === reason).length,
          final: fn.filter(r => r.zAdminReason1 === reason).length,
        };
      });
      return {
        code,
        firstTotal: fc.length,
        finalTotal: fn.length,
        firstConfirmed: fc.filter(r => r.zAdminReason1).length,
        finalConfirmed: fn.filter(r => r.zAdminReason1).length,
        delta: fn.length - fc.length,
        reasonBreakdown,
      };
    });

    return {
      students,
      summary: {
        total: students.length,
        added: students.filter(s => s.type === "추가").length,
        deleted: students.filter(s => s.type === "삭제").length,
        changed: students.filter(s => s.type === "변경").length,
        same: students.filter(s => s.type === "동일").length,
      },
      reportRows,
    };
  }, [showCompareModal, compareMonth, inputRecords, kpiInputRecords]);

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
        const existing = inputRecords.find(r => r.id === id)?.xFileLink || "";
        const newLink = existing ? existing + "|||" + data.webViewLink : data.webViewLink;
        handleInputChange(id, "xFileLink", newLink);
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

  const handleFileDelete = (id: string, idx: number) => {
    if (!confirm("이 파일을 목록에서 삭제할까요?")) return;
    const record = inputRecords.find(r => r.id === id);
    if (!record?.xFileLink) return;
    const links = record.xFileLink.split("|||");
    links.splice(idx, 1);
    handleInputChange(id, "xFileLink", links.join("|||"));
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
    const recordsToSave = inputRecords.filter(r => r.vReason1 || r.yDetail || r.xFileLink);
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

  const handleExportXLSX = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    if (activeTab === "report") {
      const records = filteredReportRecords;
      if (records.length === 0) return alert("다운로드할 데이터가 없습니다.");

      // 2행 헤더 구성
      const header1 = [
        "연월", "수익코드", "사업부", "브랜드", "캠퍼스", "작성자",
        "최종퇴원율", "", "", "",
        "목표퇴원율",
        "ACA", "", "", "", "",
        "경고·종강·이벤트", "", "", "", "",
        "ACA 재원", "",
      ];
      const header2 = [
        "", "", "", "", "", "",
        "재원(15일)", "최종퇴원", "퇴원율(%)", "브랜드평균(%)",
        "",
        "재원(말일)", "신규", "퇴원", "퇴원율(%)", "브랜드평균",
        "경고", "종강", "이벤트", "합계", "제외율(%)",
        "재원(15일)", "재원제외",
      ];

      const dataRows = records.map(r => [
        r.month, r.code, r.department, r.brand, r.campus, r.manager,
        r.finalJaewon, r.finalDropout, r.finalRate, r.finalBrandAvg,
        r.targetRate,
        r.acaJaewonEnd, r.acaNew, r.acaDropout, r.acaRealRate, r.acaBrandAvg,
        r.exWarn, r.exEnd, r.exEvent, r.exTotal, r.exRate,
        r.acaJaewon, r.acaJaewonDiff,
      ]);

      const wsData = [header1, header2, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // 병합 셀 설정 (1행 그룹 헤더)
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },  // 연월
        { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },  // 수익코드
        { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },  // 사업부
        { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } },  // 브랜드
        { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } },  // 캠퍼스
        { s: { r: 0, c: 5 }, e: { r: 1, c: 5 } },  // 작성자
        { s: { r: 0, c: 6 }, e: { r: 0, c: 9 } },  // 최종퇴원율
        { s: { r: 0, c: 10 }, e: { r: 1, c: 10 } }, // 목표퇴원율
        { s: { r: 0, c: 11 }, e: { r: 0, c: 15 } }, // ACA
        { s: { r: 0, c: 16 }, e: { r: 0, c: 20 } }, // 경고·종강·이벤트
        { s: { r: 0, c: 21 }, e: { r: 0, c: 22 } }, // ACA 재원
      ];

      // 열 너비
      ws["!cols"] = [
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 8 },
        { wch: 9 }, { wch: 8 }, { wch: 9 }, { wch: 10 },
        { wch: 9 },
        { wch: 9 }, { wch: 6 }, { wch: 6 }, { wch: 9 }, { wch: 9 },
        { wch: 6 }, { wch: 6 }, { wch: 7 }, { wch: 6 }, { wch: 9 },
        { wch: 9 }, { wch: 9 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, "보고서");
    } else {
      const records = filteredInputRecords;
      if (records.length === 0) return alert("다운로드할 데이터가 없습니다.");

      const headerRow = [
        "#", "년월", "수익코드",
        headers.zAdminReason1 || "사유(기조실)", headers.aaAdminReason2 || "종류(기조실)", headers.abAdminDetail || "상세(기조실)",
        headers.vReason1 || "퇴원사유(분류1)", headers.wReason2 || "퇴원종류(분류2)", headers.xFileLink || "증빙여부", headers.yDetail || "상세내역",
        "학생명", "학교명", "학년", "마지막출석일", "사유원문",
        "반형태2", "반명", "시작일", "종료일", "다운일자", "상태",
      ];

      const dataRows = records.map((r, idx) => [
        idx + 1, r.colA, r.code,
        r.zAdminReason1 || "", r.aaAdminReason2 || "", r.abAdminDetail || "",
        r.vReason1 || "", r.wReason2 || "", r.xFileLink ? "O" : "", r.yDetail || "",
        r.studentName, r.school, r.grade, r.lastAttend || "", r.reasonOriginal || "",
        r.classType2, r.className, r.startDate, r.endDate, r.downloadDate,
        r.status === "closed" ? "마감됨" : "작성가능",
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      ws["!cols"] = [
        { wch: 4 }, { wch: 10 }, { wch: 10 },
        { wch: 14 }, { wch: 14 }, { wch: 20 },
        { wch: 14 }, { wch: 16 }, { wch: 8 }, { wch: 22 },
        { wch: 10 }, { wch: 12 }, { wch: 6 }, { wch: 12 }, { wch: 20 },
        { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "퇴원사유");
    }

    const monthLabel = activeTab === "report"
      ? (reportViewMode === "month" ? reportSelectedMonth : reportSelectedQuarter)
      : selectedMonth;
    const fileName = `퇴원데이터_${monthLabel !== "all" ? monthLabel : "전체"}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };


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
          border: allSelected ? "1px solid #8B7355" : "1px solid rgba(0,0,0,0.12)",
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
                border: active ? "1px solid #8B7355" : "1px solid rgba(0,0,0,0.12)",
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

  // KPI 보고서 파생 데이터
  const kpiReportDeptOptions = useMemo(() => Array.from(new Set(kpiReportRecords.map(r => r.department).filter(Boolean))).sort() as string[], [kpiReportRecords]);
  const kpiReportBrandOptions = useMemo(() => Array.from(new Set(kpiReportRecords.map(r => r.brand).filter(Boolean))).sort() as string[], [kpiReportRecords]);
  const kpiReportCampusOptions = useMemo(() => Array.from(new Set(kpiReportRecords.map(r => r.campus).filter(Boolean))).sort() as string[], [kpiReportRecords]);
  const filteredKpiReportRecords = useMemo(() => {
    return kpiReportRecords.filter(r => {
      if (kpiReportMonth !== "all" && r.month !== kpiReportMonth) return false;
      if (kpiReportCode !== "all" && r.code !== kpiReportCode) return false;
      if (kpiReportDepts.length > 0 && !kpiReportDepts.includes(r.department)) return false;
      if (kpiReportBrands.length > 0 && !kpiReportBrands.includes(r.brand)) return false;
      if (kpiReportCampuses.length > 0 && !kpiReportCampuses.includes(r.campus)) return false;
      return true;
    });
  }, [kpiReportRecords, kpiReportMonth, kpiReportCode, kpiReportDepts, kpiReportBrands, kpiReportCampuses]);
  const kpiReportSummary = useMemo(() => {
    const sumField = (getter: (r: ReportRecordType) => string) => {
      const vals = filteredKpiReportRecords.map(r => parseFloat(getter(r))).filter(v => !isNaN(v));
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
    };
    return {
      finalJaewon: sumField(r => r.finalJaewon),
      finalDropout: sumField(r => r.finalDropout),
      acaJaewonEnd: sumField(r => r.acaJaewonEnd),
      acaNew: sumField(r => r.acaNew),
      acaDropout: sumField(r => r.acaDropout),
      exWarn: sumField(r => r.exWarn),
      exEnd: sumField(r => r.exEnd),
      exEvent: sumField(r => r.exEvent),
      exTotal: sumField(r => r.exTotal),
      acaJaewon: sumField(r => r.acaJaewon),
      acaJaewonDiff: sumField(r => r.acaJaewonDiff),
    };
  }, [filteredKpiReportRecords]);

  // 보고서 합계 계산
  const reportSummary = useMemo(() => {
    const sumField = (getter: (r: ReportRecordType) => string) => {
      const vals = filteredReportRecords.map(r => parseFloat(getter(r))).filter(v => !isNaN(v));
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
    };
    return {
      finalJaewon: sumField(r => r.finalJaewon),
      finalDropout: sumField(r => r.finalDropout),
      acaJaewonEnd: sumField(r => r.acaJaewonEnd),
      acaNew: sumField(r => r.acaNew),
      acaDropout: sumField(r => r.acaDropout),
      exWarn: sumField(r => r.exWarn),
      exEnd: sumField(r => r.exEnd),
      exEvent: sumField(r => r.exEvent),
      exTotal: sumField(r => r.exTotal),
      acaJaewon: sumField(r => r.acaJaewon),
      acaJaewonDiff: sumField(r => r.acaJaewonDiff),
    };
  }, [filteredReportRecords]);

  // TAB 1: 보고서 조회
  // 컬럼 순서: 연월 | 수익코드 사업부 브랜드 캠퍼스 작성자 | 재원(15일) 최종퇴원 최종퇴원율 브랜드평균 | 목표퇴원율
  //           | aca재원(말일) aca신규 aca퇴원 aca퇴원율 aca브랜드평균 | 경고 종강 이벤트 합계 퇴원제외율
  //           | aca재원(15일) 재원제외
  const renderReportTab = () => (
    <div>
      {/* 사업부/브랜드/캠퍼스 다중선택 필터 */}
      {(reportDeptOptions.length > 0 || reportBrandOptions.length > 0 || reportCampusOptions.length > 0) && (
        <div style={{ padding: "0.6rem 1rem", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {reportDeptOptions.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, minWidth: "3.5rem" }}>사업부</span>
              <button onClick={() => setReportSelectedDepts([])} style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem", cursor: "pointer", border: reportSelectedDepts.length === 0 ? "1px solid #8B7355" : "1px solid rgba(0,0,0,0.12)", background: reportSelectedDepts.length === 0 ? "rgba(79,70,229,0.12)" : "transparent", color: reportSelectedDepts.length === 0 ? "#4f46e5" : "var(--text-secondary)" }}>전체</button>
              {reportDeptOptions.map(d => (
                <button key={d} onClick={() => setReportSelectedDepts(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])} style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem", cursor: "pointer", border: reportSelectedDepts.includes(d) ? "1px solid #8B7355" : "1px solid rgba(0,0,0,0.12)", background: reportSelectedDepts.includes(d) ? "rgba(79,70,229,0.12)" : "transparent", color: reportSelectedDepts.includes(d) ? "#4f46e5" : "var(--text-secondary)" }}>{d}</button>
              ))}
            </div>
          )}
          {reportBrandOptions.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, minWidth: "3.5rem" }}>브랜드</span>
              <button onClick={() => setReportSelectedBrands([])} style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem", cursor: "pointer", border: reportSelectedBrands.length === 0 ? "1px solid #059669" : "1px solid rgba(0,0,0,0.12)", background: reportSelectedBrands.length === 0 ? "rgba(5,150,105,0.10)" : "transparent", color: reportSelectedBrands.length === 0 ? "#059669" : "var(--text-secondary)" }}>전체</button>
              {reportBrandOptions.map(b => (
                <button key={b} onClick={() => setReportSelectedBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])} style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem", cursor: "pointer", border: reportSelectedBrands.includes(b) ? "1px solid #059669" : "1px solid rgba(0,0,0,0.12)", background: reportSelectedBrands.includes(b) ? "rgba(5,150,105,0.10)" : "transparent", color: reportSelectedBrands.includes(b) ? "#059669" : "var(--text-secondary)" }}>{b}</button>
              ))}
            </div>
          )}
          {reportCampusOptions.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, minWidth: "3.5rem" }}>캠퍼스</span>
              <button onClick={() => setReportSelectedCampuses([])} style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem", cursor: "pointer", border: reportSelectedCampuses.length === 0 ? "1px solid #d97706" : "1px solid rgba(0,0,0,0.12)", background: reportSelectedCampuses.length === 0 ? "rgba(217,119,6,0.10)" : "transparent", color: reportSelectedCampuses.length === 0 ? "#d97706" : "var(--text-secondary)" }}>전체</button>
              {reportCampusOptions.map(c => (
                <button key={c} onClick={() => setReportSelectedCampuses(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem", cursor: "pointer", border: reportSelectedCampuses.includes(c) ? "1px solid #d97706" : "1px solid rgba(0,0,0,0.12)", background: reportSelectedCampuses.includes(c) ? "rgba(217,119,6,0.10)" : "transparent", color: reportSelectedCampuses.includes(c) ? "#d97706" : "var(--text-secondary)" }}>{c}</button>
              ))}
            </div>
          )}
          <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>총 <b style={{ color: "var(--text-primary)" }}>{filteredReportRecords.length}</b>건</span>
        </div>
      )}
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
        {filteredReportRecords.length > 0 && (
          <tfoot>
            <tr style={{ background: "rgba(0,0,0,0.05)", fontWeight: 700, borderTop: "2px solid rgba(0,0,0,0.15)" }}>
              <td colSpan={6} style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "0.78rem", padding: "0.4rem 0.6rem" }}>합계</td>
              <td style={{ borderLeft: "2px solid #059669" }}>{reportSummary.finalJaewon ?? "-"}</td>
              <td style={{ color: "#059669" }}>{reportSummary.finalDropout ?? "-"}</td>
              <td>-</td>
              <td style={{ borderRight: "1px solid rgba(0,0,0,0.08)" }}>-</td>
              <td style={{ borderRight: "2px solid #059669" }}>-</td>
              <td>{reportSummary.acaJaewonEnd ?? "-"}</td>
              <td>{reportSummary.acaNew ?? "-"}</td>
              <td>{reportSummary.acaDropout ?? "-"}</td>
              <td>-</td>
              <td style={{ borderRight: "1px solid rgba(0,0,0,0.08)" }}>-</td>
              <td>{reportSummary.exWarn ?? "-"}</td>
              <td>{reportSummary.exEnd ?? "-"}</td>
              <td>{reportSummary.exEvent ?? "-"}</td>
              <td style={{ color: "#d97706" }}>{reportSummary.exTotal ?? "-"}</td>
              <td style={{ borderRight: "1px solid rgba(0,0,0,0.08)" }}>-</td>
              <td>{reportSummary.acaJaewon ?? "-"}</td>
              <td>{reportSummary.acaJaewonDiff ?? "-"}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
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
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    {r.xFileLink && r.xFileLink.split("|||").map((link, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <a href={link} target="_blank" rel="noreferrer" style={{ color: "#059669", fontSize: "0.80rem" }}>
                          파일{idx + 1} 보기
                        </a>
                        {!isClosed && (
                          <button onClick={() => handleFileDelete(r.id, idx)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: "0.75rem", padding: "0", lineHeight: 1 }}
                            title="삭제">✕</button>
                        )}
                      </div>
                    ))}
                    {uploadingId === r.id ? (
                      <span style={{ color: "var(--text-secondary)", fontSize: "0.80rem" }}>업로드 중...</span>
                    ) : (
                      <label style={{ cursor: isClosed ? "not-allowed" : "pointer", color: isClosed ? "var(--text-secondary)" : "var(--accent-primary)", fontSize: "0.80rem" }}>
                        {isClosed ? "첨부불가" : r.xFileLink ? "추가 첨부" : "파일 첨부"}
                        <input type="file" style={{ display: "none" }} disabled={isClosed}
                          onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(r.id, e.target.files[0]); }} />
                      </label>
                    )}
                  </div>
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
          {(activeTab === "input" || activeTab === "kpi-student") && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.95rem", color: "var(--text-secondary)", fontWeight: 600 }}>월:</span>
              <select className="filter-select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                <option value="all">전체 월</option>
                {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <button
                onClick={handleOpenCompare}
                style={{
                  padding: "0.3rem 0.85rem", borderRadius: "6px", fontSize: "0.82rem", cursor: "pointer",
                  border: "1px solid rgba(79,70,229,0.35)", background: "rgba(79,70,229,0.08)",
                  color: "#4f46e5", fontWeight: 600, whiteSpace: "nowrap",
                }}
              >비교 보기</button>
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
              <button className="btn-secondary" onClick={handleExportXLSX}
                style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                📊 엑셀(.xlsx)
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

      {/* 탭 버튼 (사이드바로 대체 - 숨김 처리) */}
      <div className="tabs-container" style={{ display: "none" }}>
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

      {activeTab === "kpi-student" ? (
        <div className="glass-container" style={{ padding: "0" }}>
          {kpiLoading ? <p style={{ padding: "2rem" }}>동기화 중...</p> : (
            <div className="data-table-container" style={{ padding: 0, margin: 0, border: "none" }}>
              {/* 수익코드 필터 */}
              <div style={{ padding: "0.5rem 1rem", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>📅 월:</span>
                <select className="filter-select" value={kpiMonth} onChange={e => setKpiMonth(e.target.value)}>
                  <option value="all">전체보기</option>
                  {Array.from(new Set(kpiInputRecords.map(r => r.colA).filter(Boolean))).sort().reverse().map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600, marginLeft: "0.5rem" }}>수익코드:</span>
                {Array.from(new Set(kpiInputRecords.map(r => r.code).filter(Boolean))).sort().map(c => (
                  <button key={c} onClick={() => setKpiCode(prev => prev === c ? "all" : c)} style={{
                    padding: "0.25rem 0.9rem", borderRadius: "999px", fontSize: "0.78rem", cursor: "pointer",
                    border: kpiCode === c ? "1px solid #8B7355" : "1px solid rgba(0,0,0,0.12)",
                    background: kpiCode === c ? "rgba(79,70,229,0.12)" : "transparent",
                    color: kpiCode === c ? "#4f46e5" : "var(--text-secondary)",
                  }}>{c}</button>
                ))}
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginLeft: "auto" }}>
                  총 <b style={{ color: "var(--text-primary)" }}>{kpiInputRecords.filter(r => (kpiMonth === "all" || r.colA === kpiMonth) && (kpiCode === "all" || r.code === kpiCode)).length}</b>건
                </span>
              </div>
              <table className="data-table" style={{ borderCollapse: "collapse", fontSize: "0.80rem" }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ background: "rgba(0,0,0,0.03)", whiteSpace: "nowrap" }}>#</th>
                    <th colSpan={3} style={{ backgroundImage: "linear-gradient(rgba(5,150,105,0.12), rgba(5,150,105,0.12))", borderRight: "1px solid rgba(0,0,0,0.08)", color: "#059669" }}>기조실 확정</th>
                    <th colSpan={4} style={{ backgroundImage: "linear-gradient(rgba(79,70,229,0.10), rgba(79,70,229,0.10))", borderRight: "1px solid rgba(0,0,0,0.08)", color: "#4f46e5" }}>사업부 작성</th>
                    <th colSpan={11} style={{ background: "rgba(0,0,0,0.03)" }}>퇴원생 정보</th>
                  </tr>
                  <tr style={{ background: "rgba(0,0,0,0.02)", color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                    <th style={{ color: "#059669" }}>사유(기조실)</th>
                    <th style={{ color: "#059669" }}>종류(기조실)</th>
                    <th style={{ borderRight: "1px solid rgba(0,0,0,0.08)", color: "#059669" }}>상세(기조실)</th>
                    <th style={{ color: "#4f46e5" }}>퇴원사유(분류1)</th>
                    <th style={{ color: "#4f46e5" }}>퇴원종류(분류2)</th>
                    <th style={{ color: "#4f46e5" }}>증빙여부</th>
                    <th style={{ borderRight: "1px solid rgba(0,0,0,0.08)", color: "#4f46e5" }}>상세내역</th>
                    <th>학생명</th>
                    <th>학교명</th>
                    <th>학년</th>
                    <th>마지막출석일</th>
                    <th>사유원문</th>
                    <th>반형태2</th>
                    <th>반명</th>
                    <th>시작일</th>
                    <th>종료일</th>
                    <th>수익코드</th>
                    <th>다운일자</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiInputRecords
                    .filter(r => (kpiMonth === "all" || r.colA === kpiMonth) && (kpiCode === "all" || r.code === kpiCode))
                    .map((r, idx) => (
                      <tr key={r.id}>
                        <td style={{ color: "var(--text-secondary)", textAlign: "center" }}>{idx + 1}</td>
                        <td style={{ color: "var(--text-primary)" }}>{r.zAdminReason1 || "-"}</td>
                        <td style={{ color: "var(--text-primary)" }}>{r.aaAdminReason2 || "-"}</td>
                        <td style={{ color: "var(--text-primary)", borderRight: "1px solid rgba(0,0,0,0.08)" }}>
                          {r.abAdminDetail || "-"}
                          <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", color: "#dc2626" }}>🔒마감</span>
                        </td>
                        <td>{r.vReason1 || <span style={{ opacity: 0.4 }}>-</span>}</td>
                        <td>{r.wReason2 || <span style={{ opacity: 0.4 }}>-</span>}</td>
                        <td>
                          {r.xFileLink
                            ? r.xFileLink.split("|||").map((link, i) => (
                                <a key={i} href={link} target="_blank" rel="noreferrer" style={{ color: "#059669", fontSize: "0.80rem", display: "block" }}>파일{i + 1} 보기</a>
                              ))
                            : <span style={{ opacity: 0.4 }}>-</span>}
                        </td>
                        <td style={{ borderRight: "1px solid rgba(0,0,0,0.08)" }}>{r.yDetail || <span style={{ opacity: 0.4 }}>-</span>}</td>
                        <td style={{ color: "#2563eb", fontWeight: 600 }}>{r.studentName}</td>
                        <td>{r.school || <span style={{ opacity: 0.4 }}>-</span>}</td>
                        <td>{r.grade || <span style={{ opacity: 0.4 }}>-</span>}</td>
                        <td>{r.lastAttend || <span style={{ opacity: 0.4 }}>-</span>}</td>
                        <td>{r.reasonOriginal || <span style={{ opacity: 0.4 }}>-</span>}</td>
                        <td>{r.classType2 || <span style={{ opacity: 0.4 }}>-</span>}</td>
                        <td>{r.className}</td>
                        <td>{r.startDate || <span style={{ opacity: 0.4 }}>-</span>}</td>
                        <td>{r.endDate || <span style={{ opacity: 0.4 }}>-</span>}</td>
                        <td style={{ fontWeight: 700, color: "var(--accent-primary)" }}>{r.code}</td>
                        <td style={{ color: "var(--text-secondary)" }}>{r.downloadDate || <span style={{ opacity: 0.4 }}>-</span>}</td>
                      </tr>
                    ))}
                  {kpiInputRecords.filter(r => (kpiMonth === "all" || r.colA === kpiMonth) && (kpiCode === "all" || r.code === kpiCode)).length === 0 && (
                    <tr><td colSpan={19} style={{ textAlign: "center", padding: "3rem", opacity: 0.5 }}>KPI 퇴원생 데이터가 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeTab === "kpi-report" ? (
        <div className="glass-container" style={{ padding: "0" }}>
          {kpiLoading ? <p style={{ padding: "2rem" }}>동기화 중...</p> : (
            <div>
              {(kpiReportDeptOptions.length > 0 || kpiReportBrandOptions.length > 0 || kpiReportCampusOptions.length > 0) && (
                <div style={{ padding: "0.6rem 1rem", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {kpiReportDeptOptions.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, minWidth: "3.5rem" }}>사업부</span>
                      <button onClick={() => setKpiReportDepts([])} style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem", cursor: "pointer", border: kpiReportDepts.length === 0 ? "1px solid #8B7355" : "1px solid rgba(0,0,0,0.12)", background: kpiReportDepts.length === 0 ? "rgba(79,70,229,0.12)" : "transparent", color: kpiReportDepts.length === 0 ? "#4f46e5" : "var(--text-secondary)" }}>전체</button>
                      {kpiReportDeptOptions.map(d => (
                        <button key={d} onClick={() => setKpiReportDepts(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])} style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem", cursor: "pointer", border: kpiReportDepts.includes(d) ? "1px solid #8B7355" : "1px solid rgba(0,0,0,0.12)", background: kpiReportDepts.includes(d) ? "rgba(79,70,229,0.12)" : "transparent", color: kpiReportDepts.includes(d) ? "#4f46e5" : "var(--text-secondary)" }}>{d}</button>
                      ))}
                    </div>
                  )}
                  {kpiReportBrandOptions.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, minWidth: "3.5rem" }}>브랜드</span>
                      <button onClick={() => setKpiReportBrands([])} style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem", cursor: "pointer", border: kpiReportBrands.length === 0 ? "1px solid #059669" : "1px solid rgba(0,0,0,0.12)", background: kpiReportBrands.length === 0 ? "rgba(5,150,105,0.10)" : "transparent", color: kpiReportBrands.length === 0 ? "#059669" : "var(--text-secondary)" }}>전체</button>
                      {kpiReportBrandOptions.map(b => (
                        <button key={b} onClick={() => setKpiReportBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])} style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem", cursor: "pointer", border: kpiReportBrands.includes(b) ? "1px solid #059669" : "1px solid rgba(0,0,0,0.12)", background: kpiReportBrands.includes(b) ? "rgba(5,150,105,0.10)" : "transparent", color: kpiReportBrands.includes(b) ? "#059669" : "var(--text-secondary)" }}>{b}</button>
                      ))}
                    </div>
                  )}
                  {kpiReportCampusOptions.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, minWidth: "3.5rem" }}>캠퍼스</span>
                      <button onClick={() => setKpiReportCampuses([])} style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem", cursor: "pointer", border: kpiReportCampuses.length === 0 ? "1px solid #d97706" : "1px solid rgba(0,0,0,0.12)", background: kpiReportCampuses.length === 0 ? "rgba(217,119,6,0.10)" : "transparent", color: kpiReportCampuses.length === 0 ? "#d97706" : "var(--text-secondary)" }}>전체</button>
                      {kpiReportCampusOptions.map(c => (
                        <button key={c} onClick={() => setKpiReportCampuses(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem", cursor: "pointer", border: kpiReportCampuses.includes(c) ? "1px solid #d97706" : "1px solid rgba(0,0,0,0.12)", background: kpiReportCampuses.includes(c) ? "rgba(217,119,6,0.10)" : "transparent", color: kpiReportCampuses.includes(c) ? "#d97706" : "var(--text-secondary)" }}>{c}</button>
                      ))}
                    </div>
                  )}
                  <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>총 <b style={{ color: "var(--text-primary)" }}>{filteredKpiReportRecords.length}</b>건</span>
                </div>
              )}
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
                      <th style={{ backgroundImage: "linear-gradient(rgba(5,150,105,0.06), rgba(5,150,105,0.06))", color: "var(--text-secondary)", whiteSpace: "nowrap", borderLeft: "2px solid #059669" }}>재원(15일)</th>
                      <th style={{ backgroundImage: "linear-gradient(rgba(5,150,105,0.06), rgba(5,150,105,0.06))", color: "var(--text-secondary)" }}>최종퇴원</th>
                      <th style={{ backgroundImage: "linear-gradient(rgba(5,150,105,0.06), rgba(5,150,105,0.06))", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>퇴원율(%)</th>
                      <th style={{ backgroundImage: "linear-gradient(rgba(5,150,105,0.06), rgba(5,150,105,0.06))", color: "var(--text-secondary)", borderRight: "1px solid rgba(0,0,0,0.08)", whiteSpace: "nowrap" }}>브랜드평균(%)</th>
                      <th style={{ background: "rgba(0,0,0,0.02)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>재원(말일)</th>
                      <th style={{ background: "rgba(0,0,0,0.02)", color: "var(--text-secondary)" }}>신규</th>
                      <th style={{ background: "rgba(0,0,0,0.02)", color: "var(--text-secondary)" }}>퇴원</th>
                      <th style={{ background: "rgba(0,0,0,0.02)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>퇴원율(%)</th>
                      <th style={{ background: "rgba(0,0,0,0.02)", color: "var(--text-secondary)", borderRight: "1px solid rgba(0,0,0,0.08)", whiteSpace: "nowrap" }}>브랜드평균</th>
                      <th style={{ backgroundImage: "linear-gradient(rgba(245,158,11,0.08), rgba(245,158,11,0.08))", color: "var(--text-secondary)" }}>경고</th>
                      <th style={{ backgroundImage: "linear-gradient(rgba(245,158,11,0.08), rgba(245,158,11,0.08))", color: "var(--text-secondary)" }}>종강</th>
                      <th style={{ backgroundImage: "linear-gradient(rgba(245,158,11,0.08), rgba(245,158,11,0.08))", color: "var(--text-secondary)" }}>이벤트</th>
                      <th style={{ backgroundImage: "linear-gradient(rgba(245,158,11,0.10), rgba(245,158,11,0.10))", color: "var(--text-secondary)" }}>합계</th>
                      <th style={{ backgroundImage: "linear-gradient(rgba(245,158,11,0.08), rgba(245,158,11,0.08))", color: "var(--text-secondary)", borderRight: "1px solid rgba(0,0,0,0.08)", whiteSpace: "nowrap" }}>제외율(%)</th>
                      <th style={{ background: "rgba(0,0,0,0.02)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>재원(15일)</th>
                      <th style={{ background: "rgba(0,0,0,0.02)", color: "var(--text-secondary)" }}>재원제외</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKpiReportRecords.length === 0
                      ? <tr><td colSpan={22} style={{ textAlign: "center", padding: "3rem", opacity: 0.5 }}>KPI 보고서 데이터가 없습니다.</td></tr>
                      : filteredKpiReportRecords.map(r => {
                          const finalRateNum = parseFloat(r.finalRate);
                          const targetRateNum = parseFloat(r.targetRate);
                          const isOverTarget = !isNaN(finalRateNum) && !isNaN(targetRateNum) && finalRateNum > targetRateNum;
                          return (
                            <tr key={r.id}>
                              <td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{r.month}</td>
                              <td style={{ color: "var(--text-primary)", fontWeight: "bold" }}>{r.code}</td>
                              <td style={{ color: "var(--text-secondary)" }}>{r.department}</td>
                              <td style={{ color: "var(--text-secondary)" }}>{r.brand}</td>
                              <td style={{ color: "var(--text-secondary)" }}>{r.campus}</td>
                              <td style={{ color: "var(--text-secondary)", borderRight: "1px solid rgba(0,0,0,0.08)" }}>{r.manager}</td>
                              <td style={{ borderLeft: "2px solid #059669" }}>{r.finalJaewon}</td>
                              <td style={{ color: "#059669", fontWeight: "bold" }}>{r.finalDropout}</td>
                              <td style={{ color: isOverTarget ? "#fff" : "var(--danger)", fontWeight: "bold", background: isOverTarget ? "#dc2626" : undefined, borderRadius: isOverTarget ? "4px" : undefined }}>{r.finalRate}</td>
                              <td style={{ color: "var(--text-secondary)", borderRight: "1px solid rgba(0,0,0,0.08)" }}>{r.finalBrandAvg}</td>
                              <td style={{ color: "#2563eb", fontWeight: "bold", borderRight: "2px solid #059669" }}>{r.targetRate}</td>
                              <td style={{ color: "var(--text-secondary)" }}>{r.acaJaewonEnd}</td>
                              <td style={{ color: "var(--text-secondary)" }}>{r.acaNew}</td>
                              <td style={{ color: "var(--text-secondary)" }}>{r.acaDropout}</td>
                              <td style={{ color: "var(--text-secondary)" }}>{r.acaRealRate}</td>
                              <td style={{ color: "var(--text-secondary)", borderRight: "1px solid rgba(0,0,0,0.08)" }}>{r.acaBrandAvg}</td>
                              <td style={{ color: "var(--text-secondary)" }}>{r.exWarn}</td>
                              <td style={{ color: "var(--text-secondary)" }}>{r.exEnd}</td>
                              <td style={{ color: "var(--text-secondary)" }}>{r.exEvent}</td>
                              <td style={{ color: "#d97706", fontWeight: "bold" }}>{r.exTotal}</td>
                              <td style={{ color: "var(--text-secondary)", borderRight: "1px solid rgba(0,0,0,0.08)" }}>{r.exRate}</td>
                              <td style={{ color: "var(--text-secondary)" }}>{r.acaJaewon}</td>
                              <td style={{ color: "var(--text-secondary)" }}>{r.acaJaewonDiff}</td>
                            </tr>
                          );
                        })
                    }
                  </tbody>
                  {filteredKpiReportRecords.length > 0 && (
                    <tfoot>
                      <tr style={{ background: "rgba(0,0,0,0.05)", fontWeight: 700, borderTop: "2px solid rgba(0,0,0,0.15)" }}>
                        <td colSpan={6} style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "0.78rem", padding: "0.4rem 0.6rem" }}>합계</td>
                        <td style={{ borderLeft: "2px solid #059669" }}>{kpiReportSummary.finalJaewon ?? "-"}</td>
                        <td style={{ color: "#059669" }}>{kpiReportSummary.finalDropout ?? "-"}</td>
                        <td>-</td>
                        <td style={{ borderRight: "1px solid rgba(0,0,0,0.08)" }}>-</td>
                        <td style={{ borderRight: "2px solid #059669" }}>-</td>
                        <td>{kpiReportSummary.acaJaewonEnd ?? "-"}</td>
                        <td>{kpiReportSummary.acaNew ?? "-"}</td>
                        <td>{kpiReportSummary.acaDropout ?? "-"}</td>
                        <td>-</td>
                        <td style={{ borderRight: "1px solid rgba(0,0,0,0.08)" }}>-</td>
                        <td>{kpiReportSummary.exWarn ?? "-"}</td>
                        <td>{kpiReportSummary.exEnd ?? "-"}</td>
                        <td>{kpiReportSummary.exEvent ?? "-"}</td>
                        <td style={{ color: "#d97706" }}>{kpiReportSummary.exTotal ?? "-"}</td>
                        <td style={{ borderRight: "1px solid rgba(0,0,0,0.08)" }}>-</td>
                        <td>{kpiReportSummary.acaJaewon ?? "-"}</td>
                        <td>{kpiReportSummary.acaJaewonDiff ?? "-"}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="glass-container" style={{ padding: "0" }}>
          {loading ? (
            <p style={{ padding: "2rem" }}>데이터를 동기화하는 중입니다...</p>
          ) : (
            activeTab === "report" ? renderReportTab() : renderInputTab()
          )}
        </div>
      )}

      <ChatbotOverlay />

      {/* 1차 vs 최종 비교 모달 */}
      {showCompareModal && (
        <>
          <div
            onClick={() => setShowCompareModal(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1050 }}
          />
          <div style={{
            position: "fixed", zIndex: 1060,
            top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            background: "var(--bg-secondary, #f2ece2)", borderRadius: "12px",
            border: "1px solid rgba(0,0,0,0.12)",
            width: "min(92vw, 900px)", maxHeight: "85vh",
            display: "flex", flexDirection: "column",
            boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
          }}>
            {/* 헤더 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1.2rem 0.7rem", borderBottom: "1px solid rgba(0,0,0,0.08)", borderRadius: "12px 12px 0 0", background: "rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: "0.95rem" }}>1차 vs 최종 비교</h3>
                <select
                  value={compareMonth}
                  onChange={e => setCompareMonth(e.target.value)}
                  className="filter-select"
                  style={{ fontSize: "0.8rem" }}
                >
                  <option value="all">전체 월</option>
                  {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <div style={{ display: "flex", borderRadius: "6px", overflow: "hidden", border: "1px solid rgba(0,0,0,0.12)" }}>
                  <button onClick={() => setCompareSection("students")} style={{ padding: "0.2rem 0.7rem", fontSize: "0.78rem", cursor: "pointer", border: "none", background: compareSection === "students" ? "rgba(79,70,229,0.15)" : "transparent", color: compareSection === "students" ? "#4f46e5" : "var(--text-secondary)" }}>퇴원생 비교</button>
                  <button onClick={() => setCompareSection("report")} style={{ padding: "0.2rem 0.7rem", fontSize: "0.78rem", cursor: "pointer", border: "none", background: compareSection === "report" ? "rgba(5,150,105,0.15)" : "transparent", color: compareSection === "report" ? "#059669" : "var(--text-secondary)" }}>집계 비교</button>
                </div>
              </div>
              <button onClick={() => setShowCompareModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
            </div>

            {/* 본문 */}
            <div style={{ overflow: "auto", flex: 1 }}>
              {!compareResult ? null : compareSection === "students" ? (
                /* ── 퇴원생 비교 섹션 ── */
                <div>
                  {/* 요약 바 */}
                  <div style={{ display: "flex", gap: "1.25rem", padding: "0.65rem 1.2rem", borderBottom: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.02)", fontSize: "0.82rem", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ color: "var(--text-secondary)" }}>전체 <b style={{ color: "var(--text-primary)" }}>{compareResult.summary.total}</b>명</span>
                    {compareResult.summary.added > 0 && <span style={{ color: "#dc2626", fontWeight: 700 }}>🔴 추가 {compareResult.summary.added}명</span>}
                    {compareResult.summary.changed > 0 && <span style={{ color: "#d97706", fontWeight: 700 }}>🟡 변경 {compareResult.summary.changed}명</span>}
                    {compareResult.summary.deleted > 0 && <span style={{ color: "#6b7280", fontWeight: 700 }}>⚫ 삭제 {compareResult.summary.deleted}명</span>}
                    <span style={{ color: "#059669" }}>동일 {compareResult.summary.same}명</span>
                  </div>
                  <table style={{ fontSize: "0.79rem", borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                      <tr style={{ background: "rgba(0,0,0,0.03)", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                        <th style={{ padding: "0.4rem 0.75rem", textAlign: "left", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>구분</th>
                        <th style={{ padding: "0.4rem 0.75rem", textAlign: "left", color: "var(--text-secondary)" }}>수익코드</th>
                        <th style={{ padding: "0.4rem 0.75rem", textAlign: "left", color: "var(--text-secondary)" }}>반명</th>
                        <th style={{ padding: "0.4rem 0.75rem", textAlign: "left", color: "var(--text-secondary)" }}>학생명</th>
                        <th style={{ padding: "0.4rem 0.75rem", textAlign: "left", color: "#6b7280" }}>1차 기조실확정</th>
                        <th style={{ padding: "0.4rem 0.75rem", textAlign: "left", color: "#059669" }}>최종 기조실확정</th>
                        <th style={{ padding: "0.4rem 0.75rem", textAlign: "left", color: "#6b7280" }}>1차 사유(사업부)</th>
                        <th style={{ padding: "0.4rem 0.75rem", textAlign: "left", color: "#059669" }}>최종 사유(사업부)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareResult.students.map((s, i) => {
                        const typeMeta: Record<string, { label: string; color: string; bg: string }> = {
                          "추가": { label: "추가", color: "#dc2626", bg: "rgba(220,38,38,0.06)" },
                          "변경": { label: "변경", color: "#d97706", bg: "rgba(217,119,6,0.06)" },
                          "삭제": { label: "삭제", color: "#6b7280", bg: "rgba(107,114,128,0.06)" },
                          "동일": { label: "동일", color: "var(--text-secondary)", bg: "transparent" },
                        };
                        const meta = typeMeta[s.type];
                        const firstAdmin = s.first?.zAdminReason1 || "";
                        const finalAdmin = s.final?.zAdminReason1 || "";
                        const firstReason = s.first ? [s.first.vReason1, s.first.wReason2].filter(Boolean).join(" > ") : "";
                        const finalReason = s.final ? [s.final.vReason1, s.final.wReason2].filter(Boolean).join(" > ") : "";
                        const adminChanged = firstAdmin !== finalAdmin;
                        const reasonChanged = firstReason !== finalReason;
                        return (
                          <tr key={s.key + i} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", background: meta.bg }}>
                            <td style={{ padding: "0.32rem 0.75rem", whiteSpace: "nowrap" }}>
                              <span style={{ fontWeight: 700, color: meta.color, fontSize: "0.75rem", padding: "0.1rem 0.4rem", borderRadius: "4px", border: `1px solid ${meta.color}` }}>{meta.label}</span>
                            </td>
                            <td style={{ padding: "0.32rem 0.75rem", color: "#4f46e5", fontWeight: 700 }}>{s.code}</td>
                            <td style={{ padding: "0.32rem 0.75rem", color: "var(--text-secondary)" }}>{s.className}</td>
                            <td style={{ padding: "0.32rem 0.75rem", fontWeight: 600 }}>{s.studentName}</td>
                            <td style={{ padding: "0.32rem 0.75rem", color: adminChanged ? "#6b7280" : "var(--text-secondary)", textDecoration: adminChanged ? "line-through" : "none", opacity: adminChanged ? 0.7 : 1 }}>
                              {firstAdmin || <span style={{ opacity: 0.35 }}>미확정</span>}
                            </td>
                            <td style={{ padding: "0.32rem 0.75rem", color: adminChanged ? "#059669" : "var(--text-secondary)", fontWeight: adminChanged ? 700 : "normal" }}>
                              {finalAdmin || <span style={{ opacity: 0.35 }}>미확정</span>}
                            </td>
                            <td style={{ padding: "0.32rem 0.75rem", color: reasonChanged ? "#6b7280" : "var(--text-secondary)", textDecoration: reasonChanged ? "line-through" : "none", opacity: reasonChanged ? 0.7 : 1, fontSize: "0.75rem" }}>
                              {firstReason || <span style={{ opacity: 0.35 }}>미작성</span>}
                            </td>
                            <td style={{ padding: "0.32rem 0.75rem", color: reasonChanged ? "#059669" : "var(--text-secondary)", fontWeight: reasonChanged ? 700 : "normal", fontSize: "0.75rem" }}>
                              {finalReason || <span style={{ opacity: 0.35 }}>미작성</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* ── 집계 비교 섹션 (A+B 혼합) ── */
                <div>
                  <div style={{ padding: "0.65rem 1.2rem", borderBottom: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.02)", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    수익코드별 퇴원생 수 증감 — 행 클릭 시 사유 상세 펼치기
                  </div>
                  <table style={{ fontSize: "0.79rem", borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                      <tr style={{ background: "rgba(0,0,0,0.03)", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                        <th style={{ padding: "0.4rem 0.75rem", textAlign: "left", color: "var(--text-secondary)" }}>수익코드</th>
                        <th style={{ padding: "0.4rem 0.75rem", textAlign: "center", color: "#6b7280" }}>1차 인원</th>
                        <th style={{ padding: "0.4rem 0.75rem", textAlign: "center", color: "#059669" }}>최종 인원</th>
                        <th style={{ padding: "0.4rem 0.75rem", textAlign: "center", color: "var(--text-secondary)" }}>증감</th>
                        <th style={{ padding: "0.4rem 0.75rem", textAlign: "center", color: "#6b7280" }}>1차 기조실확정</th>
                        <th style={{ padding: "0.4rem 0.75rem", textAlign: "center", color: "#059669" }}>최종 기조실확정</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareResult.reportRows.map(row => {
                        const isExpanded = compareExpandedCodes.has(row.code);
                        const hasDelta = row.delta !== 0;
                        const reasons = Object.entries(row.reasonBreakdown);
                        return (
                          <>
                            <tr
                              key={row.code}
                              onClick={() => setCompareExpandedCodes(prev => {
                                const next = new Set(prev);
                                isExpanded ? next.delete(row.code) : next.add(row.code);
                                return next;
                              })}
                              style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", cursor: reasons.length > 0 ? "pointer" : "default", background: hasDelta ? "rgba(217,119,6,0.04)" : "transparent" }}
                            >
                              <td style={{ padding: "0.38rem 0.75rem", color: "#4f46e5", fontWeight: 700 }}>
                                {reasons.length > 0 ? (isExpanded ? "▼ " : "▶ ") : "   "}{row.code}
                              </td>
                              <td style={{ padding: "0.38rem 0.75rem", textAlign: "center", color: "#6b7280" }}>{row.firstTotal}명</td>
                              <td style={{ padding: "0.38rem 0.75rem", textAlign: "center", color: "#059669", fontWeight: 600 }}>{row.finalTotal}명</td>
                              <td style={{ padding: "0.38rem 0.75rem", textAlign: "center", fontWeight: 700, color: row.delta > 0 ? "#dc2626" : row.delta < 0 ? "#2563eb" : "var(--text-secondary)" }}>
                                {row.delta > 0 ? `▲ +${row.delta}` : row.delta < 0 ? `▼ ${row.delta}` : "—"}
                              </td>
                              <td style={{ padding: "0.38rem 0.75rem", textAlign: "center", color: "#6b7280" }}>{row.firstConfirmed}명</td>
                              <td style={{ padding: "0.38rem 0.75rem", textAlign: "center", color: "#059669", fontWeight: 600 }}>{row.finalConfirmed}명</td>
                            </tr>
                            {isExpanded && reasons.map(([reason, counts]) => {
                              const d = counts.final - counts.first;
                              return (
                                <tr key={row.code + reason} style={{ background: "rgba(79,70,229,0.04)", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                                  <td style={{ padding: "0.28rem 0.75rem 0.28rem 2rem", color: "var(--text-secondary)", fontSize: "0.76rem" }}>└ {reason}</td>
                                  <td style={{ padding: "0.28rem 0.75rem", textAlign: "center", color: "#6b7280", fontSize: "0.76rem" }}>{counts.first}명</td>
                                  <td style={{ padding: "0.28rem 0.75rem", textAlign: "center", color: "#059669", fontSize: "0.76rem" }}>{counts.final}명</td>
                                  <td style={{ padding: "0.28rem 0.75rem", textAlign: "center", fontSize: "0.76rem", color: d > 0 ? "#dc2626" : d < 0 ? "#2563eb" : "var(--text-secondary)", fontWeight: d !== 0 ? 700 : "normal" }}>
                                    {d > 0 ? `+${d}` : d < 0 ? `${d}` : "—"}
                                  </td>
                                  <td colSpan={2} />
                                </tr>
                              );
                            })}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

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

export default function EditorDashboard() {
  return (
    <Suspense fallback={null}>
      <EditorDashboardInner />
    </Suspense>
  );
}
