import { NextResponse } from "next/server";
import { getSheetsInstance } from "@/lib/google";

const SHEET_ID = process.env.GOOGLE_SHEET_INPUT_ID || "1tm22_10KEhSU9GHvdXCxw8dmMQWSno7GJbGO65aQNoc";
const SHEET_TITLE = "권한부여 ";

export async function POST(req: Request) {
  try {
    const { userid, currentPassword, newPassword } = await req.json();

    if (!userid || !currentPassword || !newPassword) {
      return NextResponse.json({ success: false, message: "필수 항목이 누락되었습니다." }, { status: 400 });
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ success: false, message: "비밀번호는 4자 이상이어야 합니다." }, { status: 400 });
    }

    const sheets = getSheetsInstance();

    // 현재 권한부여 시트 전체 조회
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${SHEET_TITLE}'!A2:G`,
    });

    const rows = response.data.values || [];

    // 아이디 + 현재 비밀번호가 맞는 행 찾기
    const rowIndex = rows.findIndex(row => row[0] === userid && row[1] === currentPassword);

    if (rowIndex === -1) {
      return NextResponse.json({ success: false, message: "현재 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    // 실제 시트 행 번호 (A2부터 시작이므로 +2)
    const sheetRowNumber = rowIndex + 2;

    // B열(비밀번호)만 업데이트
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${SHEET_TITLE}'!B${sheetRowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[newPassword]] },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Change Password Error:", error);
    return NextResponse.json({ success: false, message: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
