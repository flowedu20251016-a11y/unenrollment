"use client";

export default function InquiryPage() {
  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>💬 문의사항</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginTop: "0.4rem" }}>
          궁금한 사항을 문의하세요.
        </p>
      </div>
      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: "10px",
          padding: "3rem 2rem",
          textAlign: "center",
          color: "#999",
          fontSize: "0.9rem",
        }}
      >
        문의사항 기능이 준비 중입니다.
      </div>
    </div>
  );
}
