// main.js
import { state } from './state.js';
import { fillDifficultyDropdown } from './utils.js';
import { loadTranslations, loadBooks, loadChapters, loadChapter, checkLogIn } from './render.js';
import { initEventListeners } from './events.js';

async function initializeApp() {
    fillDifficultyDropdown();
    initEventListeners(); // This will now handle the overlays too!

    await loadTranslations();
    state.selectedTranslation = document.getElementById("translationSelect").value;

    await loadBooks();
    await loadChapters();
    await loadChapter();

    checkLogIn();
}

initializeApp();