import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  ClipboardList,
  Eye,
  FilePlus2,
  Home,
  Menu,
  Search,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { Logo } from './Logo';
import { useRole } from '../context/RoleContext';
import { cls } from '../lib/utils';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/dashboard', label: 'Browse issues', icon: ClipboardList },
  { to: '/report', label: 'Report issue', icon: FilePlus2 },
  { to: '/track', label: 'Track complaint', icon: Search },
  { to: '/authority', label: 'Authority queue', icon: ShieldCheck },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { role, setRole } = useRole();

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  const switchRole = (next: 'citizen' | 'authority') => {
    setRole(next);
    navigate(next === 'authority' ? '/authority' : '/dashboard');
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f7fb]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[1300] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-navy-900 focus:shadow-lift"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-[900] border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Primary">
              {NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cls(
                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                        isActive
                          ? 'bg-navy-50 text-navy-900'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-navy-900',
                      )
                    }
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <div className="flex items-center rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Demo role switch">
              <button
                type="button"
                onClick={() => switchRole('citizen')}
                aria-pressed={role === 'citizen'}
                className={cls(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition',
                  role === 'citizen' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-800',
                )}
              >
                <User className="h-3.5 w-3.5" /> Citizen
              </button>
              <button
                type="button"
                onClick={() => switchRole('authority')}
                aria-pressed={role === 'authority'}
                className={cls(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition',
                  role === 'authority' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-800',
                )}
              >
                <Building2 className="h-3.5 w-3.5" /> Authority
              </button>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
              Demo role
            </span>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-navy-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 xl:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div id="mobile-menu" className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 xl:hidden">
            <nav className="grid gap-1" aria-label="Mobile">
              {NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cls(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold',
                        isActive ? 'bg-navy-50 text-navy-900' : 'text-slate-600 hover:bg-slate-50',
                      )
                    }
                  >
                    <Icon className="h-4 w-4" /> {item.label}
                  </NavLink>
                );
              })}
            </nav>
            <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Demo role</span>
              <button
                type="button"
                onClick={() => switchRole('citizen')}
                className={cls(
                  'rounded-md px-2.5 py-1.5 text-xs font-semibold',
                  role === 'citizen' ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-600',
                )}
              >
                Citizen
              </button>
              <button
                type="button"
                onClick={() => switchRole('authority')}
                className={cls(
                  'rounded-md px-2.5 py-1.5 text-xs font-semibold',
                  role === 'authority' ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-600',
                )}
              >
                Authority
              </button>
            </div>
          </div>
        )}
      </header>

      <main id="main-content" className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-md">
              <Logo />
              <p className="mt-3 text-xs leading-5 text-slate-500">
                A GRAVITON 2026 hackathon prototype. Priority scores and duplicate matches are
                transparent rule-based suggestions — not proof of fraud, safety, or repair quality.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-xs sm:grid-cols-3">
              <Link to="/report" className="text-slate-600 hover:text-teal-700">Report an issue</Link>
              <Link to="/track" className="text-slate-600 hover:text-teal-700">Track a complaint</Link>
              <Link to="/dashboard" className="text-slate-600 hover:text-teal-700">Browse issues</Link>
              <Link to="/authority" className="text-slate-600 hover:text-teal-700">Authority queue</Link>
              <Link to="/analytics" className="text-slate-600 hover:text-teal-700">Analytics</Link>
              <span className="inline-flex items-center gap-1 text-slate-400">
                <Eye className="h-3 w-3" /> Evidence-aware
              </span>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-[11px] text-slate-400">
            <span>© {new Date().getFullYear()} CivicEye AI · Hackathon build</span>
            <span>SQLite demo persistence · No AI photo detection</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
