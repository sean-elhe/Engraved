// Pure DOM scrapers and structural lookups
import { state } from './state.js';

export function getBookId() {
    return Number(document.getElementById("bookSelect").value);
}

export function getBookName() {
    const select = document.getElementById("bookSelect");
    return select.options[select.selectedIndex]?.text || "";
}

export function getChapter() {
    return Number(document.getElementById("chapterSelect").value);
}

export function fillDifficultyDropdown() {
    const difficultySelect = document.getElementById("difficultySelect");
    if (!difficultySelect) return;

    // 1. Build the dropdown options efficiently
    difficultySelect.innerHTML = state.difficultyLevels.map(level => `
        <option value="${level}">${level}</option>
    `).join('');

    // 2. PERSISTENCE: Look for a saved difficulty choice
    const savedDifficulty = localStorage.getItem("selectedDifficulty");
    
    // Check if the saved choice is actually valid according to our state array
    const isValidLevel = state.difficultyLevels.includes(savedDifficulty);

    if (savedDifficulty && isValidLevel) {
        difficultySelect.value = savedDifficulty;
    } else {
        // Fallback to the first option if nothing is saved yet (e.g., "Easy")
        difficultySelect.selectedIndex = 0;
        localStorage.setItem("selectedDifficulty", difficultySelect.value);
    }
}

export function clearInputs() {
    document.querySelectorAll(".verseInput").forEach(input => {
        input.value = "";
    });
}

export function showLoggedOutUI() {
    authSection.classList.remove("hidden");
    appSection.classList.add("hidden");
    authTitle.textContent = "Log In";
}

export function showLoggedInUI() {
    authSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    authTitle.textContent = "Account!";
    pinInput.value = "";
}