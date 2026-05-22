// This acts as your custom "buttons.js". All click configurations live here.
import { state, resetScore } from './state.js';
import { getBookId, getBookName, getChapter, clearInputs, showLoggedInUI, showLoggedOutUI } from './utils.js';
import { loadBooks, loadChapters, loadChapter, displayCurrentVerse, calculateScore, displayVerseWords, showScoreScreen, handleNext, loadSavedChaptersUI } from './render.js';
import { apiLogin, apiSignup, apiLogout, apiSaveChapter } from './api.js';

// --- Dom Element Targets ---
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const logoutBtn = document.getElementById("logoutBtn");
const saveBtn = document.getElementById("saveBtn");
const savedUI = document.getElementById("savedUI");

const clearBtn = document.getElementById("clearBtn");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const nextBtn = document.getElementById("nextBtn");

// Add these to the top of events.js
const openSettings = document.getElementById("openSettings");
const closeSettings = document.getElementById("closeSettings");
const settingsOverlay = document.getElementById("settingsOverlay");

const openAuth = document.getElementById("openAuth");
const closeAuth = document.getElementById("closeAuth");
const authOverlay = document.getElementById("authOverlay");

/**
 * Adds a long-click event listener to a DOM element.
 * @param {HTMLElement} element - The target button.
 * @param {Function} callback - The function to run when long-pressed.
 * @param {number} duration - Time in milliseconds to trigger the hold (default 800ms).
 */
export function addLongClickListener(element, callback, duration = 800) {
    let pressTimer = null;

    const startPress = (event) => {
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
            callback(event);
        }, duration);
    };

    const cancelPress = () => {
        if (pressTimer !== null) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    };

    // Desktop Mouse Events
    element.addEventListener("mousedown", startPress);
    element.addEventListener("mouseup", cancelPress);
    element.addEventListener("mouseleave", cancelPress);

    // Mobile/Tablet Touch Events
    element.addEventListener("touchstart", startPress, { passive: true });
    element.addEventListener("touchend", cancelPress);
    element.addEventListener("touchcancel", cancelPress);
}

export function handleNextInput(currentIndex, inputs) {
    const nextIndex = currentIndex < inputs.length - 1 ? currentIndex + 1 : null;
    if (nextIndex !== null) {
        inputs[nextIndex].focus();
        return;
    }
    handleNext();
}

export function setupInputLogic() {
    const inputs = document.querySelectorAll(".verseInput");
    const hintBtn = document.getElementById("hintBtn");

    inputs.forEach((input, index) => {
        input.setAttribute("enterkeyhint", "next");

        input.addEventListener("focus", () => {
            state.selectedInput = input;
            hintBtn.classList.add("hidden");
            clearTimeout(state.hintTimer);
            state.hintTimer = setTimeout(() => {
                if (state.selectedInput === input) {
                    hintBtn.classList.remove("hidden");
                }
            }, 6000);
        });

        input.addEventListener("blur", () => {
            clearTimeout(state.hintTimer);
            state.hintTimer = null;
            setTimeout(() => {
                if (document.activeElement !== hintBtn) {
                    hintBtn.classList.add("hidden");
                }
            }, 0);
        });

        input.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            handleNextInput(index, inputs);
        });

        input.addEventListener("input", event => {
            event.target.value = event.target.value.toLowerCase().replace(/[^a-z]/g, "");
            event.target.style.width = `${Math.max(event.target.value.length + 2, 1)}ch`;
        });
    });
}

