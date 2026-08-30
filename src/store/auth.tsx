import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { fetchProfile } from '@/lib/queries';
import type { Profile } from '@/lib/types';

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const defaultValue: AuthState = {
  loading: true,
  session: null,
  profile: null,
  refreshProfile: async () => {},
  signOut: async () => {},
};

const AuthContext = createContext<AuthState>(defaultValue);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadProfile = async (nextSession: Session, retries = 3) => {
      if (fetchedFor.current === nextSession.user.id) return;
      fetchedFor.current = nextSession.user.id;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const p = await fetchProfile(nextSession.user.id);
          if (!active) return;
          if (p) {
            setProfile(p);
            return;
          }
        } catch {
          /* transient error; retry below */
        }
        if (!active) return;
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
      if (active) setProfile(null);
    };

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) {
        fetchedFor.current = null;
        setProfile(null);
      } else {
        void loadProfile(nextSession);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      profile,
      refreshProfile: async () => {
        if (session) setProfile(await fetchProfile(session.user.id));
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setSession(null);
      },
    }),
    [loading, session, profile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
