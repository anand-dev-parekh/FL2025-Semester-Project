const API_BASE = import.meta.env.VITE_BACKEND_API_URL?? '';

// Uniform helper function for http get requests to Flask backend
export async function http(path, { method = 'GET', body, headers, ...rest } = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        credentials: 'include',
        headers: {
        'Content-Type': body instanceof FormData ? undefined : 'application/json',
        ...headers,
        },
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
        ...rest,
    });

    // Handle errors
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(text || `HTTP ${res.status}`);
        err.status = res.status;
        err.body = text;
        throw err;
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) return res.json();
    return res.text();
}