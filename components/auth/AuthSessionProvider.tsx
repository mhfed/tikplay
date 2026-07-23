'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { authClient } from '@/lib/auth/client';

export type IdentityState =
  | 'resolving'
  | 'guest'
  | 'authenticated'
  | 'expired'
  | 'error';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

type AuthSessionValue = {
  state: IdentityState;
  user: SessionUser | null;
  generation: number;
  refresh: () => Promise<void>;
  expire: () => void;
  signOut: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionValue | null>(null);
const AUTH_CHANNEL = 'tikplay:auth:v1';

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const [generation, setGeneration] = useState(0);
  const [expired, setExpired] = useState(false);
  const previousUserId = useRef<string | null>(null);

  const user = session.data?.user
    ? {
        id: session.data.user.id,
        name: session.data.user.name,
        email: session.data.user.email,
        image: session.data.user.image,
      }
    : null;

  useEffect(() => {
    const nextId = user?.id ?? null;
    if (previousUserId.current !== nextId) {
      previousUserId.current = nextId;
      setGeneration((value) => value + 1);
      if (nextId) setExpired(false);
    }
  }, [user?.id]);

  const refresh = useCallback(async () => {
    await session.refetch();
  }, [session.refetch]);

  useEffect(() => {
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);

    const channel =
      typeof BroadcastChannel === 'undefined'
        ? null
        : new BroadcastChannel(AUTH_CHANNEL);
    if (channel) channel.onmessage = () => void refresh();

    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
      channel?.close();
    };
  }, [refresh]);

  const expire = useCallback(() => {
    if (user) {
      setExpired(true);
      setGeneration((value) => value + 1);
    }
  }, [user]);

  const signOut = useCallback(async () => {
    try {
      await authClient.signOut();
    } finally {
      setExpired(false);
      setGeneration((value) => value + 1);
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel(AUTH_CHANNEL);
        channel.postMessage('signed-out');
        channel.close();
      }
      await session.refetch();
    }
  }, [session.refetch]);

  let state: IdentityState = 'guest';
  if (session.isPending) state = 'resolving';
  else if (session.error) state = 'error';
  else if (expired) state = 'expired';
  else if (user) state = 'authenticated';

  const value = useMemo(
    () => ({ state, user, generation, refresh, expire, signOut }),
    [state, user, generation, refresh, expire, signOut],
  );

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export default AuthSessionProvider;

export function useAuthSession() {
  const value = useContext(AuthSessionContext);
  if (!value)
    throw new Error('useAuthSession must be used within AuthSessionProvider.');
  return value;
}
