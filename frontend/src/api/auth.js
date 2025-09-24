import { http } from './http';

// Send google ID token to backend
export function exchangeGoogleIdToken(idToken) {
    // Use POST not GET for sending sensitive info
    return http('/api/auth/google', {
        method: 'POST',
        body: { id_token: idToken },
    });
}

export function currentUser() {
    // Returns current user profile if session cookie valid
    return http('/api/auth/me');
}

export function logout() {
    return http('/api/auth/logout', { method: 'POST' });
}