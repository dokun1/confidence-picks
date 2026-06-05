import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  ChevronDownIcon,
  HomeIcon,
  InformationCircleIcon,
  MoonIcon,
  SunIcon,
  TrophyIcon,
  UserGroupIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import Avatar from '../Avatar';
import Button from '../Button';
// NARROW DESIGN-SYSTEM EXCEPTION: Navigation is the ONE design-system component
// permitted to import app contexts. useAuth (AuthContext) and useDarkMode
// (ThemeContext) are read here so the nav can reflect auth + theme state without
// prop-drilling. No other component in designsystem/ may import these.
// (The task spec names useTheme(); the ThemeContext actually exports useDarkMode —
// same { isDark, toggle } shape — so we bind to the real hook.)
import { useAuth } from '../../../contexts/AuthContext';
import { useDarkMode } from '../../../contexts/ThemeContext';

type IconComponent = typeof HomeIcon;

interface NavItem {
  label: string;
  href: string;
  icon: IconComponent;
  requiresAuth?: boolean;
}

interface UserMenuItem {
  label: string;
  icon: IconComponent;
  href?: string;
  action?: 'signOut';
}

export const BRAND_TEXT = 'Confidence Picks';

// Design System link intentionally omitted — still reachable via direct URL.
const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', icon: HomeIcon },
  { label: 'Groups', href: '/groups', icon: UserGroupIcon, requiresAuth: true },
  { label: 'About', href: '/about', icon: InformationCircleIcon },
];

const USER_MENU_ITEMS: UserMenuItem[] = [
  { label: 'Profile', href: '/profile', icon: UserIcon },
  { label: 'Sign Out', action: 'signOut', icon: ArrowRightOnRectangleIcon },
];

type LinkState = 'active' | 'inactive';

// Keyed records instead of inline ternaries — mirrors the variant/size pattern in Button.tsx.
const DESKTOP_LINK_CLASSES: Record<LinkState, string> = {
  active: 'text-primary-600 bg-primary-50 dark:text-primary-400 dark:bg-primary-900',
  inactive:
    'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50 dark:text-secondary-400 dark:hover:text-secondary-100 dark:hover:bg-secondary-800',
};

const MOBILE_LINK_CLASSES: Record<LinkState, string> = {
  active: 'text-primary-600 bg-primary-50 dark:text-primary-400 dark:bg-primary-900',
  inactive:
    'text-secondary-700 hover:text-secondary-900 hover:bg-secondary-50 dark:text-secondary-300 dark:hover:text-secondary-100 dark:hover:bg-secondary-700',
};

const ICON_BUTTON_CLASSES =
  'p-xs rounded-base text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 dark:text-secondary-400 dark:hover:text-secondary-100 dark:hover:bg-secondary-800 transition-colors duration-fast focus:outline-none focus:ring-1 focus:ring-primary-500';

const DESKTOP_LINK_BASE =
  'flex items-center px-xs py-xxxs rounded-base text-sm font-medium transition-colors duration-fast';

const MOBILE_LINK_BASE =
  'flex items-center w-full px-sm py-xs rounded-base text-left text-sm font-medium transition-colors duration-fast';

export interface NavigationProps {
  /** Show the theme-toggle control. Defaults to true. */
  showThemeToggle?: boolean;
}

function linkState(pathname: string, href: string): LinkState {
  // Mirror the deleted Svelte isActive(): exact match, or prefix match for non-root routes.
  const active = pathname === href || (href !== '/' && pathname.startsWith(href));
  return active ? 'active' : 'inactive';
}

/**
 * Navigation is the app's top bar: brand, route-highlighted links, theme toggle,
 * and either a user avatar menu (authenticated) or a Sign In CTA.
 *
 * It is the only design-system component permitted to consume router hooks
 * (useLocation/useNavigate) and app contexts (useAuth/useDarkMode). In tests,
 * wrap it in <MemoryRouter> plus the Auth/Theme providers.
 */
