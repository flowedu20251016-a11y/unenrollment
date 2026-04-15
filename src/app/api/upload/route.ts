import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const BUCKET = process.env.SUPABASE_BUCKET || "UNENROLLMENT";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 메타데이터 추출 (클라이언트에서 전달)
    const code = (formData.get("code") as string || "unknown").replace(/[^a-zA-Z0-9]/g, "_");
    const studentName = (formData.get("studentName") as string || "unknown").replace(/[^a-zA-Z0-9가-힣]/g, "_");
    const month = (formData.get("month") as string || "unknown").replace(/[^a-zA-Z0-9가-힣-]/g, "_");

    // 파일 확장자 추출
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";

    // 폴더: 수익코드 / 파일명: 수익코드_학생명_년월_타임스탬프.확장자
    const fileName = `${code}/${code}_${studentName}_${month}_${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      console.error("Supabase Upload Error:", error);
      return NextResponse.json({ error: "파일 업로드 실패", detail: error.message }, { status: 500 });
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);

    return NextResponse.json({ webViewLink: data.publicUrl });
  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: "파일 업로드 실패", detail: error?.message || String(error) }, { status: 500 });
  }
}
