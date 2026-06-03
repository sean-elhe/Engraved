// Core rendering functions that touch state and write layout adjustments
import { state, startVerseTime, getVerseElapsedTime, resetScore } from './state.js';
import { getBookName, getChapter, getBookId, showLoggedInUI, showLoggedOutUI } from './utils.js';
import { shuffleArray, ensureNoSequences, formatTime, closeAnswer, replacingWords } from './logic.js';
import { apiFetchTranslations, apiFetchBooks, apiFetchChapters, apiFetchChapter, apiCheckLogIn, apiFetchSavedChapters, apiDeleteChapter, 
    apiSaveScore, apiFetchSavedScores, apiDeleteScore } from './api.js';
import { setupInputLogic } from './events.js'; // imported dynamically to bridge event setup

export async function loadTranslations() {
    const translations = await apiFetchTranslations();
    const translationSelect = document.getElementById("translationSelect");
    
    // Clear and build using proper backticks ``
    translationSelect.innerHTML = translations.map(item => `
        <option value="${item.translation}">${item.translation}</option>
    `).join('');

    // Restore persistence layer
    const savedTranslation = localStorage.getItem("selectedTranslation");
    if (savedTranslation) {
        state.selectedTranslation = savedTranslation;
    } else if (translations.length > 0) {
        state.selectedTranslation = translations[0].translation;
    }

    translationSelect.value = state.selectedTranslation;
}

export async function loadBooks() {
    // 🔍 ADD THIS LOG LINE HERE:
    console.log("Fetching books for translation:", state.selectedTranslation);

    const books = await apiFetchBooks(state.selectedTranslation);
    const bookSelect = document.getElementById("bookSelect");
    
    if (!books || books.length === 0) {
        console.error("No books returned from API. Received:", books);
        return;
    }

    // 1. Render to the DOM
    bookSelect.innerHTML = books.map(book => `
        <option value="${book.book_id}">${book.book}</option>
    `).join('');

    const savedBookId = localStorage.getItem("selectedBookId");
    const savedBookExists = books.some(b => b.book_id = savedBookId);

    if (savedBookId && savedBookExists) {
        bookSelect.value = savedBookId;
    } else {
        bookSelect.selectedIndex = 0;
        localStorage.setItem("selectedBookId", bookSelect.value);
    }

    console.log("Books loaded into DOM");

    const currentBookName = bookSelect.options[bookSelect.selectedIndex].text;
    await loadChapters(currentBookName);
}

export async function loadChapters(fallbackBookName) {
    const bookName = fallbackBookName || getBookName();
    
    if (!bookName) {
        console.warn("loadChapters aborted: No book name available yet.");
        return;
    }

    const chapters = await apiFetchChapters(state.selectedTranslation, bookName);
    const chapterSelect = document.getElementById("chapterSelect");
    
    if (!chapters || chapters.length === 0) {
        console.error("No chapters found for book:", bookName);
        return;
    }

    chapterSelect.innerHTML = chapters.map(chapter => `
        <option value="${chapter}">${chapter}</option>
    `).join('');
    
    // PERSISTENCE: Check if they have a saved chapter
    const savedChapter = localStorage.getItem("selectedChapter");
    const savedChapterExists = chapters.some(c => c == savedChapter);

    if (savedChapter && savedChapterExists) {
        chapterSelect.value = savedChapter;
    } else {
        chapterSelect.selectedIndex = 0;
        localStorage.setItem("selectedChapter", chapterSelect.value);
    }

    console.log("Chapters loaded into DOM");

    // CASCADE: Pass selected parameters down to load the final text
    await loadChapter(bookName, chapterSelect.value);
}

export function setupVerseOrder() {
    if (!state.currentChapter || !Array.isArray(state.currentChapter.verses)) {
        state.verseOrder = [];
        return;
    }

    // 1. PERSISTENCE: Check if a mode preference is saved in localStorage
    const savedMode = localStorage.getItem("selectedVerseMode");
    if (savedMode) {
        state.verseMode = savedMode; // Keep the global state in sync
    }

    // 2. Apply the sorting logic based on the synced mode
    if (state.verseMode === "random") {
        state.verseOrder = ensureNoSequences(shuffleArray(state.currentChapter.verses));
    } else {
        state.verseOrder = state.currentChapter.verses;
    }
    
    state.verseOrderIndex = 0;

    const modeSelect = document.getElementById("modeSelect");
    if (modeSelect) {
        modeSelect.value = state.verseMode;
    }
}