export function initEventListeners() {
    let isLongPress = false;

    // Dropdown updates
    document.getElementById("translationSelect").addEventListener("change", async event => {
        state.selectedTranslation = event.target.value;
        await loadBooks();
        await loadChapters();
        await loadChapter();
    });

    document.getElementById("bookSelect").addEventListener("change", async () => {
        await loadChapters();
        await loadChapter();
    });

    document.getElementById("chapterSelect").addEventListener("change", async () => {
        await loadChapter();
    });

    document.getElementById("difficultySelect").addEventListener("change", () => {
        displayCurrentVerse();
    });

    document.getElementById("modeSelect").addEventListener("change", event => {
        state.verseMode = event.target.value;
        setupVerseOrder();
        displayCurrentVerse();
    });

    let isNextLongPress = false;

    // 1. Long Click Action: Jump straight to the score screen
    addLongClickListener(nextBtn, () => {
        isNextLongPress = true; // Set flag to block the upcoming regular click
        console.log("Long press on nextBtn: Skipping straight to score screen.");
        showScoreScreen();
    }, 800); // 800ms hold time

    // 2. Standard Tap Action: Move to the next stage or verse instantly
    nextBtn.addEventListener("click", () => {
        // If they just let go of a long press, stop and do nothing
        if (isNextLongPress) {
            isNextLongPress = false;
            return;
        }

        console.log("Standard quick tap: Advancing application state.");
        
        // Stage 1 -> Stage 2 (Check answers)
        if (state.stage === 1) {
            calculateScore();
            state.stage = 2;
            displayVerseWords();
            return;
        }

        // Stage 2 -> Next Verse (or show score screen if it was the last verse)
        if (state.stage === 2) {
            if (state.verseOrderIndex < state.verseOrder.length - 1) {
                state.verseOrderIndex++;
                state.stage = 1;
                displayCurrentVerse();
            } else {
                showScoreScreen();
            }
        }
    });

    let isClearLongPress = false;

    addLongClickListener(clearBtn, () => {
        isClearLongPress - true;
        console.log("Long press on clearBtn: Restarting.")
        state.verseOrderIndex = 0;
        resetScore();
        displayCurrentVerse();
    }, 800);

    clearBtn.addEventListener("click", () => {
            if (isClearLongPress) {
                isClearLongPress = false;
            return;
        }
        console.log("Standard quick tap: Clear inputs.");
        clearInputs();   
    });

    document.getElementById("hintBtn").addEventListener("click", () => {
        if (state.tapTimer) {
            clearTimeout(state.tapTimer);
            state.tapTimer = null;
            displayCurrentVerse();
        } else {
            state.tapTimer = setTimeout(() => {
                state.hintCount++;
                if (!state.selectedInput) return;

                const answer = state.selectedInput.dataset.answer.toLowerCase().replace(/[^a-z]/g, "");
                const current = state.selectedInput.value.toLowerCase().replace(/[^a-z]/g, "");

                if (current.length < answer.length) {
                    const newText = answer.slice(0, current.length + 1);
                    state.selectedInput.value = newText;
                    state.selectedInput.focus();
                    state.selectedInput.setSelectionRange(newText.length, newText.length);
                    state.selectedInput.dispatchEvent(new Event("input"));
                }
                state.tapTimer = null;
            }, 250);
        }
    });

    document.getElementById("restartBtn").addEventListener("click", () => {
        document.getElementById("scoreScreen").classList.add("hidden");
        document.getElementById("practiceScreen").classList.remove("hidden");
        state.verseOrderIndex = 0;
        resetScore();
        displayCurrentVerse();
    });

    // Score UI Breakdown Toggle
    document.getElementById("breakdownToggle").addEventListener("click", () => {
        document.getElementById("verseScoreList").classList.toggle("show-dropdown");
        document.getElementById("breakdownArrow").classList.toggle("rotate-arrow");
    });

    // Authentication Handlers
    loginBtn.addEventListener("click", async () => {
        const data = await apiLogin(emailInput.value, passwordInput.value);
        if (data.success) {
            showLoggedInUI();
        } else {
            alert(data.error);
        }
    });

    signupBtn.addEventListener("click", async () => {
        const data = await apiSignup(emailInput.value, passwordInput.value);
        if (data.success) {
            alert("Account created!");
        } else {
            alert(data.error);
        }
    });

    logoutBtn.addEventListener("click", async () => {
        await apiLogout();
        showLoggedOutUI();
    });

    savedUI.addEventListener("click", () => {
        loadSavedChaptersUI();
    });

    openSettings.addEventListener("click", () => settingsOverlay.classList.remove("hidden"));

    let isAuthLongPress = false;

    addLongClickListener(openAuth, async (event) => {
        isAuthLongPress = true;
        console.log("Long press on authBtn: Saving.")

        const bookId = getBookId();
        const chapter = getChapter();

        if (!bookId || Number.isNaN(bookId)) {
            alert("Please select a book first.");
            return;
        }
        if (!chapter) return;

        const data = await apiSaveChapter({
            translation: state.selectedTranslation,
            book_id: bookId,
            book: getBookName(),
            chapter: chapter
        });

        if (data.success) {
            alert("Chapter saved!");
        } else {
            alert(data.error);
        }

    }, 800);

    openAuth.addEventListener("click", () => {
            if (isAuthLongPress) {
                isAuthLongPress = false;
            return;
        }
        console.log("Standard quick tap: Show menu.");
            authOverlay.classList.remove("hidden");
    });

    
    closeSettings.addEventListener("click", () => settingsOverlay.classList.add("hidden"));
    closeAuth.addEventListener("click", () => authOverlay.classList.add("hidden"));

    settingsOverlay.addEventListener("click", e => {
        if (e.target === settingsOverlay) settingsOverlay.classList.add("hidden");
    });
    
    authOverlay.addEventListener("click", e => {
        if (e.target === authOverlay) authOverlay.classList.add("hidden");
    });
}