import { NextResponse } from 'next/server';
import { getSheetsInstance } from "@/lib/google";

export async function POST(req: Request) {
  try {
    const { userid, password } = await req.json();

    if (!userid || !password) {
      return NextResponse.json({ success: false, message: '아이디와 비밀번호를 모두 입력해주세요.' }, { status: 400 });
    }

    const sheets = getSheetsInstance();
    
    // Q&A 및 입력용 시트 ID (동일한 시트 내에 권한부여 탭이 존재)
    const sheetId = process.env.GOOGLE_SHEET_INPUT_ID || '1tm22_10KEhSU9GHvdXCxw8dmMQWSno7GJbGO65aQNoc';
    const sheetTitle = '권한부여 ';

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${sheetTitle}'!A2:G`, // A열: 아이디, B: 비밀번호, C: 이름, D: 수익코드, E: 권한, F: 노션userid (2행부터 데이터)
    });

    const rows = response.data.values || [];
    
    // 유저 아이디와 패스워드가 정확히 매칭되는 행들 추출
    const matchedRows = rows.filter(row => row[0] === userid && row[1] === password);

    if (matchedRows.length === 0) {
      return NextResponse.json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    // 매칭된 사용자 정보 조립
    // 이름, 권한, 노션ID는 첫번째 매칭된 정보를 기준으로 사용하고, 수익코드는 누적(배열)
    const firstMatch = matchedRows[0];
    const userName = firstMatch[2] || '';
    const role = firstMatch[4] || 'user'; // 'admin' or 'user' 등
    const notionUserId = firstMatch[5] || '';
    
    // 아이디가 가진 모든 수익코드 추출 (빈 값 제외, 콤마 구분도 지원)
    const codesSet = new Set<string>();
    matchedRows.forEach(row => {
      if (row[3]) {
        // 콤마/슬래시/공백 등으로 여러 코드가 한 셀에 있는 경우도 분리
        String(row[3]).split(/[,\/\s]+/).forEach(code => {
          const trimmed = code.trim();
          if (trimmed) codesSet.add(trimmed);
        });
      }
    });
    
    const profitCodes = Array.from(codesSet);

    // 프론트엔드로 전달할 사용자 세션용 데이터
    const userData = {
      userid,
      userName,
      role,
      profitCodes,
      notionUserId
    };

    return NextResponse.json({ success: true, user: userData });

  } catch (error: any) {
    console.error('로그인 API 에러:', error);
    return NextResponse.json({ success: false, message: '로그인 처리 중 서버 에러가 발생했습니다.' }, { status: 500 });
  }
}