export async function loadChapter(fallbackBookName, fallbackChapterNum) {
    // Use passed parameters if available (on startup), or read the DOM (on user select)
    const bookName = fallbackBookName || getBookName();
    const chapterNum = fallbackChapterNum || getChapter();

    if (!bookName || !chapterNum) {
        console.warn(`Aborting loadChapter: Book (${bookName}) or Chapter (${chapterNum}) dropdown is not ready yet.`);
        return;
    }

    const verses = await apiFetchChapter(state.selectedTranslation, bookName, chapterNum);

    if (!Array.isArray(verses) || verses.length === 0) {
        console.error("No verses found for:", bookName, chapterNum);
        return;
    }

    state.currentChapter = {
        chapter: chapterNum,
        verses: verses
    };

    setupVerseOrder();
    resetScore();
    displayCurrentVerse();
}

export async function checkLogIn() {
    const data = await apiCheckLogIn();
    console.log(data);

    if (data.loggedIn) {
        showLoggedInUI();
    } else {
        showLoggedOutUI();
    }
}

export function updateProgressBar() {
    const progressFill = document.getElementById("progressFill");
    const percent = (state.verseOrderIndex / state.verseOrder.length) * 100;

    progressFill.style.width = `${percent}%`;
    document.getElementById("progressCurrent").textContent =
        `${state.currentChapter.chapter}:${state.verseOrder[state.verseOrderIndex].verse}`;
    document.getElementById("progressTotal").textContent =
        `${state.verseOrderIndex}/${state.verseOrder.length}`;
}

export function displayVerseWords() {
    const verseText = document.getElementById("verseText");
    const savedInputs = {};

    document.querySelectorAll(".verseInput").forEach(input => {
        savedInputs[input.dataset.index] = input.value;
    });

    verseText.innerHTML = "";

    state.currentVerseDisplay.wordList.forEach(item => {
        let htmlChunk = "";

        
        if (item.isHidden) {
            if (state.stage === 2) {
                const userInput = savedInputs[item.index] || "";
                const isCorrect = closeAnswer(userInput, item.word);
            
                htmlChunk = `<span class="${isCorrect ? 'correctWord' : 'wrongWord'}">${item.word}</span>`;
            } else {
                htmlChunk = `<input class="verseInput" data-index="${item.index}" data-answer="${item.word}"/>`;
            }
        } else {
            htmlChunk = `<span>${item.word}</span>`;        
    }
    
    verseText.innerHTML += htmlChunk + " ";    });

    if (state.stage === 1) {
        setupInputLogic();
    }
}

export function displayCurrentVerse() {
    startVerseTime();
    const verse = state.verseOrder[state.verseOrderIndex];

    if (!verse) {
        console.warn("displayCurrentVerse called, but no verse data is available yet.");
        return;
    }

    document.getElementById("reference").textContent = `${verse.book} ${verse.chapter}`;

    const difficulty = document.getElementById("difficultySelect").value;
    state.currentVerseDisplay = replacingWords(verse.text, difficulty);
    state.stage = 1;

    displayVerseWords();
    updateProgressBar();
}

export function calculateScore() {
    let verseCorrect = 0;
    let verseTotal = 0;

    state.currentVerseDisplay.wordList.forEach(item => {
        if (item.isHidden) {
            verseTotal++;
            const input = document.querySelector(`input[data-index="${item.index}"]`);
            const userInput = input?.value || "";

            if (closeAnswer(userInput, item.word)) {
                verseCorrect++;
                input.classList.add("correct");
                input.classList.remove("incorrect");
            } else {
                input.classList.add("incorrect");
                input.classList.remove("correct");
            }
            input.disabled = true;
        }
    });

    state.correctCount += verseCorrect;
    state.totalHiddenWords += verseTotal;

    const currentVerse = state.verseOrder[state.verseOrderIndex];
    state.verseScores.push({
        chapter: currentVerse.chapter,
        verse: currentVerse.verse,
        correct: verseCorrect,
        total: verseTotal,
        time: getVerseElapsedTime()
    });
}

export function showInfoScreen() {
    document.getElementById("practiceScreen").classList.add("hidden");
    document.getElementById("infoScreen").classList.remove("hidden");
}

