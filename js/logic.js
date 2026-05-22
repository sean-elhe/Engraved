// Pure algorithms and calculations. No DOM reading or writing.
export function shuffleArray(array) {
    return [...array].sort(() => Math.random() - 0.5);
}

export function ensureNoSequences(list) {
    if (list.length <= 1) {
        return list;
    }

    let shuffledList = [...list];
    let attempts = 0;

    while (attempts < 50) {
        let hasSequence = false;

        for (let i = 0; i < shuffledList.length - 1; i++) {
            const currentVerseNumber = Number(shuffledList[i].verse);
            const nextVerseNumber = Number(shuffledList[i + 1].verse);

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

export function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function closeAnswer(userAnswer, correctAnswer) {
    const cleanUser = userAnswer.toLowerCase().replace(/[^a-z]/g, "");
    const cleanCorrect = correctAnswer.toLowerCase().replace(/[^a-z]/g, "");
    return cleanUser === cleanCorrect;
}

export function replacingWords(text, difficultyLevel = "Easy") {
    const difficultiesMap = { Easy: 0.20, Medium: 0.40, Hard: 0.60 };
    const difficulty = difficultiesMap[difficultyLevel] ?? 0.25;

    const splitWords = text.split(/[ —]+/).filter(word => word.trim() !== "");

    const replaceableIndices = splitWords
        .map((word, index) => ({ word, index }))
        .filter(item => item.word.length >= 3 && /[a-zA-Z]/.test(item.word))
        .map(item => item.index);

    const count = Math.max(1, Math.round(replaceableIndices.length * difficulty));
    const shuffledIndices = replaceableIndices.sort(() => Math.random() - 0.5);
    const indicesToReplace = new Set(shuffledIndices.slice(0, count));

    const hiddenWords = [];
    const wordList = splitWords.map((word, index) => {
        const isHidden = indicesToReplace.has(index);
        if (isHidden) hiddenWords.push(word);
        return { word, isHidden, index };
    });

    return { original: text, wordList, hiddenWords };
}