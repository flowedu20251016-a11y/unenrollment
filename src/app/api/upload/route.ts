import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_BUCKET || "UNENROLLMENT";

// 한글을 로마자로 변환하는 간단한 매핑 (초성 기준)
function sanitizePath(str: string): string {
  // 한글을 영문 변환 없이 완전히 제거하고 알파벳/숫자/하이픈만 남김
  return str
    .replace(/[가-힣]/g, "") // 한글 제거
    .replace(/[^a-zA-Z0-9\-]/g, "_") // 특수문자 → _
    .replace(/_+/g, "_") // 연속 _ 하나로
    .replace(/^_|_$/g, "") // 앞뒤 _ 제거
    || "unknown";
}

export async function POST(request: Request) {
  // 요청마다 클라이언트 생성 (env 변수 최신값 보장)
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!;
  const supabase = createClient(process.env.SUPABASE_URL!, supabaseKey);

  console.log("[Upload] KEY prefix:", supabaseKey?.slice(0, 20));
  console.log("[Upload] BUCKET:", BUCKET);

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const code = sanitizePath(formData.get("code") as string || "unknown");
    const studentName = sanitizePath(formData.get("studentName") as string || "unknown");
    const month = sanitizePath(formData.get("month") as string || "unknown");
    const ext = (file.name.includes(".") ? file.name.split(".").pop() : "bin") || "bin";

    const fileName = `${code}/${code}_${studentName}_${month}_${Date.now()}.${ext}`;
    console.log("[Upload] fileName:", fileName);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      console.error("[Upload] Supabase error:", JSON.stringify(error));
      return NextResponse.json({ error: "파일 업로드 실패", detail: error.message }, { status: 500 });
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return NextResponse.json({ webViewLink: data.publicUrl });

  } catch (error: any) {
    console.error("[Upload] Exception:", error);
    return NextResponse.json({ error: "파일 업로드 실패", detail: error?.message || String(error) }, { status: 500 });
  }
}
