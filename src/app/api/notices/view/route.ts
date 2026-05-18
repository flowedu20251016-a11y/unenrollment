import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;
  return createClient(process.env.SUPABASE_URL!, key);
}

// POST /api/notices/view  { id }  → view_count + 1
export async function POST(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    const supabase = getSupabase();
    const { error } = await supabase.rpc("increment_notice_view", { notice_id: id });
    if (error) {
      // RPC 없으면 수동 업데이트
      const { data: row } = await supabase.from("notices").select("view_count").eq("id", id).single();
      await supabase.from("notices").update({ view_count: (row?.view_count || 0) + 1 }).eq("id", id);
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
