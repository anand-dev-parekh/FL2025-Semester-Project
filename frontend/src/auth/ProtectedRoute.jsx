import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

function FullPageSpinner() {
    return (
        <div className="min-h-screen grid place-items-center">
        <div className="spinner" />
        <style>{`
        .spinner { width: 40px; height: 40px; border-radius: 50%; border: 4px solid #ccc; border-top-color: #555; animation: spin .9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        </div>
    );
}

export default function ProtectedRoute({ children }) {
    const { user, initializing } = useAuth();
    if (initializing) return <FullPageSpinner />;
    if (!user) return <Navigate to="/" replace />;
    return children;
}