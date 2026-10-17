import AppLayout from "./components/layout/AppLayout";

/**
 * The renderer entry component.
 *
 * It used to be the whole shell; it is now a thin mount for `AppLayout`, kept as
 * the default export so `main.tsx` and the tests keep a single, stable entry
 * point while the regions behind it grow.
 */
export default function App() {
  return <AppLayout />;
}
