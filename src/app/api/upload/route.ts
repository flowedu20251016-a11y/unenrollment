import { NextResponse } from "next/server";
import { getDriveInstance } from "@/lib/google";
import stream from "stream";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const drive = getDriveInstance();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!folderId) {
      throw new Error("GOOGLE_DRIVE_FOLDER_ID is not configured");
    }

    // 파일 데이터를 Buffer로 변환 후 Readable Stream으로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);

    const driveResponse = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [folderId],
      },
      media: {
        mimeType: file.type || "application/octet-stream",
        body: bufferStream,
      },
      fields: "id, webViewLink",
    });

    // 누구나 읽을 수 있도록 허용 (선택사항, 필요 없으면 생략)
    try {
      await drive.permissions.create({
        fileId: driveResponse.data.id!,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });
    } catch (permError) {
      console.error("Permission share error:", permError);
    }

    return NextResponse.json({ webViewLink: driveResponse.data.webViewLink });
  } catch (error) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: "Failed to upload file to Google Drive" }, { status: 500 });
  }
}
