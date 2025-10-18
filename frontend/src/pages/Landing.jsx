import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function Landing() {
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
      renderGoogleButton(buttonRef.current);
    }
  }, [loginReady, renderGoogleButton]);

  return (
    <main className="flex flex-1 items-center justify-center py-12">
      <section className="w-full max-w-xl rounded-3xl border border-white/40 bg-white/75 p-10 text-center shadow-2xl backdrop-blur-md transition-colors duration-500 dark:border-slate-700/70 dark:bg-slate-900/80">
        <h1 className="mb-3 text-4xl font-semibold text-emerald-800 dark:text-emerald-300">
          Welcome to the Magic Journal
        </h1>
        <p className="mx-auto max-w-md text-base text-slate-600 dark:text-slate-300">
          Capture your habits, reflect on your progress, and stay inspired. Sign in with Google to
          begin.
        </p>
        <div className="mt-8 flex justify-center">
          <div ref={buttonRef} id="buttonDiv" className="flex w-full max-w-xs justify-center" />
        </div>
        <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
          By continuing you agree to our Terms and Privacy Policy.
        </p>
      </section>
    </main>
  );
}
