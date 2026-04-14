import { NextResponse } from "next/server";
import { getSheetsInstance } from "@/lib/google";

const SHEET_ID = '1tm22_10KEhSU9GHvdXCxw8dmMQWSno7GJbGO65aQNoc';

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    if (!query) {
      return NextResponse.json({ reply: "질문을 입력해주세요." });
    }

    const sheets = getSheetsInstance();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'Q&A'!A2:B`,
    });

    const rows = response.data.values || [];
    let matchedReply = "질문하신 내용과 일치하는 메뉴얼을 찾지 못했습니다. 구글 시트의 키워드를 다시 한 번 확인해 주세요.";

    // 고속 키워드 매칭 로직: 유저의 질문 문자열 중에 A열(키워드/질문) 이 포함되어 있는가?
    // 또는 A열 문자열 중에 유저 질문 텍스트 일부가 포함되어 있는가?
    for (const row of rows) {
      const keyword = row[0] || "";
      const answer = row[1] || "";
      if (!keyword || !answer) continue;

      // 띄어쓰기 무시 후 비교
      const cleanQuery = query.toLowerCase().replace(/\s/g, '');
      const cleanKeyword = keyword.toLowerCase().replace(/\s/g, '');

      if (cleanQuery.includes(cleanKeyword) || cleanKeyword.includes(cleanQuery)) {
        matchedReply = answer;
        break;
      }
    }

    return NextResponse.json({ reply: matchedReply });
  } catch (error) {
    console.error("Chatbot API Error:", error);
    return NextResponse.json({ reply: "서버 연결 오류로 인해 답변을 가져오지 못했습니다." });
  }
}
