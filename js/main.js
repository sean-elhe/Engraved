// main.js
import { state } from './state.js';
import { fillDifficultyDropdown } from './utils.js';
import { loadTranslations, loadBooks, loadChapters, loadChapter, checkLogIn } from './render.js';
import { initEventListeners } from './events.js';

async function initializeApp() {
    fillDifficultyDropdown();
    initEventListeners(); // This will now handle the overlays too!

    try {
        // 1. Fetch translations and recover saved choice from localStorage
        await loadTranslations(); 
        
        // 2. Kick off the cascade: loadBooks() -> loadChapters() -> loadChapter()
        await loadBooks(); 
        
    } catch (error) {
        console.error("Initialization failed:", error);
    }

    checkLogIn();
}

initializeApp();