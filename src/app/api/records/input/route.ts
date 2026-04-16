import { NextResponse } from "next/server";
import { getSheetsInstance } from "@/lib/google";

export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tabName = searchParams.get('tab') || '최종';
    const sheets = getSheetsInstance();

    // 1+2+3. 사유분류 & 헤더 & 데이터 동시 호출 (병렬 처리 — 속도 개선)
    const [categoryResponse, headerResponse, dataResponse] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `사유분류!A2:C50` }),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${tabName}!A3:AZ3` }),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${tabName}!A4:AZ` }),
    ]);

    const categoryRows = categoryResponse.data.values || [];
    const categoryMap: Record<string, { label: string, requireProof: boolean }[]> = {};
    categoryRows.forEach(row => {
      const cat1 = row[0] || "";
      const cat2 = row[1] || "";
      const requireProof = (row[2] || "").includes("증빙필수");
      if (cat1 && cat2) {
        if (!categoryMap[cat1]) categoryMap[cat1] = [];
        categoryMap[cat1].push({ label: cat2, requireProof });
      }
    });

    const h = headerResponse.data.values?.[0] ?? [];

    // 💡 [개발자 가이드] 구글 시트의 열(Column)이 바뀌면 여기서 숫자를 조절하세요!
    // A열은 0, B열은 1, C열은 2, D열은 3 ... 이런 순서입니다.
    const headers = {
      colA: h[0] || "년월", // A열 (0)
      downloadDate: h[2] || "명단다운", // C열 (2)
      code: h[3] || "수익코드", // D열 (3)
      classType1: h[4] || "반형태1", // E열 (4)
      classType2: h[5] || "반형태2", // F열 (5)
      className: h[6] || "반명", // G열 (6)
      studentName: h[7] || "학생명", // H열 (7)
      startDate: h[8] || "시작일", // I열 (8)
      endDate: h[9] || "종료일", // J열 (9)
      school: h[10] || "학교명", // K열 (10)
      grade: h[11] || "학년", // L열 (11)
      reasonOriginal: h[13] || "사유(원문)", // N열 (13)
      studentId: h[16] || "학번", // Q열 (16)
      realDropDate: h[14] || "퇴원관리자", // O열 (14)
      lastAttend: h[20] || "마지막출석일", // U열 (20)

      // --- 📊 Q~U열 (매출/출석부재확인 등) ---
      colQ: h[16] || "Q열", // Q열 (16)
      colR: h[17] || "R열", // R열 (17)
      colS: h[18] || "S열", // S열 (18)
      colT: h[19] || "T열", // T열 (19)
      colU: h[20] || "U열", // U열 (20)

      // --- ✏️ 담당자 작성(입력) 영역 ---
      vReason1: h[22] || "퇴원사유(분류1)", // W열 (22)
      wReason2: h[23] || "퇴원종류(분류2)", // X열 (23)
      yDetail: h[24] || "상세내역(필요시작성)", // Y열 (24)
      xFileLink: h[25] || "증빙여부",           // Z열 (25)


      // --- 🔒 기조실(관리자) 작성 및 마감 확인 영역 ---
      zAdminReason1: h[26] || "사유(기조실)", // AA열 (26)
      aaAdminReason2: h[27] || "종류(기조실)", // AB열 (27)
      abAdminDetail: h[28] || "비고(기조실)", // AC열 (28)
      status: h[29] || "마감상태(AC열)", // AD열 (29) (임의로 배정. status값이 'closed'이면 마감으로 인식합니다)
    };

    // 데이터는 위 Promise.all에서 이미 받아왔으므로 재사용
    const rows = dataResponse.data.values || [];

    const records = rows.map((row, index) => {
      const rowIndex = index + 4; // A4부터 시작이므로 index 0은 row 4

      return {
        id: `row_${rowIndex}`,
        rowIndex,

        // 💡 [개발자 가이드] 위에서 맞춘 번호(0, 2, 3...)와 똑같이 맞춰서 데이터(row[번호])를 매핑해 줍니다.
        // 표시할 텍스트 영역 (읽기 전용)
        colA: row[0] || "", // A열: 년월 (월 필터로 쓰임)
        downloadDate: row[2] || "",
        code: row[3] || "", // 수익코드
        classType1: row[4] || "",
        classType2: row[5] || "",
        className: row[6] || "",
        studentName: row[7] || "",
        startDate: row[8] || "",
        endDate: row[9] || "",
        school: row[10] || "",
        grade: row[11] || "",
        reasonOriginal: row[13] || "", // N열
        studentId: row[16] || "",
        realDropDate: row[14] || "",
        lastAttend: row[20] || "", // U열

        // Q~U 열 (매출/출석부재확인 등)
        colQ: row[16] || "",
        colR: row[17] || "",
        colU: row[20] || "",

        // 입력 가능 조작 영역 (W: 22, X: 23, Y: 24, Z: 25)
        vReason1: row[22] || "",
        wReason2: row[23] || "",
        yDetail: row[24] || "",
        xFileLink: row[25] || "",

        // 기조실 (AA: 26, AB: 27, AB: 28)
        zAdminReason1: row[26] || "",
        aaAdminReason2: row[27] || "",
        abAdminDetail: row[28] || "",

        // 🔒 마감 여부 — AD열(29)에 'closed'가 있을 때만 잠금 (관리자가 명시적으로 마감해야 함)
        // trim + toLowerCase로 공백/대소문자 차이 허용
        // 이전 버그로 AC열(28)에 저장된 경우도 허용 (하위 호환)
        status: (row[29]?.trim().toLowerCase() === 'closed' || row[28]?.trim().toLowerCase() === 'closed') ? 'closed' : 'pending'
      };
    }).filter(r => r.code); // 수익코드가 있는 줄만

    return NextResponse.json({ categories: categoryMap, records, headers });
  } catch (error) {
    console.error("Sheet Fetch Error:", error);
    return NextResponse.json({ error: "Failed to fetch input data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { updates } = body;
    // updates: Array<{rowIndex: number, vReason1: string, wReason2: string, xFileLink: string, yDetail: string}>

    const sheets = getSheetsInstance();

    // 복수 행 업데이트를 위해 batchUpdate 사용
    let data = [];

    // 🔥 관리자가 넘겨준 '수정 (마감/해제)' 명령일 경우
    if (body.action === "admin_save") {
      data = updates.map((u: any) => ({
        range: `최종!AA${u.rowIndex}:AD${u.rowIndex}`,
        values: [[u.zAdminReason1 || "", u.aaAdminReason2 || "", u.abAdminDetail || "", u.status || ""]]
        // AA(26)=사유, AB(27)=종류, AC(28)=비고, AD(29)=마감상태
      }));
    } else {
      // 일반 담당자일 경우
      data = updates.map((u: any) => ({
        range: `최종!W${u.rowIndex}:Z${u.rowIndex}`,
        values: [[u.vReason1 || "", u.wReason2 || "", u.yDetail || "", u.xFileLink || ""]]
        // W=vReason1, X=wReason2, Y=yDetail(상세), Z=xFileLink(증빙)
      }));
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sheet Update Error:", error);
    return NextResponse.json({ error: "Failed to update insert data" }, { status: 500 });
  }
}
