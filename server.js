const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const dbPath = path.join(__dirname, "data", "bibles.db");

console.log("Using database:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("DB open error:", err.message);
        return;
    }

    console.log("Database opened successfully.");
});
app.use(express.static(__dirname));

app.get("/api/verse", (req, res) => {
    const translation = req.query.translation || "KJV";
    const book = req.query.book || "Genesis";
    const chapter = Number(req.query.chapter || 1);
    const verse = Number(req.query.verse || 1);

    const sql = `
        SELECT book_id, book, chapter, verse, text, translation
        FROM verses
        WHERE translation = ?
          AND book = ?
          AND chapter = ?
          AND verse = ?
        LIMIT 1
    `;

    db.get(sql, [translation, book, chapter, verse], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (!row) {
            return res.status(404).json({ error: "Verse not found" });
        }

        res.json(row);
    });
});

app.get("/api/tables", (req, res) => {
    db.all(
        "SELECT name FROM sqlite_master WHERE type='table'",
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.json(rows);
        }
    );
});

app.get("/api/translations", (req, res) => {
    db.all(
        "SELECT DISTINCT translation FROM verses",
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.json(rows);
        }
    );
});

app.get("/api/translations", (req, res) => {
    db.all(
        "SELECT DISTINCT translation FROM verses ORDER BY translation",
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json(rows.map(row => row.translation));
        }
    );
});

app.get("/api/books", (req, res) => {
    const translation = req.query.translation || "NIV";

    db.all(
        `
        SELECT DISTINCT book_id, book
        FROM verses
        WHERE translation = ?
        ORDER BY book_id
        `,
        [translation],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json(rows);
        }
    );
});

app.get("/api/chapters", (req, res) => {
    const translation = req.query.translation || "NIV";
    const book = req.query.book || "Genesis";

    db.all(
        `
        SELECT DISTINCT chapter
        FROM verses
        WHERE translation = ?
          AND book = ?
        ORDER BY chapter
        `,
        [translation, book],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json(rows.map(row => row.chapter));
        }
    );
});

app.get("/api/chapter", (req, res) => {
    const translation = req.query.translation || "NIV";
    const book = req.query.book || "Genesis";
    const chapter = Number(req.query.chapter || 1);

    db.all(
        `
        SELECT book_id, book, chapter, verse, text, translation
        FROM verses
        WHERE translation = ?
          AND book = ?
          AND chapter = ?
        ORDER BY verse
        `,
        [translation, book, chapter],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json(rows);
        }
    );
});

app.get("/api/random", (req, res) => {

    const translation =
        req.query.translation || "NIV";

    const sql = `
        SELECT *
        FROM verses
        WHERE translation = ?
        ORDER BY RANDOM()
        LIMIT 1
    `;

    db.get(sql, [translation], (err, row) => {

        if (err) {
            return res.status(500).json({
                error: err.message
            });
        }

        res.json(row);
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});