export function showScoreScreen() {
    // 1. Existing UI transitions
    document.getElementById("practiceScreen").classList.add("hidden");
    document.getElementById("scoreScreen").classList.remove("hidden");

    // 2. Existing calculations
    const chapterTotalTime = state.verseScores.reduce((sum, score) => sum + score.time, 0);
    const percent = state.totalHiddenWords === 0 ? 0 : Math.round((state.correctCount / state.totalHiddenWords) * 100);

    // ==========================================
    // NEW: Prepare data for your SQL Table
    // ==========================================
    const scorePayload = {
        score: state.correctCount, // Maps to "score"
        total_questions: state.totalHiddenWords, // Maps to "total_questions"
        percentage: percent, // Maps to "percentage"
        translation: state.selectedTranslation, // Maps to "translation"
        book: state.book?.book || getBookName(), // Maps to "book"
        chapter: state.currentChapter.chapter, // Maps to "chapter"
        difficulty: document.getElementById("difficultySelect").value, // Maps to "difficulty"
        mode: state.mode || "standard" // Maps to "mode" (e.g., timed, practice, etc.)
    };

    // Trigger the database save
    apiSaveScore(scorePayload);
    // ==========================================

    // 3. Your existing UI rendering code (unchanged)
    chapterScore.innerHTML += `
    <div class="chapter-score">
        <div class="chapter-score-top">
            <span class="chapter-score-title">${scorePayload.book} ${scorePayload.chapter}</span>
            <span class="chapter-score-percent">${percent}%</span>
        </div>
        <div class="chapter-score-meta">
            <span>${scorePayload.score} / ${scorePayload.total_questions}</span>
            <span>${formatTime(chapterTotalTime)}</span>
        </div>
        <div class="big-progress">
            <div class="big-progress-fill" style="width: ${percent}%"></div>
        </div>
    </div>
    `;

    document.getElementById("translation").textContent = scorePayload.translation;
    document.getElementById("difficulty").textContent = scorePayload.difficulty;
    document.getElementById("hints").textContent = state.hintCount;

    const verseScoreList = document.getElementById("verseScoreList");
    verseScoreList.innerHTML = "";

    state.verseScores.forEach(score => {
        const versePercent = score.total === 0 ? 0 : Math.round((score.correct / score.total) * 100);
        verseScoreList.innerHTML += `
          <div class="verse-score">
            <div class="verse-score-top">
              <span class="verse-score-title">${state.currentChapter.chapter}:${score.verse}</span>
              <span class="verse-score-percent">${versePercent}%</span>
            </div>
            <div class="verse-score-meta">
              <span>${score.correct} / ${score.total}</span>
              <span>${formatTime(score.time)}</span>
            </div>
            <div class="mini-progress">
              <div class="mini-progress-fill" style="width: ${versePercent}%"></div>
            </div>
          </div>
        `;
    });
}

export function handleNext() {
    if (state.stage === 1) {
        calculateScore();
        state.stage = 2;
        displayVerseWords();
        return;
    }

    if (state.stage === 2) {
        if (state.verseOrderIndex < state.verseOrder.length - 1) {
            state.verseOrderIndex++;
            state.stage = 1;
            displayCurrentVerse();
        } else {
            showScoreScreen();
        }
    }
}

