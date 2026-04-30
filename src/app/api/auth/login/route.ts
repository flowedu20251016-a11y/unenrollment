import { NextResponse } from 'next/server';
import { getSheetsInstance } from "@/lib/google";

export async function POST(req: Request) {
  try {
    const { userid, password } = await req.json();

    if (!userid || !password) {
      return NextResponse.json({ success: false, message: '아이디와 비밀번호를 모두 입력해주세요.' }, { status: 400 });
    }

    const sheets = getSheetsInstance();
    const sheetId = process.env.GOOGLE_SHEET_INPUT_ID || '1tm22_10KEhSU9GHvdXCxw8dmMQWSno7GJbGO65aQNoc';

    // 권한부여 시트 + 코드그룹 시트 병렬 로드
    const [authRes, groupRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'권한부여 '!A2:G`, // A:아이디, B:비번, C:이름, D:입력코드, E:권한, F:노션ID, G:보고서보기코드
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'코드그룹'!A2:B`, // A:그룹명, B:수익코드(콤마구분)
      }).catch(() => ({ data: { values: [] } })), // 시트 없으면 빈 배열
    ]);

    // 코드그룹 맵 구성: { "초등전체": ["E001","E002"], ... }
    const groupMap: Record<string, string[]> = {};
    (groupRes.data.values || []).forEach((row: string[]) => {
      const groupName = row[0]?.trim();
      if (!groupName) return;
      const codes = String(row[1] || '').split(/[,\/\s]+/).map(c => c.trim()).filter(Boolean);
      groupMap[groupName] = codes;
    });

    // 그룹명 또는 직접 코드 목록을 실제 코드 배열로 변환
    const resolveCodes = (raw: string): string[] => {
      const tokens = raw.split(/[,\/\s]+/).map(t => t.trim()).filter(Boolean);
      const result = new Set<string>();
      tokens.forEach(token => {
        if (groupMap[token]) {
          groupMap[token].forEach(c => result.add(c));
        } else {
          result.add(token);
        }
      });
      return Array.from(result);
    };

    const rows = authRes.data.values || [];
    const matchedRows = rows.filter((row: string[]) => row[0] === userid && row[1] === password);

    if (matchedRows.length === 0) {
      return NextResponse.json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    const firstMatch = matchedRows[0];
    const userName = firstMatch[2] || '';
    const role = firstMatch[4] || 'user';
    const notionUserId = firstMatch[5] || '';

    // D열: 입력 가능 수익코드 (기존 profitCodes)
    const inputCodesSet = new Set<string>();
    matchedRows.forEach((row: string[]) => {
      if (row[3]) resolveCodes(String(row[3])).forEach(c => inputCodesSet.add(c));
    });
    const profitCodes = Array.from(inputCodesSet);

    // G열: 보고서 보기 전용 수익코드 (없으면 빈 배열 → 보고서 탭 숨김)
    const reportCodesSet = new Set<string>();
    matchedRows.forEach((row: string[]) => {
      if (row[6]) resolveCodes(String(row[6])).forEach(c => reportCodesSet.add(c));
    });
    const reportCodes = Array.from(reportCodesSet);

    const userData = {
      userid,
      userName,
      role,
      profitCodes,   // 입력 가능 코드
      reportCodes,   // 보고서 보기 전용 코드
      notionUserId,
    };

    return NextResponse.json({ success: true, user: userData });

  } catch (error: any) {
    console.error('로그인 API 에러:', error);
    return NextResponse.json({ success: false, message: '로그인 처리 중 서버 에러가 발생했습니다.' }, { status: 500 });
  }
}
