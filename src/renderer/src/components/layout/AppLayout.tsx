import { useEffect } from "react";
import Canvas from "../canvas/Canvas";
import CodeEditor from "../editor/CodeEditor";
import Inspector from "../panels/Inspector";
import Sidebar from "../panels/Sidebar";
import Header from "../toolbar/Header";
import SettingsDialog from "../ui/SettingsDialog";
import StatusBar from "../ui/StatusBar";
import { useAppStore } from "@/store/app-store";

/**
 * The application shell.
 *
 * One place that decides how the editor's regions are arranged: toolbar across
 * the top, a three-column work area (navigation · canvas · inspector), the code
 * editor beneath it, and the status bar along the bottom. Each region is its own
 * component, so a later phase can make one of them real without touching the
 * others.
 *
 * This is also where the shell meets the main process: settings are loaded once
 * on mount and the menu-command subscription lives for as long as the layout
 * does. Both are renderer concerns, which is why they are wired here rather than
 * in `main.tsx` — a test that renders `<App />` gets the same behaviour a real
 * window does.
 */
export default function AppLayout() {
  const panels = useAppStore((state) => state.panels);
  const settingsOpen = useAppStore((state) => state.settingsOpen);
  const hydrate = useAppStore((state) => state.hydrate);
  const subscribeToMenu = useAppStore((state) => state.subscribeToMenu);

  useEffect(() => {
    void hydrate();
    return subscribeToMenu();
  }, [hydrate, subscribeToMenu]);

  return (
    <div className="flex h-full w-full flex-col bg-surface-0 text-fg">
      <Header />

      <div className="flex min-h-0 flex-1">
        {panels.sidebar && <Sidebar />}
        <Canvas />
        {panels.inspector && <Inspector />}
      </div>

      {panels.editor && <CodeEditor />}
      <StatusBar />
      {settingsOpen && <SettingsDialog />}
    </div>
  );
}
