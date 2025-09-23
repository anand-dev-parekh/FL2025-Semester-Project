import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

// Landing / Login Page
export default function Landing() {
    const { user, loginReady, renderGoogleButton } = useAuth();
    const navigate = useNavigate();
    const buttonRef = useRef(null);


    useEffect(() => {
        if (user) navigate('/app', { replace: true });
    }, [user, navigate]);


    useEffect(() => {
        if (loginReady && buttonRef.current) renderGoogleButton(buttonRef.current);
    }, [loginReady, renderGoogleButton]);


    return (
        <main className="min-h-screen grid place-items-center p-6">
        <section className="w-full max-w-md rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-semibold mb-2">Welcome to the Magic Journal</h1>
        <p className="text-slate-600 mb-6">Please sign in with Google to continue.</p>
        <div ref={buttonRef} />
        <p className="text-xs text-slate-500 mt-4">By continuing you agree to our Terms and Privacy Policy.</p>
        </section>
        </main>
    );
}