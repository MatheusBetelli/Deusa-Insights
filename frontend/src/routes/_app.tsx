import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { AuthService } from "@/lib/auth";
import { useEffect } from "react";

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !AuthService.isAuthenticated()) {
      throw redirect({
        to: "/login",
      });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!AuthService.isAuthenticated()) {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  return (
    <div className="flex h-screen bg-[#F5F7FA] text-[#0B1F33]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
