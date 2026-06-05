import { Outlet } from 'react-router-dom';
import Navigation from '../designsystem/components/Navigation';

// Shared chrome for every route: the design-system Navigation plus a <main>
// that renders the active page via <Outlet/>. Pages must NOT render Navigation
// themselves — this Layout is the single owner of that header.
export default function Layout() {
  return (
    <div className="min-h-screen">
      <Navigation />
      {/* Mobile: no Layout-level horizontal padding so pages can use the full
          viewport width. Page shells already contribute a 12px (px-sm) gutter
          which is enough breathing room on a phone. Desktop (sm: and up)
          stacks the original 16px back on so margins still match design. */}
      <main className="mx-auto w-full max-w-6xl px-0 sm:px-md py-lg">
        <Outlet />
      </main>
    </div>
  );
}
