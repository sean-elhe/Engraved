// Holds the live application state and simple data-mutators
export const state = {
    book: null,
    currentChapter: null,
    stage: 1,
    verseMode: "ordered",
    verseOrder: [],
    verseOrderIndex: 0,
    currentVerseDisplay: null,
    correctCount: 0,
    totalHiddenWords: 0,
    verseScores: [],
    verseTime: 0,
    selectedInput: null,
    hintTimer: null,
    hintCount: 0,
    selectedTranslation: "ESV",
    tapTimer: null,
    difficultyLevels: ["Easy", "Medium", "Hard"]
};

export function startVerseTime() {
    state.verseTime = Date.now();
}

export function getVerseElapsedTime() {
    return Date.now() - state.verseTime;
}

export function resetScore() {
    document.getElementById("chapterScore").textContent = "";
    document.getElementById("verseScoreList").innerHTML = "";

    document.getElementById("translation").textContent = "";
    document.getElementById("difficulty").textContent = "";
    document.getElementById("hints").textContent = "";

    state.correctCount = 0;
    state.totalHiddenWords = 0;
    state.verseScores = [];
    state.verseTime = 0;
    state.hintCount = 0;
}