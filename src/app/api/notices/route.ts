import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;
  return createClient(process.env.SUPABASE_URL!, key);
}

// GET /api/notices — 목록 조회
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const boardName = searchParams.get("boardName");
    const searchType = searchParams.get("searchType");
    const searchText = searchParams.get("searchText");

    const supabase = getSupabase();
    let query = supabase
      .from("notices")
      .select("*")
      .order("created_at", { ascending: false });

    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate + "T23:59:59");
    if (boardName && boardName !== "all") query = query.eq("board_name", boardName);
    if (searchText && searchType) {
      if (searchType === "title") query = query.ilike("title", `%${searchText}%`);
      else if (searchType === "author") query = query.ilike("author", `%${searchText}%`);
      else if (searchType === "content") query = query.ilike("content", `%${searchText}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ notices: data || [] });
  } catch (e: any) {
    console.error("[notices GET]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/notices — 작성 (admin only — 서버에서 역할 검사 없이 클라이언트 신뢰)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { boardName, title, content, author, hasAttachment, attachmentUrl, attachmentName } = body;
    if (!title || !content) {
      return NextResponse.json({ error: "제목과 내용은 필수입니다." }, { status: 400 });
    }
    const supabase = getSupabase();
    const { data, error } = await supabase.from("notices").insert([{
      board_name: boardName || "공지사항",
      title,
      content,
      author: author || "관리자",
      has_attachment: !!hasAttachment,
      attachment_url: attachmentUrl || null,
      attachment_name: attachmentName || null,
      view_count: 0,
    }]).select().single();
    if (error) throw error;
    return NextResponse.json({ notice: data });
  } catch (e: any) {
    console.error("[notices POST]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH /api/notices — 수정
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, boardName, title, content, hasAttachment, attachmentUrl, attachmentName } = body;
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    const supabase = getSupabase();
    const { data, error } = await supabase.from("notices").update({
      board_name: boardName,
      title,
      content,
      has_attachment: !!hasAttachment,
      attachment_url: attachmentUrl || null,
      attachment_name: attachmentName || null,
    }).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ notice: data });
  } catch (e: any) {
    console.error("[notices PATCH]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/notices?id=...
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    const supabase = getSupabase();
    const { error } = await supabase.from("notices").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[notices DELETE]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/notices/view — 조회수 증가
