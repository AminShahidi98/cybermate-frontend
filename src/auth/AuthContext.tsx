import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, login as requestTokens, setOnAuthLost, tokens } from "../api/client";
import type { User } from "../api/types";

interface AuthValue {
  user: User | null;
  /** Admin role, or a Django staff/superuser account (the backend treats both as admin). */
  isAdmin: boolean;
  /** Manager or admin: can review timesheets/leave and manage contracts. */
  isManager: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(Boolean(tokens.access));

  const logout = useCallback(() => {
    tokens.clear();
    setUser(null);
    setIsAdmin(false);
  }, []);

  const reloadUser = useCallback(async () => {
    const me = await api<User>("/users/me/");
    // A superuser made with `createsuperuser` has no roles but is still an admin on the
    // backend, and /users/me/ doesn't expose is_staff. So if the role list doesn't say
    // "admin", ask an admin-only endpoint whether we're allowed in.
    let admin = me.roles.some((role) => role.code === "admin");
    if (!admin) {
      try {
        await api("/roles/");
        admin = true;
      } catch {
        admin = false;
      }
    }
    setUser(me);
    setIsAdmin(admin);
  }, []);

  useEffect(() => {
    setOnAuthLost(logout);
    if (!tokens.access) return;
    reloadUser()
      .catch(logout)
      .finally(() => setLoading(false));
  }, [logout, reloadUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      await requestTokens(email, password);
      await reloadUser();
    },
    [reloadUser],
  );

  const value = useMemo<AuthValue>(
    () => ({
      user,
      isAdmin,
      isManager: isAdmin || Boolean(user?.roles.some((role) => role.code === "manager")),
      loading,
      login,
      logout,
      reloadUser,
    }),
    [user, isAdmin, loading, login, logout, reloadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

/** Same as useAuth, for pages that are only rendered once someone is logged in. */
export function useCurrentUser(): AuthValue & { user: User } {
  const auth = useAuth();
  if (!auth.user) throw new Error("No logged-in user");
  return auth as AuthValue & { user: User };
}
