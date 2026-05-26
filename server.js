const express = require("express");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, "data", "bibles.db");

app.use(express.json());

console.log("Using database:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("DB open error:", err.message);
        return;
    }

    console.log("Database opened successfully.");
});
app.use(express.static(__dirname));

app.use(session({
    secret: "replace-this-with-a-random-secret",
    resave: false,
    saveUninitalized: false,
    cookie: {
        secure: false
    }
}));

db.all(
    "SELECT name FROM sqlite_master WHERE type='table'",
    [],
    (err, rows) => {
        console.log(rows);
    }
);



// Bible routes

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

// User routes

app.post("/api/signup", async (req, res) => {

    const { name, pin } = req.body;
    const FIXED_LENGTH = 4;
    const numericRegex =
        new RegExp(`^[0-9]{${FIXED_LENGTH}}$`);

    if (!pin || !numericRegex.test(pin)) {
        return res.status(400).json({
            error: `PIN must be ${FIXED_LENGTH} digits long.`       
        });
    }

    try {
        const passwordHash =
            await bcrypt.hash(pin, 10);

        db.run(`
            INSERT INTO users (name, password_hash)
            VALUES (?, ?)
        `,
        [name, passwordHash],
        function(err) {

            if (err) {

                if (err.message.includes("UNIQUE")) {
                    return res.status(400).json({
                        error: "Name already exists"
                    });
                }

                return res.status(500).json({
                    error: err.message
                });
            }

            res.json({
                success: true,
                userId: this.lastID
            });

        });

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});

app.post("/api/login", async (req, res) => {

    const { name, pin } = req.body;

    db.get(`
        SELECT * FROM users
        WHERE name = ?
    `,
    [name],
    async (err, user) => {

        if (err) {
            return res.status(500).json(err);
        }

        if (!user) {
            return res.status(401).json({
                error: "Invalid credentials"
            });
        }

        const valid =
            await bcrypt.compare(
                pin,
                user.password_hash
            );

        if (!valid) {
            return res.status(401).json({
                error: "Invalid credentials"
            });
        }

        req.session.userId = user.id;

        res.json({
            success: true
        });

    });

});

app.get("/api/me", (req, res) => {
    if (!req.session.userId) {
        return res.json({
            loggedIn: false
        });
    }
    res.json({
        loggedIn: true,
        userId: req.session.userId
    })
})

app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({
            success:true
        });
    });
});

// Score routes

app.delete("/api/delete-chapter", async (req, res) => {
    // 1. Security Check: Ensure the user session is active
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ 
            success: false, 
            error: "Unauthorized. Please log in first." 
        });
    }

    // 2. Destructure the payload sent by your front-end script
    const { translation, book_id, chapter } = req.body;
    const userId = req.session.userId;

    // Validation Check: Ensure all identifiers are present
    if (!translation || !book_id || !chapter) {
        return res.status(400).json({ 
            success: false, 
            error: "Missing required properties (translation, book_id, or chapter)." 
        });
    }

    try {
        // 3. Database Execution Core
        // Replace this mockup query with your actual database engine tool (SQL, MongoDB, Firebase, etc.)
        
        /* --- Example for a SQL Database (SQLite / PostgreSQL) --- */
        const query = `
            DELETE FROM saved_chapters 
            WHERE user_id = ? AND translation = ? AND book_id = ? AND chapter = ?
        `;
        await db.run(query, [userId, translation, book_id, chapter]);
        
        /* --- Example for a MongoDB / Mongoose setup --- */
        // await SavedChapter.deleteOne({ userId, translation, book_id, chapter });


        // 4. Return a clean JSON confirmation block to the browser frontend
        return res.json({ 
            success: true, 
            message: "Bookmark successfully deleted." 
        });

    } catch (error) {
        console.error("Backend deletion database crash error:", error);
        return res.status(500).json({ 
            success: false, 
            error: "Internal server error mapping database deletion paths." 
        });
    }
});

app.post("/api/save-chapter", async (req, res) => {

    // Must be logged in
    if (!req.session.userId) {
        return res.status(401).json({
            error: "Not logged in"
        });
    }

    const userId =
        req.session.userId;

    const {
        translation,
        book_id,
        book,
        chapter
    } = req.body;

    db.run(`
        INSERT INTO saved_chapters (
            user_id,
            translation,
            book_id,
            book,
            chapter,
            verse
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
        userId,
        translation,
        book_id,
        book,
        chapter,

        // 0 = saved chapter
        0
    ],
    (err) => {

        if (err) {

            // Already saved
            if (
                err.message.includes("UNIQUE")
            ) {
                return res.status(400).json({
                    error: "Already saved"
                });
            }

            return res.status(500).json({
                error: err.message
            });
        }

        res.json({
            success: true
        });

    });

});

app.get("/api/saved-chapters", (req, res) => {

    if (!req.session.userId) {
        return res.status(401).json({
            error: "Not logged in"
        });
    }

    db.all(`
        SELECT
            translation,
            book_id,
            book,
            chapter,
            saved_at
        FROM saved_chapters
        WHERE user_id = ?
          AND verse = 0
        ORDER BY saved_at DESC
    `,
    [req.session.userId],
    (err, rows) => {

        if (err) {
            return res.status(500).json({
                error: err.message
            });
        }

        res.json(rows);

    });

});



app.post("/api/scores", (req, res) => {

    if (!req.session.userId) {
        return res.status(401).json({ error: "Not logged in" });
    }

    const userId = req.session.userId;
    const { score, totalQuestions } = req.body;

    db.run(`
        INSERT INTO user_scores (user_id, score, total_questions)
        VALUES (?, ?, ?)
    `, [userId, score, totalQuestions], (err) => {

        if (err) {
            return res.status(500).json({ error: err.message });
        }

        res.json({ success: true });

    });

});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});