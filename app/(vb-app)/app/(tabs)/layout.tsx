import { AppHeader } from "@/components/app/AppHeader";
import { TabBar } from "@/components/app/TabBar";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main id="main" className="mx-auto max-w-xl px-4 pb-32 pt-2">
        {children}
      </main>
      <TabBar />
    </>
  );
}
