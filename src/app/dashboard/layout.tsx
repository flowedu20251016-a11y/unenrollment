"use client";

import Link from "next/link";
import { useState } from "react";
import "./dashboard.css";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [showModal, setShowModal] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = async () => {
    setMsg(null);
    if (!currentPw || !newPw || !confirmPw) { setMsg({ text: "모든 항목을 입력해주세요.", ok: false }); return; }
    if (newPw !== confirmPw) { setMsg({ text: "새 비밀번호가 일치하지 않습니다.", ok: false }); return; }
    if (newPw.length < 4) { setMsg({ text: "비밀번호는 4자 이상이어야 합니다.", ok: false }); return; }

    const sessionStr = typeof window !== "undefined" ? localStorage.getItem("dropout_user") : null;
    const user = sessionStr ? JSON.parse(sessionStr) : null;
    if (!user?.userid) { setMsg({ text: "로그인 정보를 찾을 수 없습니다.", ok: false }); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userid: user.userid, currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ text: "비밀번호가 변경되었습니다!", ok: true });
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
        setTimeout(() => setShowModal(false), 1200);
      } else {
        setMsg({ text: data.message || "변경에 실패했습니다.", ok: false });
      }
    } catch {
      setMsg({ text: "서버 오류가 발생했습니다.", ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-wrapper">
      {/* 상단 네비게이션 */}
      <header className="dashboard-header glass-container">
        <div className="header-logo">
          <Link href="/"><span style={{ color: "#e53e3e", marginRight: "0.3rem" }}>♥</span>Flowedu<span></span></Link>
        </div>
        <nav className="header-nav" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={() => { setShowModal(true); setMsg(null); }}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              height: "36px", padding: "0 0.9rem", borderRadius: "8px",
              background: "#000", border: "none",
              color: "#fff", fontSize: "0.82rem", fontWeight: 700,
              fontFamily: '"DM Sans", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
              letterSpacing: "-0.03em", cursor: "pointer",
              transition: "opacity 0.15s", whiteSpace: "nowrap",
            }}
          >비밀번호 변경</button>
          <Link href="/login" style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "36px", height: "36px", borderRadius: "8px",
            background: "#000", border: "none",
            color: "#fff", fontSize: "1.1rem", textDecoration: "none",
            cursor: "pointer", transition: "opacity 0.15s",
          }} title="로그아웃">⏻</Link>
        </nav>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="dashboard-main animate-fade-in">{children}</main>

      {/* 비밀번호 변경 모달 */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
        }}>
          <div style={{
            background: "#faf8f4", border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: "14px", padding: "2rem", width: "320px", display: "flex", flexDirection: "column", gap: "1rem",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}>
            <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.1rem" }}>비밀번호 변경</h3>

            {[
              { label: "현재 비밀번호", val: currentPw, set: setCurrentPw },
              { label: "새 비밀번호", val: newPw, set: setNewPw },
              { label: "새 비밀번호 확인", val: confirmPw, set: setConfirmPw },
            ].map(({ label, val, set }) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <label style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{label}</label>
                <input
                  type="password" value={val} onChange={e => set(e.target.value)}
                  style={{
                    background: "#fff", border: "1px solid rgba(0,0,0,0.12)",
                    borderRadius: "6px", padding: "0.5rem 0.75rem", color: "var(--text-primary)",
                    fontSize: "0.9rem", outline: "none",
                  }}
                />
              </div>
            ))}

            {msg && (
              <p style={{ margin: 0, fontSize: "0.82rem", color: msg.ok ? "#34d399" : "#f87171" }}>{msg.text}</p>
            )}

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)}
                style={{ padding: "0.4rem 1rem", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.12)", background: "#fff", color: "var(--text-secondary)", cursor: "pointer" }}>
                취소
              </button>
              <button onClick={handleChange} disabled={loading}
                style={{ padding: "0.4rem 1rem", borderRadius: "6px", border: "none", background: "#6366f1", color: "#fff", cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "변경 중..." : "변경하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
