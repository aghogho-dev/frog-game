// Thin client for the Express/sql.js high-score API (see `server/`).
// All requests go through the `/api/scores` endpoints, proxied by Vite in
// development (see `vite.config.js`).

export const fetchTopScores = async () => {
    try {
        const response = await fetch('/api/scores');
        if (!response.ok) return [];
        return await response.json();
    } catch (err) {
        console.error('Failed to fetch top scores:', err);
        return [];
    }
};

export const checkQualifiesForTopScores = async (score) => {
    try {
        const response = await fetch(`/api/scores/qualifies?score=${encodeURIComponent(score)}`);
        if (!response.ok) return false;
        const data = await response.json();
        return !!data.qualifies;
    } catch (err) {
        console.error('Failed to check high score qualification:', err);
        return false;
    }
};

export const submitScore = async (name, score, stage) => {
    try {
        const response = await fetch('/api/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, score, stage })
        });
        if (!response.ok) return [];
        return await response.json();
    } catch (err) {
        console.error('Failed to submit score:', err);
        return [];
    }
};
