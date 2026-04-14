import Link from "next/link";
import "./dashboard.css";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-wrapper">
      {/* 상단 네비게이션 */}
      <header className="dashboard-header glass-container">
        <div className="header-logo">
          <Link href="/">퇴원 <span>관리 시스템</span></Link>
        </div>
        <nav className="header-nav">
          <Link href="/login" className="logout-btn">로그아웃</Link>
        </nav>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <main className="dashboard-main animate-fade-in">
        {children}
      </main>
    </div>
  );
}
