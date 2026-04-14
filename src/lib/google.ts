import { google } from "googleapis";

// Next.js 환경에서 프라이빗 키 줄바꿈 문자(\n) 복원 처리
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: privateKey,
  },
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
  ],
});

export const getSheetsInstance = () => {
  return google.sheets({ version: "v4", auth });
};

export const getDriveInstance = () => {
  return google.drive({ version: "v3", auth });
};
