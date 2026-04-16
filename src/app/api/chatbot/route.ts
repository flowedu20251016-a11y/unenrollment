import { NextResponse } from "next/server";
import { getSheetsInstance } from "@/lib/google";

const SHEET_ID = '1tm22_10KEhSU9GHvdXCxw8dmMQWSno7GJbGO65aQNoc';

/**
 * Q&A 시트 구조 (A~D열, 2행부터):
 *
 * [트리 메뉴 방식]
 *   A열: 카테고리(메인키워드) — e.g. "이벤트"
 *   B열: 번호              — e.g. "1", "2", "3"  (숫자 문자열)
 *   C열: 서브제목           — e.g. "이벤트 기간 기준"
 *   D열: 상세답변           — 실제 답변 내용
 *
 * [기존 키워드 검색 방식] (B열이 숫자가 아닌 경우)
 *   A열: 키워드/질문
 *   B열: 답변
 */
async function fetchQARows() {
  const sheets = getSheetsInstance();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'Q&A'!A2:D`,
  });
  return response.data.values || [];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, keyword, subNo, query } = body;

    const rows = await fetchQARows();

    // ── action: "menu" ─ 메인 카테고리 목록 반환 ──
    if (action === "menu") {
      const categories: string[] = [];
      for (const row of rows) {
        const cat = (row[0] || "").trim();
        const b   = (row[1] || "").trim();
        // B열이 숫자이면 트리 아이템 → 카테고리 추출
        if (cat && /^\d+$/.test(b)) {
          if (!categories.includes(cat)) categories.push(cat);
        }
      }
      return NextResponse.json({ categories });
    }

    // ── action: "submenu" ─ 특정 카테고리의 서브 항목 목록 반환 ──
    if (action === "submenu" && keyword) {
      const items: { no: string; title: string }[] = [];
      for (const row of rows) {
        const cat   = (row[0] || "").trim();
        const no    = (row[1] || "").trim();
        const title = (row[2] || "").trim();
        if (cat === keyword && /^\d+$/.test(no)) {
          items.push({ no, title });
        }
      }
      // 번호 순 정렬
      items.sort((a, b) => parseInt(a.no) - parseInt(b.no));
      return NextResponse.json({ items });
    }

    // ── action: "detail" ─ 특정 카테고리 + 번호의 상세 답변 반환 ──
    if (action === "detail" && keyword && subNo) {
      for (const row of rows) {
        const cat    = (row[0] || "").trim();
        const no     = (row[1] || "").trim();
        const title  = (row[2] || "").trim();
        const answer = (row[3] || "").trim();
        if (cat === keyword && no === String(subNo)) {
          return NextResponse.json({ title, answer });
        }
      }
      return NextResponse.json({ title: "", answer: "해당 항목의 답변을 찾을 수 없습니다." });
    }

    // ── action: "query" 또는 기본 ─ 기존 키워드 텍스트 검색 ──
    const q = (query || "").trim();
    if (!q) {
      return NextResponse.json({ reply: "질문을 입력해주세요." });
    }

    const cleanQuery = q.toLowerCase().replace(/\s/g, '');
    let matchedReply = "질문하신 내용과 일치하는 매뉴얼을 찾지 못했습니다. 키워드를 다시 확인해 주세요.";

    for (const row of rows) {
      const aCol = (row[0] || "").trim();
      const bCol = (row[1] || "").trim();

      // 트리 아이템(B열이 숫자)이면 텍스트 검색에서 제외
      if (/^\d+$/.test(bCol)) continue;

      // 기존 방식: A=키워드, B=답변
      if (!aCol || !bCol) continue;
      const cleanKeyword = aCol.toLowerCase().replace(/\s/g, '');

      if (cleanQuery.includes(cleanKeyword) || cleanKeyword.includes(cleanQuery)) {
        matchedReply = bCol;
        break;
      }
    }

    return NextResponse.json({ reply: matchedReply });

  } catch (error) {
    console.error("Chatbot API Error:", error);
    return NextResponse.json({ reply: "서버 연결 오류로 인해 답변을 가져오지 못했습니다." });
  }
}
