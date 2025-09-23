import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { exchangeGoogleIdToken, currentUser, logout as apiLogout } from '../api/auth';

// Overall file to manage authentication and user state for webapp using react context
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [initializing, setInitializing] = useState(true);
    const [loginReady, setLoginReady] = useState(false);
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    // On app load, try to fetch current user using cookie
    useEffect(() => {
        (async () => {
            try {
                const currentUser = await currentUser();
                setUser(currentUser);
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
                        const currentUser = await currentUser();
                        setUser(currentUser);
                    } catch (e) {
                        console.error('Auth error:', e);
                        setUser(null);
                    }
                },
            });
            setLoginReady(true);
        }


        if (document.readyState === 'complete') init();
        else window.addEventListener('load', init, { once: true });


        return () => window.google?.accounts?.id?.cancel?.();
    }, [clientId]);

    const renderGoogleButton = (el, options = {}) => {
        if (!loginReady || !window.google?.accounts?.id || !el) return;
        window.google.accounts.id.renderButton(el, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'pill',
            ...options,
        });
    };

    const logout = async () => {
        try { await apiLogout(); } catch {}
        setUser(null);
        window.google?.accounts?.id?.disableAutoSelect?.();
    };

    const value = useMemo(() => ({ user, loginReady, initializing, renderGoogleButton, logout }), [user, initializing, loginReady]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);