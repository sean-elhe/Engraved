let book = null;
let currentChapter = null;

let stage = 1;
let verseMode = "ordered";

let verseOrder = [];
let verseOrderIndex = 0;

let currentVerseDisplay = null;

let correctCount = 0;
let totalHiddenWords = 0;
let verseScores = [];

let verseTime = 0;

let selectedInput = null;
let hintTimer = null;
let hintCount = 0;

let selectedTranslation = "ESV";
let selectedBook = "Genesis";
let selectedChapter = 1;

let tapTimer;


const difficultyLevels = ["Easy", "Medium", "Hard"];



async function loadTranslations() {
    const response = await fetch("/api/translations");
    const translations = await response.json();

    const translationSelect =
        document.getElementById("translationSelect");

    translationSelect.innerHTML = "";

    translations.forEach(item => {
        translationSelect.innerHTML += `
            <option value="${item.translation}">
                ${item.translation}
            </option>
        `;
    });

    translationSelect.value = selectedTranslation;
}

async function loadBooks() {
    const response = await fetch(
        `/api/books?translation=${selectedTranslation}`
    );

    const books = await response.json();

    const bookSelect =
        document.getElementById("bookSelect");

    bookSelect.innerHTML = "";

    books.forEach(book => {
        bookSelect.innerHTML += `
            <option value="${book.book}">
                ${book.book}
            </option>
        `;
    });

    bookSelect.value = selectedBook;
}

async function loadChapters() {
    const response = await fetch(
        `/api/chapters?translation=${selectedTranslation}&book=${selectedBook}`
    );

    const chapters = await response.json();

    const chapterSelect =
        document.getElementById("chapterSelect");

    chapterSelect.innerHTML = "";

    chapters.forEach(chapter => {
        chapterSelect.innerHTML += `
            <option value="${chapter}">
                ${chapter}
            </option>
        `;
    });

    chapterSelect.value = selectedChapter;
}

async function loadChapter() {
    const response = await fetch(
        `/api/chapter?translation=${selectedTranslation}&book=${selectedBook}&chapter=${selectedChapter}`
    );

    const verses = await response.json();

    currentChapter = {
        chapter: selectedChapter,
        verses: verses
    };

    book = {
        book: selectedBook
    };

    setupVerseOrder();
    resetScore();
    displayCurrentVerse();
}

function fillDifficultyDropdown() {
    const difficultySelect =
        document.getElementById("difficultySelect");

    difficultySelect.innerHTML = "";

    difficultyLevels.forEach(level => {
        difficultySelect.innerHTML += `
            <option value="${level}">
                ${level}
            </option>
        `;
    });
}

function displayCurrentVerse() {
    startVerseTime();

    const verse = verseOrder[verseOrderIndex];

    document.getElementById("reference").textContent =
        `${verse.book} ${verse.chapter}:${verse.verse}`;

    const difficulty =
        document.getElementById("difficultySelect").value;

    currentVerseDisplay =
        replacingWords(verse.text, difficulty);

    stage = 1;

    displayVerseWords();
    updateProgressBar();
}

function updateProgressBar() {

    const progressFill =
        document.getElementById("progressFill");

    const percent =
        ((verseOrderIndex) / verseOrder.length) * 100;

    progressFill.style.width = `${percent}%`;

    document.getElementById("progressCurrent").textContent =
        `${currentChapter.chapter}:${verseOrder[verseOrderIndex].verse}`;

    document.getElementById("progressTotal").textContent =
        `${verseOrderIndex}/${verseOrder.length}`;
}

function replacingWords(text, difficultyLevel = "Easy") {
    const difficultiesMap = {
        Easy: 0.20,
        Medium: 0.40,
        Hard: 0.60
    };

    const difficulty =
        difficultiesMap[difficultyLevel] ?? 0.25;

    const splitWords = text
        .split(/[ —]+/)
        .filter(word => word.trim() !== "");

    const replaceableIndices = splitWords
        .map((word, index) => ({ word, index }))
        .filter(item =>
            item.word.length >= 3 &&
            /[a-zA-Z]/.test(item.word)
        )
        .map(item => item.index);

    const count = Math.max(
        1,
        Math.round(replaceableIndices.length * difficulty)
    );

    const shuffledIndices = replaceableIndices
        .sort(() => Math.random() - 0.5);

    const indicesToReplace =
        new Set(shuffledIndices.slice(0, count));

    const hiddenWords = [];

    const wordList = splitWords.map((word, index) => {
        const isHidden = indicesToReplace.has(index);

        if (isHidden) {
            hiddenWords.push(word);
        }

        return {
            word,
            isHidden,
            index
        };
    });

    return {
        original: text,
        wordList,
        hiddenWords
    };
}

