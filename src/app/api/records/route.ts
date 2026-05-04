import { NextResponse } from "next/server";
import { getSheetsInstance } from "@/lib/google";

export const dynamic = 'force-dynamic';

// 날짜값 → "YYYY-MM" 형식으로 정규화
// 구글 시트에서 날짜 셀이 "2026-04-01", "2026/04/01", "2026년 4월 1일" 등으로 올 수 있음
function normalizeMonth(val: string): string {
  if (!val) return "";
  // 이미 YYYY-MM 형식이면 그대로
  if (/^\d{4}-\d{2}$/.test(val.trim())) return val.trim();
  // YYYY-MM-DD 또는 YYYY/MM/DD
  const dmatch = val.match(/^(\d{4})[-\/](\d{2})/);
  if (dmatch) return `${dmatch[1]}-${dmatch[2]}`;
  // "YYYY년 M월" 형식
  const kmatch = val.match(/(\d{4})년\s*(\d{1,2})월/);
  if (kmatch) return `${kmatch[1]}-${String(kmatch[2]).padStart(2, "0")}`;
  // 파싱 불가 시 원본 반환
  return val.trim();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sheets = getSheetsInstance();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const tabName = searchParams.get('tab') || process.env.GOOGLE_SHEET_TAB_NAME;

    // 💡 데이터 시작 행 설정 (헤더 행 수에 따라 조정)
    // 예: 헤더 1행이면 A2, 헤더 4행이면 A5
    const DATA_START_ROW = 2;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}!A${DATA_START_ROW}:BZ`,
    });

    const rows = response.data.values || [];
    // 🔍 디버그: 첫 2행 원본값 확인 (확인 후 제거 가능)
    console.log("[보고서 시트 원본]", tabName, "첫행:", rows[0]?.slice(0, 5));

    const records = rows.map((row, index) => {
      const rowIndex = index + DATA_START_ROW;

      return {
        id: `row_${rowIndex}`,
        rowIndex,

        // 💡 [컬럼 가이드] A=0, B=1, C=2 ... 순서입니다.
        // A: 연월, B: 수익코드, C: 사업부, D: 브랜드, E: 캠퍼스, F: 작성자
        // G: 재원(15일), H: 최종퇴원, I: 최종퇴원율(%), J: 브랜드평균(%), K: 목표퇴원율
        // L: aca재원(말일), M: aca신규, N: aca퇴원, O: aca퇴원율(%), P: aca브랜드평균
        // Q: 경고, R: 종강, S: 이벤트, T: 합계, U: 퇴원제외율(%), V: aca재원(15일), W: 재원제외

        // --- 기본 정보 ---
        month: normalizeMonth(row[0] || ""),  // A: 연월 → YYYY-MM 정규화
        code: row[1] || "",         // B: 수익코드
        department: row[2] || "",   // C: 사업부
        brand: row[3] || "",        // D: 브랜드
        campus: row[4] || "",       // E: 캠퍼스
        manager: row[5] || "",      // F: 작성자

        // --- 최종퇴원율 ---
        finalJaewon: row[6] || "",   // G: 재원(15일)
        finalDropout: row[7] || "",  // H: 최종퇴원
        finalRate: row[8] || "",     // I: 최종퇴원율(%)
        finalBrandAvg: row[9] || "", // J: 브랜드평균(%)

        // --- 목표퇴원율 ---
        targetRate: row[10] || "",   // K: 목표퇴원율

        // --- ACA 기초데이터 ---
        acaJaewonEnd: row[11] || "", // L: aca 재원(말일)
        acaNew: row[12] || "",       // M: aca 신규
        acaDropout: row[13] || "",   // N: aca 퇴원
        acaHold: "",                 // (미사용)
        acaJaewon: row[21] || "",    // V: aca 재원(15일)
        acaJaewonDiff: row[22] || "",// W: 재원제외

        // --- ACA 퇴원율 ---
        acaRealDropout: "",          // (미사용)
        acaRealRate: row[14] || "",  // O: aca 퇴원율(%)
        acaBrandAvg: row[15] || "",  // P: aca 브랜드 평균

        // --- 경고/종강/이벤트 ---
        exWarn: row[16] || "",   // Q: 경고
        exEnd: row[17] || "",    // R: 종강
        exEvent: row[18] || "",  // S: 이벤트
        exTotal: row[19] || "",  // T: 합계
        exRate: row[20] || "",   // U: 퇴원제외율(%)

        status: "pending",
      };
    }).filter(record => record.code && record.code !== "#N/A" && record.code.trim() !== "");

    return NextResponse.json({ records });
  } catch (error) {
    console.error("Sheet Fetch Error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, rowIndex, editorReason, adminReason, status, fileLink } = body;
    const sheets = getSheetsInstance();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const tabName = process.env.GOOGLE_SHEET_TAB_NAME;

    // Y, Z, AA, AB 열 (index 24~27) 업데이트 보장
    const range = `${tabName}!Y${rowIndex}:AB${rowIndex}`;
    
    // 사업부 작성, 기조실 작성 구분하여 업데이트
    const values = [[
      editorReason || "",
      adminReason || "",
      status || "pending",
      fileLink || ""
    ]];

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sheet Update Error:", error);
    return NextResponse.json({ error: "Failed to update data" }, { status: 500 });
  }
}
