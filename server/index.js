import express from 'express';
import cors from 'cors';
import { initDb, getTopScores, addScore, qualifiesForTopScores } from './db.js';

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());

// Returns the persisted top 10 scores.
app.get('/api/scores', (req, res) => {
    res.json(getTopScores());
});

// Checks whether a given score currently qualifies for the top 10, without
// inserting it. Used by the client to decide whether to show the name entry
// modal after a game over.
app.get('/api/scores/qualifies', (req, res) => {
    const score = Number(req.query.score);
    if (!Number.isFinite(score)) {
        return res.status(400).json({ error: 'A numeric "score" query parameter is required.' });
    }
    res.json({ qualifies: qualifiesForTopScores(score) });
});

// Stores a new score (with the player's name) and returns the refreshed
// top 10 leaderboard.
app.post('/api/scores', (req, res) => {
    const { name, score, stage } = req.body || {};
    if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'A non-empty "name" is required.' });
    }
    if (!Number.isFinite(score)) {
        return res.status(400).json({ error: 'A numeric "score" is required.' });
    }
    const leaderboard = addScore(name.trim().slice(0, 20), Math.round(score), Number.isFinite(stage) ? Math.round(stage) : 1);
    res.json(leaderboard);
});

initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`High score server listening on http://localhost:${PORT}`);
    });
}).catch((err) => {
    console.error('Failed to initialize the scores database:', err);
    process.exit(1);
});