export default function Navigation({ showThemeToggle = true }: NavigationProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, clearAuth } = useAuth();
  const { isDark, toggle } = useDarkMode();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close the user dropdown on an outside click — mirrors the Svelte window click handler.
  useEffect(() => {
    if (!userMenuOpen) return;
    function handleOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [userMenuOpen]);

  const items = NAV_ITEMS.filter(item => isAuthenticated || !item.requiresAuth);

  function closeMenus() {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }

  function handleLogoClick() {
    closeMenus();
    navigate('/');
  }

  function handleUserMenuItem(item: UserMenuItem) {
    closeMenus();
    if (item.action === 'signOut') {
      // clearAuth resets context so the bar re-renders to the Sign In CTA.
      clearAuth();
      navigate('/');
    } else if (item.href) {
      navigate(item.href);
    }
  }

  return (
    <>
      <nav className="bg-neutral-0 dark:bg-secondary-900 border-b border-secondary-200 dark:border-secondary-700 transition-colors duration-fast">
        <div className="max-w-7xl mx-auto px-sm sm:px-md lg:px-lg">
          <div className="flex justify-between h-[4rem]">
            {/* Brand + mobile hamburger */}
            <div className="flex items-center">
              <button
                type="button"
                className={`md:hidden mr-xs ${ICON_BUTTON_CLASSES}`}
                onClick={() => setMobileMenuOpen(open => !open)}
                aria-label="Toggle mobile menu"
                aria-expanded={mobileMenuOpen}
              >
                <Bars3Icon className="w-[1.5rem] h-[1.5rem]" />
              </button>

              <button
                type="button"
                className="flex items-center focus:outline-none focus:ring-1 focus:ring-primary-500 rounded-base"
                onClick={handleLogoClick}
                aria-label={`${BRAND_TEXT} home`}
              >
                <div className="w-[2rem] h-[2rem] bg-primary-500 rounded-base mr-xs flex items-center justify-center">
                  <TrophyIcon className="w-[1.25rem] h-[1.25rem] text-neutral-0" />
                </div>
                <span className="text-xl font-heading font-bold text-secondary-900 dark:text-neutral-0">
                  {BRAND_TEXT}
                </span>
              </button>
            </div>

            {/* Desktop navigation */}
            <div className="hidden md:flex md:items-center md:space-x-lg">
              {items.map(item => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={closeMenus}
                    aria-current={linkState(pathname, item.href) === 'active' ? 'page' : undefined}
                    className={`${DESKTOP_LINK_BASE} ${DESKTOP_LINK_CLASSES[linkState(pathname, item.href)]}`}
                  >
                    <Icon className="w-[1rem] h-[1rem] mr-xs" />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* Right-side controls */}
            <div className="flex items-center space-x-xs">
              {showThemeToggle && (
                <button
                  type="button"
                  className={ICON_BUTTON_CLASSES}
                  onClick={toggle}
                  aria-label="Toggle theme"
                >
                  {isDark ? (
                    <SunIcon className="w-[1.25rem] h-[1.25rem]" />
                  ) : (
                    <MoonIcon className="w-[1.25rem] h-[1.25rem]" />
                  )}
                </button>
              )}

              {isAuthenticated && user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    className={`flex items-center ${ICON_BUTTON_CLASSES}`}
                    onClick={() => setUserMenuOpen(open => !open)}
                    aria-label="User menu"
                    aria-expanded={userMenuOpen}
                    aria-haspopup="menu"
                  >
                    <Avatar
                      name={user.name}
                      email={user.email}
                      pictureUrl={user.pictureUrl}
                      variant="md"
                      className="mr-xs"
                    />
                    <span className="hidden lg:block text-sm font-medium mr-xs">
                      {user.name || user.email}
                    </span>
                    <ChevronDownIcon
                      className={`w-[1rem] h-[1rem] transition-transform duration-fast ${userMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {userMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-xs w-[12rem] bg-neutral-0 dark:bg-secondary-800 rounded-md shadow-lg border border-secondary-200 dark:border-secondary-700 py-xs z-50"
                    >
                      {USER_MENU_ITEMS.map(item => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.label}
                            type="button"
                            role="menuitem"
                            className="flex items-center w-full px-sm py-xs text-left text-sm text-secondary-700 hover:text-secondary-900 hover:bg-secondary-50 dark:text-secondary-300 dark:hover:text-secondary-100 dark:hover:bg-secondary-700 transition-colors duration-fast"
                            onClick={() => handleUserMenuItem(item)}
                          >
                            <Icon className="w-[1rem] h-[1rem] mr-xs" />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <Button variant="primary" size="sm" onClick={() => navigate('/login')}>
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-secondary-900 bg-opacity-50 z-40 md:hidden"
          aria-hidden="true"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile slide-out sidebar */}
      <aside
        className={`fixed top-0 left-0 w-64 h-full bg-neutral-50 dark:bg-secondary-800 border-r border-secondary-200 dark:border-secondary-700 transform transition-transform duration-normal ease-in-out z-50 md:hidden pt-16 p-md ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Mobile navigation"
        aria-hidden={!mobileMenuOpen}
      >
        <button
          type="button"
          className={`absolute top-4 right-4 ${ICON_BUTTON_CLASSES}`}
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close menu"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        <div className="space-y-sm mt-sm">
          <h2 className="text-xs font-semibold tracking-wide uppercase text-secondary-500 dark:text-secondary-400">
            Menu
          </h2>
          <div className="space-y-xxs">
            {items.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={closeMenus}
                  aria-current={linkState(pathname, item.href) === 'active' ? 'page' : undefined}
                  className={`${MOBILE_LINK_BASE} ${MOBILE_LINK_CLASSES[linkState(pathname, item.href)]}`}
                >
                  <Icon className="w-[1rem] h-[1rem] mr-sm" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {showThemeToggle && (
          <div className="mt-lg pt-md border-t border-secondary-200 dark:border-secondary-700">
            <button
              type="button"
              className="flex items-center w-full px-sm py-xs rounded-base text-left text-sm font-medium text-secondary-700 hover:text-secondary-900 hover:bg-secondary-50 dark:text-secondary-300 dark:hover:text-secondary-100 dark:hover:bg-secondary-700 transition-colors duration-fast"
              onClick={toggle}
            >
              {isDark ? (
                <SunIcon className="w-[1rem] h-[1rem] mr-sm" />
              ) : (
                <MoonIcon className="w-[1rem] h-[1rem] mr-sm" />
              )}
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