export async function loadSavedChaptersUI() {
    const chapters = await apiFetchSavedChapters();
    const savedChaptersContainer = document.getElementById("savedChaptersContainer");    console.log(chapters);

    savedChaptersContainer.innerHTML = "";

    if (chapters.length === 0) {
        savedChaptersContainer.innerHTML = "<p>No saved chapters</p>";
        return;
    }

 // Inside loadSavedChaptersUI() in render.js
chapters.forEach(chapter => {
    // 1. Create a parent row container
    const row = document.createElement("div");
    row.className = "bookmark-row";

    // 2. Create the main text label area (clicking this loads the chapter)
    const labelBtn = document.createElement("button");
    labelBtn.className = "bookmark-label-btn";
    labelBtn.textContent = `${chapter.book} ${chapter.chapter} (${chapter.translation})`;
    
    labelBtn.addEventListener("click", async () => {
        // ... Keep your exact same load chapter logic here ...
        state.selectedTranslation = chapter.translation;
        state.currentChapter = { chapter: chapter.chapter, verses: [] };
        
        if (document.getElementById("translationSelect")) {
            document.getElementById("translationSelect").value = chapter.translation;
        }
        
        await loadChapter();

        // Close out the modal panels
        const authOverlay = document.getElementById("authOverlay");
        if (authOverlay) {
            authOverlay.classList.add("hidden");
            document.getElementById("savedScreen").classList.add("hidden");
            document.getElementById("appSection").classList.remove("hidden");
            document.getElementById("authTitle").textContent = "Account!";
            document.getElementById("closeSaved").classList.add("hidden");
            document.getElementById("closeAuth").classList.remove("hidden");
        }
    });

    // 3. Create the dedicated delete "X" button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "bookmark-delete-btn";
    deleteBtn.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
    deleteBtn.title = "Delete bookmark";

// Inside your loadSavedChaptersUI() loop in render.js
deleteBtn.addEventListener("click", async (event) => {
    event.stopPropagation(); // Stop row loading row selection frames from triggering

    if (confirm(`Are you sure you want to delete the bookmark for ${chapter.book} ${chapter.chapter}?`)) {
        try {
            // Clean abstraction layer call!
            const data = await apiDeleteChapter({
                translation: chapter.translation,
                book_id: chapter.book_id,
                chapter: chapter.chapter
            });

            if (data.success) {
                // Smoothly slide row away out of the active DOM grid view list 
                row.style.opacity = "0";
                row.style.transform = "translateX(20px)";
                setTimeout(() => {
                    row.remove();
                    if (savedChaptersContainer.children.length === 0) {
                        savedChaptersContainer.innerHTML = "<p>No saved chapters found.</p>";
                    }
                }, 200);
            } else {
                alert(data.error || "Failed to remove bookmark.");
            }
        } catch (error) {
            console.error("Deletion interface handler error:", error);
            alert("Something went wrong trying to delete this item. Check your console logs.");
        }
    }
});

    // 4. Assemble the row pieces together
    row.appendChild(labelBtn);
    row.appendChild(deleteBtn);
    savedChaptersContainer.appendChild(row);
});
}

export async function loadSavedScoresUI() {
    try {
        const scores = await apiFetchSavedScores();
        const savedScoresContainer = document.getElementById("savedScoresContainerS");

        if (!savedScoresContainer) return;
        savedScoresContainer.innerHTML = "";

        if (!scores || scores.length === 0) {
            savedScoresContainer.innerHTML = "<p>No saved scores</p>";
            return;
        }

        scores.forEach(session => {
            const row = document.createElement("div");
            row.className = "saved-score-row";

            const infoDiv = document.createElement("div");
            infoDiv.className = "saved-score-info";

            const cleanDate = session.completed_at ? session.completed_at.slice(0, 10) : "";

            infoDiv.innerHTML = `
                <div class="saved-score-top">
                    <span class="saved-score-title">
                        ${session.book} ${session.chapter}
                    </span>
                    <span class="saved-score-percent">
                        ${Math.round(session.percentage)}%
                    </span>
                <div class="saved-score-meta">
                        <span>${session.score} / ${session.total_questions} correct</span>
                        <span>${session.translation} • ${session.difficulty}</span>
                        <span class ="saved-score-date">${cleanDate}</span>
                </div>
                <div class="mini-saved-progress">
                        <div class="mini-history-progress-fill" style="width: ${session.percentage}%"></div>
                </div>
                </div>
            `;

            const deleteBtn = document.createElement("button");
            deleteBtn.className = "score-delete-btn";
            deleteBtn.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
            deleteBtn.title = "Delete score";

                    deleteBtn.addEventListener("click", async () => {
                        event.stopPropagation();

                        if (confirm(`Are you sure you want to delete this score for ${session.book} ${session.chapter}?`)) {
                            try {
                                const data = await apiDeleteScore(session.id);

                                if (data.success) {
                                    row.style.opacity = "0";
                                    row.style.transform = "translateX(20px)";
                                    setTimeout(() => {
                                        row.remove();
                                        if (savedScoresContainer.children.length === 0) {
                                            savedScoresContainer.innerHTML = "<p>No saved scores found.</p>";
                                        }
                                    }, 200);
                                } else {
                                    alert(data.error || "Failed to delete score.");
                                }
                            } catch (error) {
                                console.error("Score deletion error:", error);
                                alert("Something went wrong trying to delete this score. Check your console logs.");
                            }
                        }
                    });

                    row.appendChild(infoDiv);
                    row.appendChild(deleteBtn);
                    savedScoresContainer.appendChild(row);
                });
            } catch (error) {
                console.error("Error loading saved scores:", error);
            }
}