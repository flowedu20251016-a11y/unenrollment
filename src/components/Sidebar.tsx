"use client";

import { useState, useEffect, Suspense } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

const MENUS = [
  {
    id: "student",
    label: "퇴원생",
    icon: "🎓",
    subs: [
      {
        id: "student-first",
        label: "1차",
        adminHref: "/dashboard/admin?section=live",
        editorHref: "/dashboard/editor?section=input",
        adminSection: "live",
        editorSection: "input",
        fixedPath: null as string | null,
      },
      {
        id: "student-final",
        label: "최종",
        adminHref: "/dashboard/admin?section=accumulated",
        editorHref: "/dashboard/editor?section=input-final",
        adminSection: "accumulated",
        editorSection: "input-final",
        fixedPath: null as string | null,
      },
    ],
  },
  {
    id: "rate",
    label: "퇴원율",
    icon: "📊",
    subs: [
      {
        id: "rate-first",
        label: "1차",
        adminHref: "/dashboard/admin?section=report",
        editorHref: "/dashboard/editor?section=report",
        adminSection: "report",
        editorSection: "report",
        fixedPath: null as string | null,
      },
      {
        id: "rate-final",
        label: "최종",
        adminHref: "/dashboard/admin?section=closed",
        editorHref: "/dashboard/editor?section=report-final",
        adminSection: "closed",
        editorSection: "report-final",
        fixedPath: null as string | null,
      },
    ],
  },
  {
    id: "board",
    label: "게시판",
    icon: "📋",
    subs: [
      {
        id: "notice",
        label: "공지사항",
        adminHref: "/dashboard/notice",
        editorHref: "/dashboard/notice",
        adminSection: null as string | null,
        editorSection: null as string | null,
        fixedPath: "/dashboard/notice",
      },
      {
        id: "inquiry",
        label: "문의사항",
        adminHref: "/dashboard/inquiry",
        editorHref: "/dashboard/inquiry",
        adminSection: null as string | null,
        editorSection: null as string | null,
        fixedPath: "/dashboard/inquiry",
      },
    ],
  },
];

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = searchParams?.get("section") ?? null;
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    student: true,
    rate: true,
    board: false,
  });
  const [role, setRole] = useState<string>("editor");

  useEffect(() => {
    const sessionStr = typeof window !== "undefined" ? localStorage.getItem("dropout_user") : null;
    if (sessionStr) {
      try {
        const user = JSON.parse(sessionStr);
        setRole(user.role || "editor");
      } catch {
        // ignore
      }
    }
  }, []);

  const isActive = (sub: (typeof MENUS)[0]["subs"][0]): boolean => {
    // 게시판(fixed path) 항목
    if (sub.fixedPath) return pathname === sub.fixedPath;

    const isAdmin = role === "admin";
    const expectedPath = isAdmin ? "/dashboard/admin" : "/dashboard/editor";
    if (pathname !== expectedPath) return false;

    const expectedSection = isAdmin ? sub.adminSection : sub.editorSection;
    if (!expectedSection) return false;

    // section param 없을 때 기본값 처리
    if (!section) {
      if (isAdmin) return expectedSection === "report";
      return expectedSection === "input";
    }

    return section === expectedSection;
  };

  const getHref = (sub: (typeof MENUS)[0]["subs"][0]): string =>
    role === "admin" ? sub.adminHref : sub.editorHref;

  const toggleMenu = (id: string) => {
    if (collapsed) {
      setCollapsed(false);
      setOpenMenus(prev => ({ ...prev, [id]: true }));
      return;
    }
    setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      {/* 햄버거 토글 버튼 */}
      <div className="sidebar-toggle">
        <button
          className="sidebar-toggle-btn"
          onClick={() => setCollapsed(prev => !prev)}
          aria-label={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
        >
          ☰
        </button>
      </div>

      {/* 메뉴 목록 */}
      <nav className="sidebar-nav">
        {MENUS.map(menu => {
          const hasActive = menu.subs.some(isActive);
          const isOpen = openMenus[menu.id];

          return (
            <div key={menu.id} className="sidebar-menu-group">
              {/* 상위 메뉴 버튼 */}
              <button
                className={`sidebar-menu-btn${hasActive ? " has-active" : ""}`}
                data-tooltip={menu.label}
                onClick={() => toggleMenu(menu.id)}
              >
                <span className="sidebar-menu-icon">{menu.icon}</span>
                {!collapsed && (
                  <>
                    <span className="sidebar-menu-label">{menu.label}</span>
                    <span className={`sidebar-menu-arrow${isOpen ? " open" : ""}`}>▾</span>
                  </>
                )}
              </button>

              {/* 하위 메뉴 (accordion) */}
              {!collapsed && (
                <div className={`sidebar-submenu${isOpen ? " open" : ""}`}>
                  {menu.subs.map(sub => {
                    const active = isActive(sub);
                    const href = getHref(sub);
                    return (
                      <Link
                        key={sub.id}
                        href={href}
                        className={`sidebar-sub-item${active ? " active" : ""}`}
                      >
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

export default function Sidebar() {
  return (
    <Suspense
      fallback={
        <aside className="sidebar">
          <div className="sidebar-toggle">
            <button className="sidebar-toggle-btn">☰</button>
          </div>
        </aside>
      }
    >
      <SidebarContent />
    </Suspense>
  );
}
