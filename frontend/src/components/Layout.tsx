import { Outlet } from 'react-router-dom';
import Navigation from '../designsystem/components/Navigation';

// Shared chrome for every route: the design-system Navigation plus a <main>
// that renders the active page via <Outlet/>. Pages must NOT render Navigation
// themselves — this Layout is the single owner of that header.
export default function Layout() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="mx-auto w-full max-w-6xl px-md py-lg">
        <Outlet />
      </main>
    </div>
  );
}
