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
    difficultySelect.innerHTML = "";

    state.difficultyLevels.forEach(level => {
        difficultySelect.innerHTML += `
            <option value="${level}">
                ${level}
            </option>
        `;
    });
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
    passwordInput.value = "";
}