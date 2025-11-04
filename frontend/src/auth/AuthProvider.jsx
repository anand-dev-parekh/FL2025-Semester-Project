import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { exchangeGoogleIdToken, currentUser, logout as apiLogout } from "../api/auth";
import { http } from "../api/http";
import { AuthContext } from "./AuthContext";
import { useTheme } from "../theme/useTheme";

const SUPPORTED_THEMES = new Set(["light", "dark", "system"]);

const normalizeThemePreference = (value) => {
    if (typeof value !== "string") {
        return "system";
    }
    const lowered = value.toLowerCase();
    return SUPPORTED_THEMES.has(lowered) ? lowered : "system";
};

const themeSyncStorageKey = (userId) => `theme-sync:${userId}`;

const hasStoredThemePreference = (value) =>
    typeof value === "string" && SUPPORTED_THEMES.has(value.toLowerCase());

const readThemeSyncFlag = (userId) => {
    if (typeof window === "undefined" || !userId) return false;
    return window.localStorage.getItem(themeSyncStorageKey(userId)) === "1";
};

const markThemeSynced = (userId) => {
    if (typeof window === "undefined" || !userId) return;
    window.localStorage.setItem(themeSyncStorageKey(userId), "1");
};

// Overall file to manage authentication and user state for webapp using react context
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [initializing, setInitializing] = useState(true);
    const [loginReady, setLoginReady] = useState(false);
    const [userThemeSynced, setUserThemeSynced] = useState(false);
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const { preference: themePreference, setPreference: setThemePreference } = useTheme();
    const lastAppliedUserTheme = useRef(null);
    const syncingTheme = useRef(false);
    const skipInitialThemeSync = useRef(false);
    const themeAtLogin = useRef("system");

    // On app load, try to fetch current user using cookie
    useEffect(() => {
        (async () => {
            try {
                const thisUser = await currentUser();
                setUser(thisUser);
            } catch {
                setUser(null);
            } finally {
                setInitializing(false);
            }
        })();
    }, []);

    // Initialize GIS after script loads
    useEffect(() => {
        function init() {
            if (!window.google?.accounts?.id) return;
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: async ({ credential }) => {
                    try {
                        await exchangeGoogleIdToken(credential); // sets cookie
                        const thisUser = await currentUser();
                        setUser(thisUser);
                    } catch (e) {
                        console.error('Auth error:', e);
                        setUser(null);
                    }
                },
                auto_select: false, // Add here
                cancel_on_tap_outside: false, // Optional: prevents closing on outside click
                // GIS will POST the token to this URL instead of postMessage
                login_uri: 'http://localhost:5000/api/auth/google',
                // Optional: mitigate 3rd-party cookie issues
                itp_support: true,
            });
            setLoginReady(true);
        }


        if (document.readyState === 'complete') init();
        else window.addEventListener('load', init, { once: true });


        return () => window.google?.accounts?.id?.cancel?.();
    }, [clientId]);

    const renderGoogleButton = useCallback(
        (el, options = {}) => {
            if (!loginReady || !window.google?.accounts?.id || !el) return;
            window.google.accounts.id.renderButton(el, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                shape: 'pill',
                text: 'signin_with',
                logo_alignment: 'left',
                width: '350',
                ...options,
            });
        },
        [loginReady],
    );

    const logout = useCallback(async () => {
        try {
            await apiLogout();
        } catch (err) {
            console.error('Logout failed:', err);
        }
        setUser(null);
        window.google?.accounts?.id?.disableAutoSelect?.();
    }, [setUser]);

    const refreshUser = useCallback(async () => {
        try {
            const latest = await currentUser();
            setUser(latest);
            return latest;
        } catch (err) {
            setUser(null);
            throw err;
        }
    }, [setUser]);

    const value = useMemo(
        () => ({ user, loginReady, initializing, renderGoogleButton, logout, refreshUser, setUser }),
        [user, loginReady, initializing, renderGoogleButton, logout, refreshUser, setUser]
    );

    const rawUserThemePreference = user?.theme_preference;
    const normalizedUserThemePreference = normalizeThemePreference(rawUserThemePreference);
    const userHasStoredThemePreference = (() => {
        if (!hasStoredThemePreference(rawUserThemePreference)) {
            return false;
        }
        if (normalizedUserThemePreference === "system") {
            return userThemeSynced;
        }
        return true;
    })();

    useEffect(() => {
        if (!user?.id) {
            setUserThemeSynced(false);
            return;
        }
        setUserThemeSynced(readThemeSyncFlag(user.id));
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) {
            lastAppliedUserTheme.current = null;
            skipInitialThemeSync.current = false;
            themeAtLogin.current = "system";
            return;
        }
        const signature = `${user.id}:${userHasStoredThemePreference ? normalizedUserThemePreference : "unset"}`;
        if (lastAppliedUserTheme.current === signature) {
            return;
        }
        lastAppliedUserTheme.current = signature;

        if (!userHasStoredThemePreference) {
            themeAtLogin.current = normalizeThemePreference(themePreference);
            skipInitialThemeSync.current = true;
            return;
        }

        skipInitialThemeSync.current = false;
        const normalizedThemePreference = normalizeThemePreference(themePreference);
        if (normalizedThemePreference !== normalizedUserThemePreference) {
            setThemePreference(normalizedUserThemePreference);
        }
    }, [
        user,
        themePreference,
        normalizedUserThemePreference,
        userHasStoredThemePreference,
        setThemePreference,
    ]);

    useEffect(() => {
        if (!user?.id) return;
        const normalizedPreference = normalizeThemePreference(themePreference);
        if (userHasStoredThemePreference && normalizedPreference === normalizedUserThemePreference) {
            return;
        }
        if (syncingTheme.current) {
            return;
        }

        if (!userHasStoredThemePreference && skipInitialThemeSync.current) {
            const normalizedLoginPreference = normalizeThemePreference(themeAtLogin.current);
            if (normalizedPreference === normalizedLoginPreference) {
                return;
            }
            skipInitialThemeSync.current = false;
        }

        syncingTheme.current = true;
        let cancelled = false;
        (async () => {
            try {
                const updated = await http("/api/user/me", {
                    method: "PATCH",
                    body: { theme_preference: normalizedPreference },
                });
                if (!cancelled) {
                    setUser(updated);
                    const updatedPreference = normalizeThemePreference(updated?.theme_preference);
                    const updatedHasStoredPreference = hasStoredThemePreference(updated?.theme_preference);
                    lastAppliedUserTheme.current = `${updated?.id}:${updatedHasStoredPreference ? updatedPreference : "unset"}`;
                    skipInitialThemeSync.current = false;
                    if (updated?.id) {
                        markThemeSynced(updated.id);
                        setUserThemeSynced(true);
                    }
                }
            } catch (err) {
                console.error("Failed to persist theme preference:", err);
            } finally {
                syncingTheme.current = false;
                if (!cancelled) {
                    cancelled = true;
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [
        themePreference,
        user,
        normalizedUserThemePreference,
        userHasStoredThemePreference,
        setUser,
    ]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
