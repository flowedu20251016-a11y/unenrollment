import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "퇴원율 분석 관리 시스템",
  description: "수익코드별 퇴원 지표 입력 및 관리시스템",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>❤️</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
