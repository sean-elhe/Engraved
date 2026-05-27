// Isolated API wrappers

// api.js

// Add this helper function if it doesn't exist
async function handleResponse(response) {
    if (!response.ok) {
        // Grab error message from server if available, otherwise fallback
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! Status: ${response.status}`);
    }
    
    // If your API returns empty text on success (common for logouts)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        return await response.json();
    }
    
    return { success: true };
}

export async function apiFetchTranslations() {
    const response = await fetch("/api/translations");
    return await response.json();
}

export async function apiFetchBooks(translation) {
    const response = await fetch(`/api/books?translation=${translation}`);
    return await response.json();
}

export async function apiFetchChapters(translation, bookName) {
    const response = await fetch(`/api/chapters?translation=${translation}&book=${bookName}`);
    return await response.json();
}

export async function apiFetchChapter(translation, bookName, chapter) {
    const response = await fetch(`/api/chapter?translation=${translation}&book=${bookName}&chapter=${chapter}`);
    return await response.json();
}

export async function apiCheckLogIn() {
    const response = await fetch("/api/me", { credentials: "include" });
    return await response.json();
}

export async function apiLogin(name, pin) {
    const response = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin })
    });
    return await response.json();
}

export async function apiSignup(name, pin) {
    const response = await fetch("/api/signup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin })
    });
    return await response.json();
}

export async function apiLogout() {
    const response = await fetch("/api/logout", { method: "POST", credentials: "include" });
    return handleResponse(response);
}

export async function apiSaveChapter(payload) {
    const response = await fetch("/api/save-chapter", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    return await response.json();
}

export async function apiFetchSavedChapters() {
    const response = await fetch("/api/saved-chapters", { credentials: "include" });
    return await response.json();
}

/**
 * Sends a request to the backend to delete a specific saved bookmark.
 * @param {Object} payload - The chapter details to identify the record.
 * @param {string} payload.translation - Scripture translation (e.g., 'ESV').
 * @param {number} payload.book_id - The numeric ID of the book.
 * @param {number} payload.chapter - The chapter number.
 * @returns {Promise<Object>} The server's JSON response object.
 */
export async function apiDeleteChapter({ translation, book_id, chapter }) {
    const response = await fetch("/api/delete-chapter", {
        method: "DELETE", 
        credentials: "include",
        headers: { 
            "Content-Type": "application/json" 
        },
        body: JSON.stringify({ translation, book_id, chapter })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server returned status ${response.status}: ${errorText.slice(0, 100)}`);
    }

    return await response.json();
}