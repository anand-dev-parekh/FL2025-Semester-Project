import { useCallback, useEffect, useMemo, useState } from "react";
import { exchangeGoogleIdToken, currentUser, logout as apiLogout } from '../api/auth';
import { AuthContext } from "./AuthContext";
import { useTheme } from "../theme/useTheme";

// Overall file to manage authentication and user state for webapp using react context
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [initializing, setInitializing] = useState(true);
    const [loginReady, setLoginReady] = useState(false);
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const { setPreference: setThemePreference } = useTheme();

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

    const userThemePreference = user?.theme_preference;

    useEffect(() => {
        if (userThemePreference) {
            setThemePreference(userThemePreference);
        } else {
            setThemePreference("system");
        }
    }, [userThemePreference, setThemePreference]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
