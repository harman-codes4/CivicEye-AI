import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type DemoRole = 'citizen' | 'authority';

interface RoleContextValue {
  role: DemoRole;
  setRole: (role: DemoRole) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<DemoRole>(() =>
    localStorage.getItem('civiceye_role') === 'authority' ? 'authority' : 'citizen',
  );

  const setRole = useCallback((next: DemoRole) => {
    localStorage.setItem('civiceye_role', next);
    setRoleState(next);
  }, []);

  const value = useMemo(() => ({ role, setRole }), [role, setRole]);
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) throw new Error('useRole must be used inside RoleProvider');
  return context;
}
