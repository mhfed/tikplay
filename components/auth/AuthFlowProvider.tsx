'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export type ProtectedIntent = {
  kind: 'favorite' | 'navigate' | 'custom';
  returnTo?: string;
  label: string;
  replay?: () => void | Promise<void>;
};

type AuthFlowValue = {
  isOpen: boolean;
  source: string;
  intent: ProtectedIntent | null;
  openAuth: (options?: { source?: string; intent?: ProtectedIntent }) => void;
  closeAuth: () => void;
  completeAuth: () => Promise<void>;
};

const AuthFlowContext = createContext<AuthFlowValue | null>(null);

function safeReturnTo(value?: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//'))
    return undefined;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : undefined;
  } catch {
    return undefined;
  }
}

export function AuthFlowProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [source, setSource] = useState('account');
  const [intent, setIntent] = useState<ProtectedIntent | null>(null);

  const openAuth = useCallback(
    (options?: { source?: string; intent?: ProtectedIntent }) => {
      setSource(options?.source ?? 'account');
      setIntent(
        options?.intent
          ? {
              ...options.intent,
              returnTo: safeReturnTo(options.intent.returnTo),
            }
          : null,
      );
      setOpen(true);
    },
    [],
  );

  const closeAuth = useCallback(() => {
    setOpen(false);
    setIntent(null);
  }, []);

  const completeAuth = useCallback(async () => {
    setOpen(false);
    const pending = intent;
    setIntent(null);
    if (pending?.replay) await pending.replay();
    else if (pending?.returnTo) window.location.assign(pending.returnTo);
  }, [intent]);

  const value = useMemo(
    () => ({ isOpen, source, intent, openAuth, closeAuth, completeAuth }),
    [isOpen, source, intent, openAuth, closeAuth, completeAuth],
  );

  return (
    <AuthFlowContext.Provider value={value}>
      {children}
    </AuthFlowContext.Provider>
  );
}

export function useAuthFlow() {
  const value = useContext(AuthFlowContext);
  if (!value)
    throw new Error('useAuthFlow must be used within AuthFlowProvider.');
  return value;
}
