import { NextResponse } from "next/server";
import { getSheetsInstance } from "@/lib/google";

export async function GET() {
  try {
    const sheets = getSheetsInstance();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const tabName = process.env.GOOGLE_SHEET_TAB_NAME;

    // A5:BZ 범위 호출
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}!A5:BZ`,
    });

    const rows = response.data.values || [];

    const records = rows.map((row, index) => {
      const rowIndex = index + 5;
      
      return {
        id: `row_${rowIndex}`,
        rowIndex,
        
        // --- 기본 정보 ---
        code: row[0] || "",
        department: row[1] || "",
        brand: row[2] || "",
        campus: row[3] || "",
        manager: row[4] || "",
        
        // --- 최종퇴원율 ---
        finalJaewon: row[5] || "",
        finalDropout: row[6] || "",
        finalRate: row[7] || "",
        finalBrandAvg: row[8] || "",
        
        // --- 목표퇴원율 ---
        targetRate: row[9] || "",
        
        // --- ACA 기초데이터 ---
        acaNew: row[10] || "",
        acaDropout: row[11] || "",
        acaHold: row[12] || "",
        acaJaewon: row[13] || "",
        acaJaewonEnd: row[14] || "",
        acaJaewonDiff: row[15] || "",
        
        // --- ACA 퇴원율 ---
        acaRealDropout: row[16] || "",
        acaRealRate: row[17] || "",
        acaBrandAvg: row[18] || "",
        
        // --- 경고/종강/이벤트 ---
        exWarn: row[19] || "",
        exEnd: row[20] || "",
        exEvent: row[21] || "",
        exTotal: row[22] || "",
        exRate: row[23] || "",

        // --- 사유 및 상태 (사용자 정의 열, Y열 이후로 매핑) ---
        editorReason: row[24] || "",
        adminReason: row[25] || "",
        status: row[26] || "pending",
        fileLink: row[27] || "",
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
