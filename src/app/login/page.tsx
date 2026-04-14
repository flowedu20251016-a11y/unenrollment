"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "./login.css";

export default function Login() {
  const router = useRouter();
  const [userid, setUserid] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userid, password }),
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        setError(data.message || "아이디 또는 비밀번호가 올바르지 않습니다.");
        return;
      }
      
      // 로그인 성공: 로컬스토리지에 저장
      localStorage.setItem("dropout_user", JSON.stringify(data.user));
      
      // 권한(role)에 따른 라우팅
      if (data.user.role === "admin") {
        router.push("/dashboard/admin");
      } else {
        router.push("/dashboard/editor");
      }
      
    } catch (err) {
      console.error("Login failed:", err);
      setError("로그인 처리 중 오류가 발생했습니다.");
    }
  };

  return (
    <main className="login-main animate-fade-in">
      <div className="glass-container login-container" style={{ maxWidth: "450px" }}>
        <div className="login-header">
          <div className="badge" style={{ marginBottom: "1.5rem", display: "inline-block" }}>플로우교육(주)</div>
          <h1 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>퇴원 <span style={{ color: "#a855f7" }}>관리 시스템</span></h1>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="userid">아이디</label>
            <input
              id="userid"
              type="text"
              className="input-field"
              value={userid}
              onChange={(e) => setUserid(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              className="input-field"

              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary login-btn">
            로그인
          </button>
        </form>

        <div className="login-footer">
          계정 발급은 관리자(기조실)에게 문의바랍니다.
        </div>
      </div>
    </main>
  );
}
