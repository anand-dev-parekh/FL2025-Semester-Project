
import { useAuth } from '../auth/AuthProvider';
import { useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';


export default function Dashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();



    return (
        <main className={styles.container}>
            <header className={styles.row} style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 className={styles.title}>Dashboard</h2>
                <div>
                  <button onClick={() => navigate('/profile')} className={`${styles.btn} ${styles.btn_subtle}`}>Profile</button>
                  <button onClick={() => navigate('/journal')} className={`${styles.btn} ${styles.btn_subtle}`}>Journal</button>
                  <button onClick={logout} className={`${styles.btn} ${styles.btn_primary}`}>Sign out</button>
                </div>
            </header>

            <section>
                <div className={styles.card}>
                    <p className={styles.label}>Hello {user?.name || 'user'}!</p>
                    <p style={{ color: '#666', fontSize: '0.97rem' }}>{user?.email}</p>
                </div>
            </section>
        </main>
    );
}