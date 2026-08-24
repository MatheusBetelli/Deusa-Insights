import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { AuthService } from "@/lib/auth";
import { useState } from "react";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    try {
      await AuthService.getProfile();
    } catch {
      throw redirect({
        to: "/login",
      });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("deusa_sidebar_collapsed") === "true";
    }
    return false;
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("deusa_sidebar_collapsed", String(next));
      }
      return next;
    });
  };

  const handleOpenMobile = () => setMobileOpen(true);
  const handleCloseMobile = () => setMobileOpen(false);

  return (
    <div className="flex h-screen bg-[#F5F7FA] text-[#0B1F33]">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={handleToggleSidebar}
        mobileOpen={mobileOpen}
        onMobileClose={handleCloseMobile}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onOpenMobile={handleOpenMobile} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-3 md:p-4 lg:p-5 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
