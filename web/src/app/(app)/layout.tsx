import { MobileTabBar, Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-[1440px] flex-1 animate-fade-in px-4 pb-24 pt-6 md:px-8 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}
