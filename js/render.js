// Core rendering functions that touch state and write layout adjustments
import { state, startVerseTime, getVerseElapsedTime, resetScore } from './state.js';
import { getBookName, getChapter, getBookId, showLoggedInUI, showLoggedOutUI } from './utils.js';
import { shuffleArray, ensureNoSequences, formatTime, closeAnswer, replacingWords } from './logic.js';
import { apiFetchTranslations, apiFetchBooks, apiFetchChapters, apiFetchChapter, apiCheckLogIn, apiFetchSavedChapters } from './api.js';
import { setupInputLogic } from './events.js'; // imported dynamically to bridge event setup

export async function loadTranslations() {
    const translations = await apiFetchTranslations();
    const translationSelect = document.getElementById("translationSelect");
    translationSelect.innerHTML = "";

    translations.forEach(item => {
        translationSelect.innerHTML += `
            <option value="${item.translation}">${item.translation}</option>
        `;
    });
    translationSelect.value = state.selectedTranslation;
}

export async function loadBooks() {
    const books = await apiFetchBooks(state.selectedTranslation);
    const bookSelect = document.getElementById("bookSelect");
    bookSelect.innerHTML = "";

    books.forEach(book => {
        bookSelect.innerHTML += `
            <option value="${book.book_id}">${book.book}</option>
        `;
    });

    if (bookSelect.options.length > 0 && bookSelect.selectedIndex === -1) {
        bookSelect.selectedIndex = 0;
    }
    console.log("Books loaded");
}

export async function loadChapters() {
    const chapters = await apiFetchChapters(state.selectedTranslation, getBookName());
    const chapterSelect = document.getElementById("chapterSelect");
    chapterSelect.innerHTML = "";

    chapters.forEach(chapter => {
        chapterSelect.innerHTML += `
            <option value="${chapter}">${chapter}</option>
        `;
    });
    chapterSelect.selectedIndex = 0;
}

export function setupVerseOrder() {
    if (!state.currentChapter || !Array.isArray(state.currentChapter.verses)) {
        state.verseOrder = [];
        return;
    }

    if (state.verseMode === "random") {
        state.verseOrder = ensureNoSequences(shuffleArray(state.currentChapter.verses));
    } else {
        state.verseOrder = state.currentChapter.verses;
    }
    state.verseOrderIndex = 0;
}

export async function loadChapter() {
    const verses = await apiFetchChapter(state.selectedTranslation, getBookName(), getChapter());

    if (!Array.isArray(verses)) {
        console.error("Invalid chapter response:", verses);
        return;
    }

    state.currentChapter = {
        chapter: getChapter(),
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
        if (item.isHidden) {
            if (state.stage === 2) {
                const userInput = savedInputs[item.index] || "";
                const isCorrect = closeAnswer(userInput, item.word);
                verseText.innerHTML += `
                    <span class="${isCorrect ? "correctWord" : "wrongWord"}">
                        ${item.word}
                    </span>
                `;
            } else {
                verseText.innerHTML += `
                    <input class="verseInput" data-index="${item.index}" data-answer="${item.word}"/>
                `;
            }
        } else {
            verseText.innerHTML += `<span>${item.word}</span>`;
        }
        verseText.innerHTML += " ";
    });

    if (state.stage === 1) {
        setupInputLogic();
    }
}

export function displayCurrentVerse() {
    startVerseTime();
    const verse = state.verseOrder[state.verseOrderIndex];
    document.getElementById("reference").textContent = `${verse.book} ${verse.chapter}:${verse.verse}`;

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

export function showScoreScreen() {
    document.getElementById("practiceScreen").classList.add("hidden");
    document.getElementById("scoreScreen").classList.remove("hidden");

    const chapterTotalTime = state.verseScores.reduce((sum, score) => sum + score.time, 0);
    const percent = state.totalHiddenWords === 0 ? 0 : Math.round((state.correctCount / state.totalHiddenWords) * 100);

    chapterScore.innerHTML += `
    <div class="chapter-score">
        <div class="chapter-score-top">
            <span class="chapter-score-title">${state.book?.book || getBookName()} ${state.currentChapter.chapter}</span>
            <span class="chapter-score-percent">${percent}%</span>
        </div>
        <div class="chapter-score-meta">
            <span>${state.correctCount} / ${state.totalHiddenWords}</span>
            <span>${formatTime(chapterTotalTime)}</span>
        </div>
        <div class="big-progress">
            <div class="big-progress-fill" style="width: ${percent}%"></div>
        </div>
    </div>
    `;

    document.getElementById("translation").textContent = state.selectedTranslation;
    document.getElementById("difficulty").textContent = document.getElementById("difficultySelect").value;
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
    console.log(chapters);

    savedChaptersContainer.innerHTML = "";

    if (chapters.length === 0) {
        savedChaptersContainer.innerHTML = "<p>No saved chapters</p>";
        return;
    }

    chapters.forEach(chapter => {
        const button = document.createElement("button");
        button.className = "savedChapterBtn";
        button.textContent = `${chapter.book} ${chapter.chapter}`;

        button.addEventListener("click", async () => {
            // Note: Assigning variables to window/globals or state context depending on setup
            state.selectedTranslation = chapter.translation; 
            state.currentChapter = chapter.chapter;
            // Execute view load
            await loadChapter();
        });
        savedChaptersContainer.appendChild(button);
    });
}