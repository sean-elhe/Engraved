// This acts as your custom "buttons.js". All click configurations live here.
import { state, resetScore } from './state.js';
import { getBookId, getBookName, getChapter, clearInputs, showLoggedInUI, showLoggedOutUI } from './utils.js';
import { loadBooks, loadChapters, loadChapter, displayCurrentVerse, calculateScore, displayVerseWords, showInfoScreen,showScoreScreen, handleNext, loadSavedChaptersUI,setupVerseOrder, loadSavedScoresUI } from './render.js';
import { apiLogin, apiSignup, apiLogout, apiSaveChapter, apiSaveScore } from './api.js';

// --- Dom Element Targets ---
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const logoutBtn = document.getElementById("logoutBtn");
const saveBtn = document.getElementById("saveBtn");
const savedUI = document.getElementById("savedUI");
const infoScreen = document.getElementById("infoScreen");
const scoresScreen = document.getElementById("scoresScreen");
const scoresUI = document.getElementById("scoresUI");
const closeScoreBtn = document.getElementById("closeScoreBtn");

const closeSaved = document.getElementById("closeSaved");
const savedScreen = document.getElementById("savedScreen");
const practiceScreen = document.getElementById("practiceScreen"); // Grab your core practice interface wrapper
const clearBtn = document.getElementById("clearBtn");
const nameInput = document.getElementById("nameInput");
const pinInput = document.getElementById("pinInput");
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

    // Helper function to update the button based on the current state
    function updateHintButton() {
        const activeInput = state.selectedInput;
        
        if (!activeInput) {
            hintBtn.textContent = "Need a hint? Tap a blank.";
        } else {
            hintBtn.textContent = "Click for a hint!";  // Text when selected but NOT blank
        }
    }

    inputs.forEach((input, index) => {
        input.setAttribute("enterkeyhint", "next");

        input.addEventListener("focus", () => {
            state.selectedInput = input;
            updateHintButton(); // Update text on focus
        });

        input.addEventListener("blur", () => {
            // Use setTimeout to ensure we don't clear state if focus is just moving to another input
            setTimeout(() => {
                if (document.activeElement !== input && !input.contains(document.activeElement)) {
                    // Only clear if focus didn't just jump to another .verseInput
                    if (!document.activeElement.classList.contains("verseInput")) {
                        state.selectedInput = null;
                        updateHintButton();
                    }
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
            
            updateHintButton(); // Update text in real-time as they type!
        });
    });
}

export function initEventListeners() {
    let isLongPress = false;

    // Dropdown updates
    document.getElementById("translationSelect").addEventListener("change", async event => {
        const newlySelected = event.target.value;
        
        // 1. Force the permanent state change instantly
        localStorage.setItem("selectedTranslation", newlySelected);
        state.selectedTranslation = newlySelected; 
        
        // 2. Now run your daisy-chained data fetches using the fresh state values
        await loadBooks();
        await loadChapters();
        await loadChapter();
    });

    document.getElementById("bookSelect").addEventListener("change", async () => {
        const newlySelectedBook = event.target.value;
        localStorage.setItem("selectedBookId", newlySelectedBook);
        const bookName = event.target.options[event.target.selectedIndex].text;
        await loadChapters(bookName);
    });

    document.getElementById("chapterSelect").addEventListener("change", async () => {
        const newlySelectedChapter = event.target.value;
        localStorage.setItem("selectedChapter", newlySelectedChapter);
        await loadChapter();
    });

    document.getElementById("difficultySelect").addEventListener("change", () => {
        const newlySelectedDifficulty = event.target.value;
        localStorage.setItem("selectedDifficulty", newlySelectedDifficulty);
        
        displayCurrentVerse();
    });

    document.getElementById("modeSelect").addEventListener("change", event => {
        const newMode = event.target.value;
        
        // 1. Save it to localStorage instantly
        localStorage.setItem("selectedVerseMode", newMode);
        
        // 2. Update your live application state tracking variable
        state.verseMode = newMode;
        
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
            });
        

    document.getElementById("restartBtn").addEventListener("click", async (event) => {
        const btn = event.currentTarget;
        
        // Prevent double submissions if they click rapidly
        if (btn.disabled) return; 

        // 1. Change UI to show it's working
        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

        // 2. Gather current session info out of your global state object
        const scorePayload = {
            score: state.correctCount || 0,
            total_questions: state.totalHiddenWords || 0,
            percentage: state.totalHiddenWords === 0 ? 0 : Math.round((state.correctCount / state.totalHiddenWords) * 100),
            translation: state.selectedTranslation || "Unknown",
            book: state.book?.book || (typeof getBookName === 'function' ? getBookName() : "Unknown"),              chapter: state.currentChapter?.chapter || 0,
            difficulty: document.getElementById("difficultySelect")?.value || "Normal",
            mode: state.mode || "standard"
        };

        try {
            // 3. Fire the API request
            await apiSaveScore(scorePayload);
            
            // 4. Update button to a success state
            btn.innerHTML = `<i class="fa-solid fa-check"></i> Saved Successfully!`;
            btn.style.backgroundColor = "#10b981"; // Success green
            btn.style.color = "#ffffff";
        } catch (error) {
            console.error("Click handler save failed:", error);
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Try Again`;
        }    
    });

    document.getElementById("closeScoreBtn").addEventListener("click", () => {
        const saveBtn = document.getElementById("restartBtn");
    
        if (saveBtn) {
            // 2. Reset the layout styles back to your default CSS specs
            saveBtn.style.backgroundColor = ""; 
            saveBtn.style.color = "";
            
            // 3. Restore the original default text string content
            saveBtn.innerHTML = "Save Score";
            
            // 4. Re-enable it if it was disabled during submission
            saveBtn.disabled = false; 
        }

        document.getElementById("scoreScreen").classList.add("hidden");
        document.getElementById("practiceScreen").classList.remove("hidden");
        state.verseOrderIndex = 0;
        resetScore();
        displayCurrentVerse();
    });

// 1. Open the Info Popup when clicking the info icon button
document.getElementById("showInfoBtn").addEventListener("click", () => {
    document.getElementById("infoModalOverlay").classList.remove("hidden");
});

// 2. Close the Info Popup when clicking the top "X" button
document.getElementById("closeInfoBtn").addEventListener("click", () => {
    document.getElementById("infoModalOverlay").classList.add("hidden");
});

// 3. Close the Info Popup when clicking the "Got it!" action button
document.getElementById("dismissInfoBtn").addEventListener("click", () => {
    document.getElementById("infoModalOverlay").classList.add("hidden");
});

// 4. Optional: Close the Popup if they click on the dark background overlay space directly
document.getElementById("infoModalOverlay").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
        event.currentTarget.classList.add("hidden");
    }
});

    // Score UI Breakdown Toggle
    document.getElementById("breakdownToggle").addEventListener("click", () => {
        document.getElementById("verseScoreList").classList.toggle("show-dropdown");
        document.getElementById("breakdownArrow").classList.toggle("rotate-arrow");
    });

    // Authentication Handlers
    loginBtn.addEventListener("click", async () => {
        const data = await apiLogin(nameInput.value, pinInput.value);
        if (data.success) {
            showLoggedInUI();
        } else {
            alert(data.error);
        }
    });

    signupBtn.addEventListener("click", async () => {
        const data = await apiSignup(nameInput.value, pinInput.value);
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

// Inside your initEventListeners() function in events.js
    const savedUI = document.getElementById("savedUI");
    const closeSaved = document.getElementById("closeSaved");
    const closeAuth = document.getElementById("closeAuth"); // Make sure this is grabbed at the top
    const appSection = document.getElementById("appSection");
    const savedScreen = document.getElementById("savedScreen");
    const authTitle = document.getElementById("authTitle");
    const scoresUI = document.getElementById("scoresUI");
    const scoresScreen = document.getElementById("scoresScreen");

    // Clicking Bookmarks updates title, reveals the back arrow, and transitions sub-views
savedUI.addEventListener("click", () => {
    appSection.classList.add("hidden");
    savedScreen.classList.remove("hidden");
    
    authTitle.textContent = "Bookmarks"; // Restored clean normalization
    
    closeSaved.classList.remove("hidden"); // Show the Back Arrow
    closeAuth.classList.add("hidden");    // Hide the Close "X" button!
    
    loadSavedChaptersUI();
});

scoresUI.addEventListener("click", () => {
    appSection.classList.add("hidden");
    // Ensure scoresScreen variable points to document.getElementById("scoresScreen")
    scoresScreen.classList.remove("hidden"); 

    authTitle.textContent = "Scores"; // Clean structural title string

    closeSaved.classList.remove("hidden"); // Show the Back Arrow
    closeAuth.classList.add("hidden");    // Hide the Close "X" button!

    loadSavedScoresUI();
});

// Clicking the Back Arrow restores the root panel states seamlessly
closeSaved.addEventListener("click", () => {
    savedScreen.classList.add("hidden");
    scoresScreen.classList.add("hidden");
    appSection.classList.remove("hidden");
    
    authTitle.textContent = "Account"; // Removed trailing punctuation mark
    
    closeSaved.classList.add("hidden");     // Hide the Back Arrow
    closeAuth.classList.remove("hidden");  // Show the Close "X" button again!
});

openSettings.addEventListener("click", () => settingsOverlay.classList.remove("hidden"));

let isAuthLongPress = false;

addLongClickListener(openAuth, async (event) => {
    isAuthLongPress = true;
    console.log("Long press on authBtn: Saving.");

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

// Central function to cleanly wipe and reset dashboard sub-view states
function resetAuthModalState() {
    authOverlay.classList.add("hidden");
    savedScreen.classList.add("hidden");
    scoresScreen.classList.add("hidden"); // Ensure history hides too!
    appSection.classList.remove("hidden");
    
    authTitle.textContent = "Account"; 
    closeSaved.classList.add("hidden");
    closeAuth.classList.remove("hidden"); // Make sure 'X' is restored as primary
}

closeAuth.addEventListener("click", resetAuthModalState);

settingsOverlay.addEventListener("click", e => {
    if (e.target === settingsOverlay) settingsOverlay.classList.add("hidden");
});

authOverlay.addEventListener("click", e => {
    // FIX: Instead of just adding hidden, run the reset state function 
    // so things don't stay broken when re-opening later!
    if (e.target === authOverlay) resetAuthModalState();
});
}