function displayVerseWords() {
    const verseText =
        document.getElementById("verseText");

    const savedInputs = {};

    document.querySelectorAll(".verseInput")
        .forEach(input => {
            savedInputs[input.dataset.index] = input.value;
        });

    verseText.innerHTML = "";

    currentVerseDisplay.wordList.forEach(item => {
        if (item.isHidden) {
            if (stage === 2) {
                const userInput =
                    savedInputs[item.index] || "";

                const isCorrect =
                    closeAnswer(userInput, item.word);

                verseText.innerHTML += `
                    <span class="${isCorrect ? "correctWord" : "wrongWord"}">
                        ${item.word}
                    </span>
                `;
            } else {
                verseText.innerHTML += `
                    <input
                        class="verseInput"
                        data-index="${item.index}"
                        data-answer="${item.word}"
                    />
                `;
            }
        } else {
            verseText.innerHTML += `
                <span>${item.word}</span>
            `;
        }

        verseText.innerHTML += " ";
    });

    if (stage === 1) {
        setupInputLogic();
    }
}

function closeAnswer(userAnswer, correctAnswer) {
    const cleanUser =
        userAnswer.toLowerCase().replace(/[^a-z]/g, "");

    const cleanCorrect =
        correctAnswer.toLowerCase().replace(/[^a-z]/g, "");

    return cleanUser === cleanCorrect;
}

function setupInputLogic() {
    const inputs =
        document.querySelectorAll(".verseInput");
    const hintBtn =
        document.getElementById("hintBtn")


    inputs.forEach((input, index) => {
        input.setAttribute("enterkethint", "next");

        input.addEventListener("focus", () => {
            selectedInput = input;
            hintBtn.classList.add("hidden");
            clearTimeout(hintTimer);
            hintTimer = setTimeout(() => {
                if (selectedInput === input) {
                    hintBtn.classList.remove("hidden")
                }
            }, 6000);
        });



        input.addEventListener("blur", () => {
            clearTimeout(hintTimer);
            hintTimer = null;  


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
            event.target.value = event.target.value
                .toLowerCase()
                .replace(/[^a-z]/g, "");

            const answer =
                event.target.dataset.answer.toLowerCase();

            event.target.style.width =
                `${Math.max(event.target.value.length + 2, 1)}ch`;

        });
    });
}

