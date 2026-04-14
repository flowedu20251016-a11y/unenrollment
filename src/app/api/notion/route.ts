import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { totalSavedCount, currentMonth, userName, profitCodes, notionUserId, type, message } = body;

    const notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });

    const databaseId = process.env.NOTION_DB_ID;
    if (!databaseId) throw new Error("NOTION_DB_ID is missing");

    const todayIso = new Date().toISOString(); // "2026-04-14T01:00:00.000Z" (발생일시 용도)
    const todayDateLocal = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    const codeString = Array.isArray(profitCodes) ? profitCodes.join(", ") : String(profitCodes || '');
    
    // 수익코드 파싱 (숫자 속성이므로 첫번째 숫자로 파싱해서 넣거나, 없으면 0)
    let primaryCode = 0;
    if (codeString) {
      const match = codeString.match(/\d+/);
      if (match) primaryCode = parseInt(match[0], 10);
    }

    let pageTitle = "";
    const childrenBlocks = [];
    
    // 🔥 관리자 지정 노션 고유 ID (알람 푸시용)
    const ADMIN_NOTION_ID = "294d872b-594c-816a-8c71-0002b4adfb76";

    // "수정 요청" 모드와 "일반 저장" 모드 로직 분리
    if (type === "request-edit") {
      pageTitle = `[수정요청] 기조실 관리자 확인 요망 (${codeString || '전체'})`;
      childrenBlocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: "🚨 [관리자 호출] 수정 권한 요청 알림 " },
              annotations: { bold: true, color: "red" }
            },
            // 🔥 진짜 관리자 멘션 (수신함에 핑을 쏩니다)
            {
              type: "mention",
              mention: { type: "user", user: { id: ADMIN_NOTION_ID } }
            },
            {
              type: "text",
              text: { content: `\n\n${userName} 님이 마감된 데이터에 대해 수정을 요청했습니다.\n확인 및 잠금 해제를 부탁드립니다.\n` }
            },
            {
              type: "text",
              text: { content: `\n[요청 메시지]: ${message || "없음"}\n[요청 일시]: ${todayDateLocal}` }
            }
          ]
        }
      });
    } else {
      pageTitle = `[알림] 퇴원사유 작성 완료 (${codeString || '전체'})`;
      
      const reporterTextBlocks = [];
      if (notionUserId) {
        reporterTextBlocks.push({ type: "mention", mention: { type: "user", user: { id: notionUserId } } });
        reporterTextBlocks.push({ type: "text", text: { content: ` (${userName}) 님이 ` } });
      } else {
        reporterTextBlocks.push({ type: "text", text: { content: `${userName || "사용자"} 님이 ` } });
      }

      childrenBlocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            ...reporterTextBlocks,
            { type: "text", text: { content: todayDateLocal }, annotations: { bold: true, color: "gray" } },
            { type: "text", text: { content: " 기준으로 " } },
            { type: "text", text: { content: `[${codeString}]` }, annotations: { bold: true, color: "purple" } },
            { type: "text", text: { content: " 수익코드에 대한 총 " } },
            { type: "text", text: { content: String(totalSavedCount || 0) }, annotations: { bold: true, color: "blue" } },
            { type: "text", text: { content: "건의 퇴원사유를 작성 및 저장했습니다." } }
          ],
        },
      });
      
      // 관리자 호출 핑 추가 블럭
      childrenBlocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: "🔔 기조실 확인 요망: " }
            },
            {
              type: "mention",
              mention: { type: "user", user: { id: ADMIN_NOTION_ID } }
            },
            {
              type: "text",
              text: { content: " 대시보드(스프레드시트)에서 확인해주세요." }
            }
          ]
        }
      });
    }

    // 새 페이지(Database entry) 생성 - 사용자 지시대로 속성 매핑!
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        "제목": {
          title: [
            { text: { content: pageTitle } }
          ],
        },
        "발생일시": {
          date: {
            start: todayIso
          }
        },
        "작성자": {
          rich_text: [
            { text: { content: userName || "알 수 없음" } }
          ]
        },
        "수익코드": {
          number: primaryCode
        }
      },
      children: childrenBlocks,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notion Error:", error);
    return NextResponse.json({ error: "Failed to send Notion notification" }, { status: 500 });
  }
}
