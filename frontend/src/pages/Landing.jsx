import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import './Landing.css' 

// Landing / Login Page
export default function Landing() {
    const { user, loginReady, renderGoogleButton } = useAuth();
    const navigate = useNavigate();
    const buttonRef = useRef(null);


    useEffect(() => {
        if (user) navigate('/app', { replace: true });
    }, [user, navigate]);


    useEffect(() => {
        if (loginReady && buttonRef.current){
            renderGoogleButton(buttonRef.current);
        } 
    }, [loginReady, renderGoogleButton]);


    return (
      <main className="min-h-screen grid place-items-center p-6">
            <section className="w-full max-w-md rounded-2xl p-8 flex flex-col items-center text-center gap-y-4">
                <h1 className="text-2xl font-semibold">Welcome to the Magic Journal</h1>
                <p className="text-slate-600">Please sign in with Google to continue.</p>
                <div className="w-full flex justify-center py-4">
                        <div 
                            ref={buttonRef} 
                            id="buttonDiv"
                            className="google-button-container"
                            style={{
                                display: 'flex',
                                justifyContent: 'center',
                                width: '100%'
                            }}
                        />
                </div>
                <p className="text-xs text-slate-500">By continuing you agree to our Terms and Privacy Policy.</p>
            </section>
        </main>
    );
}