function calculateScore() {
    let verseCorrect = 0;
    let verseTotal = 0;

    currentVerseDisplay.wordList.forEach(item => {
        if (item.isHidden) {
            verseTotal++;

            const input = document.querySelector(
                `input[data-index="${item.index}"]`
            );

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

    correctCount += verseCorrect;
    totalHiddenWords += verseTotal;

    const currentVerse = verseOrder[verseOrderIndex];

    verseScores.push({
        chapter: currentVerse.chapter,
        verse: currentVerse.verse,
        correct: verseCorrect,
        total: verseTotal,
        time: getVerseElapsedTime()
    });
}

// function showScoreScreen() {
//     document.getElementById("practiceScreen")
//         .classList.add("hidden");

//     document.getElementById("scoreScreen")
//         .classList.remove("hidden");

//     const overallPercentage = 
//         ((correctCount / totalHiddenWords) * 100).toFixed(1);

//     const chapterTotalTime =
//         verseScores.reduce((sum, score) => sum + score.time, 0);

//     document.getElementById("scoreHeader").textContent =
//         `${book.book} ${currentChapter.chapter}`;
//     document.getElementById("scoreText").textContent =
//         `${correctCount}/${totalHiddenWords}
//         | (${overallPercentage}%)
//         | ${formatTime(chapterTotalTime)}`;

//     document.getElementById("translation").textContent =
//         `Translation: ${selectedTranslation}`;
//     document.getElementById("difficulty").textContent =
//         `Difficulty: ${document.getElementById("difficultySelect").value}`;
//     document.getElementById("hints").textContent =
//         `Hints used: ${hintCount}`;

//     const verseScoreList =
//         document.getElementById("verseScoreList");

//     verseScoreList.innerHTML = "";

//     verseScores.forEach(score => {

//         const versePercentage =
//             ((score.correct / score.total) * 100).toFixed(1);

//         verseScoreList.innerHTML += `
//             <p>
//                 ${score.chapter}:${score.verse}
//                 ~
//                 ${score.correct}/${score.total}
//                 | (${versePercentage}%)
//                 | ${formatTime(score.time)}
//             </p>
//         `;
//     });
// }

function showScoreScreen() {
  document.getElementById("practiceScreen").classList.add("hidden");
  document.getElementById("scoreScreen").classList.remove("hidden");

  

  const chapterTotalTime =
    verseScores.reduce((sum, score) => sum + score.time, 0);

  const percent =
    totalHiddenWords === 0
      ? 0
      : Math.round((correctCount / totalHiddenWords) * 100);


    chapterScore.innerHTML+= `
    <div class="chapter-score">
        <div class="chapter-score-top">
            <span class="chapter-score-title">${book.book} ${currentChapter.chapter}</span>
            <span class="chapter-score-percent">${percent}%</span>
        </div>
        
        <div class="chapter-score-meta">
            <span>${correctCount} / ${totalHiddenWords}</span>
            <span>${formatTime(chapterTotalTime)}</span>
        </div>
        
        <div class="big-progress">
            <div class="big-progress-fill" style="width: ${percent}%"></div>
        </div>
    </div>
    `;


  document.getElementById("translation").textContent =
    selectedTranslation;

  document.getElementById("difficulty").textContent =
    document.getElementById("difficultySelect").value;

  document.getElementById("hints").textContent =
    hintCount;


  const verseScoreList = document.getElementById("verseScoreList");
  verseScoreList.innerHTML = "";

  verseScores.forEach(score => {
    const versePercent =
      score.total === 0
        ? 0
        : Math.round((score.correct / score.total) * 100);

    verseScoreList.innerHTML += `
      <div class="verse-score">
        <div class="verse-score-top">
          <span class="verse-score-title">${currentChapter.chapter}:${score.verse}</span>
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

function shuffleArray(array) {
    return [...array].sort(() => Math.random() - 0.5);
}

function ensureNoSequences(list) {
    if (list.length <= 1) {
        return list;
    }

    let shuffledList = [...list];
    let attempts = 0;

    while (attempts < 50) {
        let hasSequence = false;

        for (let i = 0; i < shuffledList.length - 1; i++) {
            const currentVerseNumber =
                Number(shuffledList[i].verse);

            const nextVerseNumber =
                Number(shuffledList[i + 1].verse);

            if (nextVerseNumber === currentVerseNumber + 1) {
                hasSequence = true;
                break;
            }
        }

        if (!hasSequence) {
            return shuffledList;
        }

        shuffledList = shuffleArray(list);
        attempts++;
    }

    return shuffledList;
}

function setupVerseOrder() {
    if (!currentChapter || !Array.isArray(currentChapter.verses)) {
        verseOrder = [];
        return;
    }

    if (verseMode === "random") {
        verseOrder = ensureNoSequences(
            shuffleArray(currentChapter.verses)
        );
    } else {
        verseOrder = currentChapter.verses;
    }

    verseOrderIndex = 0;
}

function startVerseTime() {
    verseTime = Date.now();
}

function getVerseElapsedTime() {
    return Date.now() - verseTime;
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function resetScore() {
  document.getElementById("chapterScore").textContent = "";
  document.getElementById("verseScoreList").innerHTML = "";

  document.getElementById("translation").textContent = "";
  document.getElementById("difficulty").textContent = "";
  document.getElementById("hints").textContent = "";

     correctCount = 0;
     totalHiddenWords = 0;
     verseScores = [];
     verseTime = 0;
     hintCount = 0;
}

function clearInputs() {
    document.querySelectorAll(".verseInput")
        .forEach(input => {
            input.value = "";
        });
}

function handleNextInput(currentIndex, inputs) {
  const nextIndex =
    currentIndex < inputs.length - 1
      ? currentIndex + 1
      : null;

  if (nextIndex !== null) {
    inputs[nextIndex].focus();
    return;
  }

  handleNext();
}

function handleNext() {
    if (stage === 1) {
        calculateScore();
        stage = 2;
        displayVerseWords();
        return;
    }

    if (stage === 2) {
        if (verseOrderIndex < verseOrder.length - 1) {
        verseOrderIndex++;
        stage = 1;
        displayCurrentVerse();
        } else {
        showScoreScreen();
        }
    }
}

document
    .getElementById("translationSelect")
    .addEventListener("change", async event => {
        selectedTranslation = event.target.value;

        await loadBooks();

        selectedBook =
            document.getElementById("bookSelect").value;

        selectedChapter = 1;

        await loadChapters();
        await loadChapter();
    });

document
    .getElementById("bookSelect")
    .addEventListener("change", async event => {
        selectedBook = event.target.value;

        selectedChapter = 1;

        await loadChapters();
        await loadChapter();
    });

document
    .getElementById("chapterSelect")
    .addEventListener("change", async event => {
        selectedChapter = Number(event.target.value);

        await loadChapter();
    });

document
    .getElementById("difficultySelect")
    .addEventListener("change", () => {
        displayCurrentVerse();
    });



document
    .getElementById("nextBtn")
    .addEventListener("click", () => {

        if (tapTimer) {
            clearTimeout(tapTimer);
            tapTimer = null;

            showScoreScreen();
        
        } else {
            tapTimer = setTimeout(() => {

            if (stage === 1) {
                calculateScore();
                stage = 2;
                displayVerseWords();

                tapTimer = null;
                return;

            }

            if (stage === 2) {
                if (verseOrderIndex < verseOrder.length - 1) {
                    verseOrderIndex++;
                    stage = 1;
                    displayCurrentVerse();

                } else {
                    showScoreScreen(); 
                }
                 tapTimer = null;    
                }
            }, 250);
        }
    });

document
    .getElementById("clearBtn")
    .addEventListener("click", () => {

        if (tapTimer) {
            clearTimeout(tapTimer);
            tapTimer = null;

            verseOrderIndex = 0;
            resetScore();
            displayCurrentVerse();

        } else {
            tapTimer = setTimeout(() => {
                clearInputs();
                tapTimer = null;
            }, 250);
        }
    });

document
    .getElementById("hintBtn")
    .addEventListener("click", () => {


        if (tapTimer) {
            clearTimeout(tapTimer);
            tapTimer = null;

            displayCurrentVerse();

        } else {
            tapTimer = setTimeout(() => {
                hintCount++;

                if (!selectedInput) {
                    return;
                }

                const answer =
                    selectedInput.dataset.answer
                        .toLowerCase()
                        .replace(/[^a-z]/g, "");

                const current =
                    selectedInput.value
                        .toLowerCase()
                        .replace(/[^a-z]/g, "");

                if (current.length < answer.length) {
                    const newText =
                        answer.slice(0, current.length + 1);

                    selectedInput.value = newText;

                    selectedInput.focus();

                    selectedInput.setSelectionRange(
                        newText.length,
                        newText.length
                    );

                    selectedInput.dispatchEvent(
                        new Event("input")
                    );
                }

                tapTimer = null;
            }, 250);
        }
    });





document
    .getElementById("restartBtn")
    .addEventListener("click", () => {
        document.getElementById("scoreScreen")
            .classList.add("hidden");

        document.getElementById("practiceScreen")
            .classList.remove("hidden");

        verseOrderIndex = 0;
        resetScore();
        displayCurrentVerse();
    });

document
    .getElementById("modeSelect")
    .addEventListener("change", event => {
        verseMode = event.target.value;

        setupVerseOrder();
        displayCurrentVerse();
    });

const breakdownToggle =
  document.getElementById("breakdownToggle");

const verseScoreList =
  document.getElementById("verseScoreList");

const breakdownArrow =
  document.getElementById("breakdownArrow");

breakdownToggle.addEventListener("click", () => {

  verseScoreList.classList.toggle("show-dropdown");

  breakdownArrow.classList.toggle("rotate-arrow");

});

async function initializeApp() {
    fillDifficultyDropdown();
    await loadTranslations();
        selectedTranslation =
        document.getElementById("translationSelect").value;
    await loadBooks();
    selectedBook = "Psalm";
    document.getElementById("bookSelect").value =
        selectedBook;
    await loadChapters();
    selectedChapter = 23;
    document.getElementById("chapterSelect").value =
        selectedChapter;
    await loadChapter();

    const openBtn = document.getElementById("openSettings");
    const closeBtn = document.getElementById("closeSettings");
    const overlay = document.getElementById("settingsOverlay");

    openBtn.addEventListener("click", () => {
        overlay.classList.remove("hidden");
    });
    closeBtn.addEventListener("click", () => {
        overlay.classList.add("hidden")
    });
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            overlay.classList.add("hidden")
        }
    });

}

initializeApp();