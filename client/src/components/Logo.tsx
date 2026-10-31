import { Link } from 'react-router-dom';

export function Logo({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <Link
      to="/"
      className="group inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      aria-label="CivicEye AI home"
    >
      <span className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-navy-900 shadow-sm ring-1 ring-navy-800">
        <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden="true">
          <path
            d="M5 20c4.3-7 10-10.5 15-10.5S30.7 13 35 20c-4.3 7-10 10.5-15 10.5S9.3 27 5 20Z"
            fill="none"
            stroke="#5eead4"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="20" cy="20" r="5.5" fill="#14b8a6" />
          <circle cx="20" cy="20" r="2.1" fill="#071528" />
          <path d="M12 31.5h16" stroke="#5eead4" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
          <path d="M15.5 35h9" stroke="#5eead4" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
        </svg>
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={`text-[17px] font-bold tracking-tight ${dark ? 'text-white' : 'text-navy-900'}`}>
            CivicEye <span className="text-teal-500">AI</span>
          </span>
          <span
            className={`mt-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] ${
              dark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Civic accountability
          </span>
        </span>
      )}
    </Link>
  );
}
