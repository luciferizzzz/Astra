import Canvas from "../canvas/Canvas";
import CodeEditor from "../editor/CodeEditor";
import Inspector from "../panels/Inspector";
import Sidebar from "../panels/Sidebar";
import Header from "../toolbar/Header";
import StatusBar from "../ui/StatusBar";

/**
 * The application shell.
 *
 * One place that decides how the editor's regions are arranged: toolbar across
 * the top, a three-column work area (navigation · canvas · inspector), the code
 * editor beneath it, and the status bar along the bottom. Each region is its own
 * component, so a later phase can make one of them real without touching the
 * others.
 */
export default function AppLayout() {
  return (
    <div className="flex h-full w-full flex-col bg-surface-0 text-neutral-200">
      <Header />

      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <Canvas />
        <Inspector />
      </div>

      <CodeEditor />
      <StatusBar />
    </div>
  );
}
