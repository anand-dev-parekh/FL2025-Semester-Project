import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import Navbar from "../components/Navbar";

export default function SignIn() {
  const { user, loginReady, renderGoogleButton } = useAuth();
  const navigate = useNavigate();
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const destination = user.onboarding_complete ? "/app" : "/onboarding";
    navigate(destination, { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (loginReady && buttonRef.current) {
      buttonRef.current.innerHTML = "";
      renderGoogleButton(buttonRef.current, { width: 320 });
    }
  }, [loginReady, renderGoogleButton]);

  return (
    <>
      <Navbar />
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="mx-auto flex min-h-[50vh] w-full max-w-lg flex-col items-center justify-center gap-6 rounded-3xl border border-white/40 bg-white/70 px-8 py-12 text-center backdrop-blur-md transition-colors duration-500 dark:border-slate-800/70 dark:bg-slate-900/70 sm:px-12">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Sign in</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Continue your journey by signing in with Google.
          </p>
          <div
            ref={buttonRef}
          />
        </div>
      </div>
    </>
  );
}
