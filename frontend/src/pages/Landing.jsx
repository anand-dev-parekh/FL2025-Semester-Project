
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import styles from './Landing.module.css';

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
            <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <section className={styles.container}>
                    <h1 className={styles.title}>Welcome to the Magic Journal</h1>
                    <p className={styles.subtitle}>Please sign in with Google to continue.</p>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '1.2rem 0' }}>
                        <div
                            ref={buttonRef}
                            id="buttonDiv"
                            className="google-button-container"
                            style={{ display: 'flex', justifyContent: 'center', width: '100%' }}
                        />
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#888' }}>
                        By continuing you agree to our Terms and Privacy Policy.
                    </p>
                </section>
            </main>
        );
}