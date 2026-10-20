# Game

A simple browser-based 3D game built with [Three.js](https://threejs.org/) and bundled with [Vite](https://vitejs.dev/).

## Overview

The game renders a 3D scene containing a player, a map with houses/obstacles, and enemies that chase the player.
The score increases over time while the player survives. The scene, camera, renderer, player, map, houses, and
enemies are each implemented as separate components under `src/components`.

## Requirements

- Node.js (LTS version recommended)
- npm (comes bundled with Node.js)

## Setup

Install dependencies from within the `game` directory:

```bash
npm install
```

## Run

The game needs both the Vite dev server (frontend) and the high-score API server (backend) running at the same
time. In one terminal, start the high-score server:

```bash
npm run server
```

This starts an Express server on `http://localhost:3001` backed by a persistent SQLite database (via `sql.js`) at
`server/scores.db`, which stores the top 10 scores.

In another terminal, start the Vite development server:

```bash
npm run dev
```

This serves the game with hot-reloading, usually at `http://localhost:5173`, and proxies `/api/*` requests to the
high-score server (see `vite.config.js`).

## Scripts

| Script            | Description                                           |
|-------------------|--------------------------------------------------------|
| `npm run dev`     | Starts the Vite development server.                    |
| `npm run build`   | Builds a production-ready bundle into `dist/`.          |
| `npm run preview` | Serves the production build locally for preview.        |
| `npm run server`  | Starts the Express/SQLite high-score API server.         |

## High Scores

When a game ends, if the final score ranks within the all-time top 10 (persisted in the SQLite database), a modal
prompts the player to enter their name. The name and score are saved via the `/api/scores` endpoint, and the
updated top 10 leaderboard is then displayed at the bottom of the Game Over screen.

## Environment Variables

No environment variables are currently required to run the project.

TODO: document any environment variables here if/when they are introduced (e.g. via Vite's `.env` files).

## Tests

TODO: no automated tests are currently configured for this package. Add a test runner (e.g. Vitest) and a `test`
script here once tests are introduced.

## Project Structure

```
game/
├── index.html              # HTML entry point, loads src/main.js
├── public/                 # Static assets served as-is
├── src/
│   ├── main.js              # Application entry point: scene, lighting, game loop
│   ├── style.css            # Global styles
│   └── components/          # Three.js scene components
│       ├── Camera.js         # Camera setup
│       ├── Enemy.js          # Enemy creation/behavior
│       ├── House.js          # House/obstacle loading
│       ├── Map.js            # Map/ground creation
│       ├── Player.js         # Player creation/movement
│       └── Renderer.js       # WebGL renderer setup
├── server/                 # High-score API server
│   ├── index.js              # Express app exposing /api/scores endpoints
│   └── db.js                 # SQLite (sql.js) persistence layer
├── vite.config.js          # Vite config, proxies /api to the high-score server
├── package.json
└── package-lock.json
```

## License

This project is licensed under the terms of the [MIT License](../LICENSE) (see the repository root).
