import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'scores.db');
const TOP_SCORES_LIMIT = 10;

let SQL = null;
let db = null;

// Persists the current in-memory database to disk so scores survive
// server restarts.
const persist = () => {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
};

export const initDb = async () => {
    SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    db.run(`
        CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            score INTEGER NOT NULL,
            stage INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    `);

    persist();
};

// Returns the current top 10 scores, highest first.
export const getTopScores = () => {
    const stmt = db.prepare(
        'SELECT id, name, score, stage, created_at FROM scores ORDER BY score DESC, created_at ASC LIMIT ?'
    );
    stmt.bind([TOP_SCORES_LIMIT]);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
};

// Determines whether a given score currently qualifies for the top 10
// (either there is room left, or it beats the current 10th place score).
export const qualifiesForTopScores = (score) => {
    const top = getTopScores();
    if (top.length < TOP_SCORES_LIMIT) return true;
    const lowest = top[top.length - 1];
    return score > lowest.score;
};

// Inserts a new score, trims the table down to the top 10 entries, and
// returns the refreshed leaderboard.
export const addScore = (name, score, stage) => {
    const insertStmt = db.prepare(
        'INSERT INTO scores (name, score, stage) VALUES (?, ?, ?)'
    );
    insertStmt.run([name, score, stage]);
    insertStmt.free();

    // Trim anything beyond the top 10 so the table never grows unbounded.
    db.run(`
        DELETE FROM scores WHERE id NOT IN (
            SELECT id FROM scores ORDER BY score DESC, created_at ASC LIMIT ${TOP_SCORES_LIMIT}
        );
    `);

    persist();
    return getTopScores();
};
