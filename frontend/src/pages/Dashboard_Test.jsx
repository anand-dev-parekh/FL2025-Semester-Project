import { useAuth } from '../auth/AuthProvider';


export default function Dashboard() {
    const { user, logout } = useAuth();
    return (
        <main className="min-h-screen p-6">
        <header className="flex items-center justify-between max-w-4xl mx-auto">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <button onClick={logout} className="px-3 py-2 rounded-lg border hover:bg-slate-50">Sign out</button>
        </header>


        <section className="max-w-4xl mx-auto mt-8 grid gap-4">
        <div className="rounded-xl border p-6">
        <p className="font-medium">Hello {user?.name || 'user'}!</p>
        <p className="text-slate-600 text-sm">{user?.email}</p>
        </div>
        </section>
        </main>
    );
}