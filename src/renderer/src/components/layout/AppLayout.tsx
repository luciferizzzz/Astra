import { useEffect } from "react";
import Canvas from "../canvas/Canvas";
import CodeEditor from "../editor/CodeEditor";
import Inspector from "../panels/Inspector";
import Sidebar from "../panels/Sidebar";
import Header from "../toolbar/Header";
import SettingsDialog from "../ui/SettingsDialog";
import StatusBar from "../ui/StatusBar";
import { useAppStore } from "@/store/app-store";
import { bindProjectCommands, useProjectStore } from "@/store/project-store";

/**
 * The application shell.
 *
 * One place that decides how the editor's regions are arranged: toolbar across
 * the top, a three-column work area (navigation · canvas · inspector), the code
 * editor beneath it, and the status bar along the bottom. Each region is its own
 * component, so a later phase can make one of them real without touching the
 * others.
 *
 * This is also where the shell meets the main process: settings and project state
 * are loaded once on mount, the menu-command subscription lives for as long as the
 * layout does, and menu commands are routed to the store that owns them.
 */
export default function AppLayout() {
  const panels = useAppStore((state) => state.panels);
  const settingsOpen = useAppStore((state) => state.settingsOpen);
  const hydrateApp = useAppStore((state) => state.hydrate);
  const subscribeToMenu = useAppStore((state) => state.subscribeToMenu);
  const appState = useAppStore((state) => state);
  const projectState = useProjectStore((state) => state);
  const hydrateProject = useProjectStore((state) => state.hydrate);
  const subscribeToFs = useProjectStore((state) => state.subscribeToFs);

  useEffect(() => {
    bindProjectCommands(appState, projectState);
    // bind once per mount; stores are module singletons
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void hydrateApp();
    void hydrateProject();
    const unsubscribeMenu = subscribeToMenu();
    const unsubscribeFs = subscribeToFs();
    return () => {
      unsubscribeMenu();
      unsubscribeFs();
    };
  }, [hydrateApp, hydrateProject, subscribeToMenu, subscribeToFs]);

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
