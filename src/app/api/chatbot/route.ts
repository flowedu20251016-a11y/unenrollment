import { NextResponse } from "next/server";
import { getSheetsInstance } from "@/lib/google";

const SHEET_ID = '1tm22_10KEhSU9GHvdXCxw8dmMQWSno7GJbGO65aQNoc';

// Q&A 시트: A=대분류, B=중분류, C=소분류(상세내역)
async function fetchQARows(): Promise<string[][]> {
  const sheets = getSheetsInstance();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'Q&A'!A2:C`,
  });
  return (response.data.values || []) as string[][];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, category, subcategory } = body;

    const rows = await fetchQARows();

    // ── 대분류 목록 ──
    if (action === "menu") {
      const categories: string[] = [];
      for (const row of rows) {
        const a = (row[0] || "").trim();
        if (a && !categories.includes(a)) categories.push(a);
      }
      return NextResponse.json({ categories });
    }

    // ── 중분류 목록 (대분류 선택 후) ──
    if (action === "submenu" && category) {
      const items: string[] = [];
      for (const row of rows) {
        const a = (row[0] || "").trim();
        const b = (row[1] || "").trim();
        if (a === category && b && !items.includes(b)) items.push(b);
      }
      return NextResponse.json({ items });
    }

    // ── 소분류/상세내역 (중분류 선택 후) ──
    if (action === "detail" && category && subcategory) {
      for (const row of rows) {
        const a = (row[0] || "").trim();
        const b = (row[1] || "").trim();
        const c = (row[2] || "").trim();
        if (a === category && b === subcategory) {
          return NextResponse.json({ detail: c || "상세 내용이 없습니다." });
        }
      }
      return NextResponse.json({ detail: "해당 항목을 찾을 수 없습니다." });
    }

    // ── 키워드 검색 (Claude 없이 시트에서 직접 검색) ──
    if (action === "query") {
      const q = ((body.query as string) || "").trim().toLowerCase().replace(/\s/g, "");
      if (!q) return NextResponse.json({ results: [] });

      const results: { category: string; subcategory: string; detail: string }[] = [];
      for (const row of rows) {
        const a = (row[0] || "").trim();
        const b = (row[1] || "").trim();
        const c = (row[2] || "").trim();
        const combined = (a + b + c).toLowerCase().replace(/\s/g, "");
        if (combined.includes(q)) {
          results.push({ category: a, subcategory: b, detail: c });
        }
      }
      return NextResponse.json({ results });
    }

    return NextResponse.json({ error: "알 수 없는 요청입니다." }, { status: 400 });

  } catch (error) {
    console.error("Chatbot API Error:", error);
    return NextResponse.json({ error: "서버 연결 오류가 발생했습니다." }, { status: 500 });
  }
}
