# Confidence Picks

> [!NOTE]
> Open-source learning project (Svelte + Express + Postgres). Expect occasional experiments.

This is a full-stack app where users authenticate, create or join groups, make weekly NFL confidence picks, view leaderboards, share invite links, and post simple group messages.

## Confidence Picks?

From [nfelo](https://www.nfeloapp.com/games/nfl-confidence-picks/):

> NFL confidence pools (also known as pick’ems) are season long prediction competitions typically held amongst office colleagues or friend groups. Each week, players pick straight up winners for every game and stack rank those picks based on how confident they are in their prediction. These are your "confidence picks."
When a player’s pick is correct, they’re awarded points based on how highly they ranked the game. Their most confident pick yields 16 points, their second most confident pick yields 15 points, and so on and so forth. The player with the most points across all games wins the pool, with prizes typically given for weekly and entire season.

## Project Structure

This is a monorepo containing both frontend and backend applications:

```
confidence-picks/
├── frontend/                    # Svelte frontend application
│   ├── src/
│   │   ├── App.svelte          # Root component / route switch
│   │   ├── main.js             # Entry point
│   │   └── components/         # Pages & UI pieces (groups, picks, invite, auth, etc.)
│   ├── public/
│   │   ├── index.html          # Main HTML file
│   │   └── global.css          # Global styles
│   ├── package.json            # Frontend dependencies
│   ├── vite.config.js          # Vite build configuration
│   └── README.md
├── backend/                     # Express.js backend API
│   ├── src/
│   │   ├── app.js              # Server bootstrap (conditional schema init)
│   │   ├── config/
│   │   │   └── database.js     # Postgres (Neon) config
│   │   ├── models/             # Data access (groups, picks, invites, users, games)
│   │   ├── routes/             # Route modules (groups, picks, invites, auth)
│   │   └── database/           # schema.sql + init script
│   ├── package.json            # Backend dependencies
│   ├── vercel.json             # Vercel deployment config
│   └── .env                    # Environment variables (not in git)
├── .github/
│   └── workflows/
│       ├── deploy-frontend.yml # Frontend deploy (Vercel)
│       └── deploy-backend.yml  # Backend deploy (Vercel)
└── README.md                   # This file
```

## Tech Stack

### Frontend
- **Svelte**
- **Vite** (dev/build)
- **Deployed on:** Vercel (https://www.confidence-picks.com)

### Backend
- **Express.js**
- **PostgreSQL** (Neon)
- **Node.js**
- **Invite links** with token + expiry + usage count
- **Deployed on:** Vercel (API: https://api.confidence-picks.com)

## Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm

### Frontend Development

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Run the development server:**
   ```bash
   pnpm run dev
   ```

4. **Open your browser:**
   ```
   http://localhost:5173
   ```

### Backend Development

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your database connection string
   ```

4. **Run the development server:**
   ```bash
   pnpm run dev
   ```

5. **API will be available at:**
   ```
   http://localhost:3001
   ```

## Deployment

### Frontend
- Deploys to Vercel when changes are pushed to `frontend/` on `main`
- Live: https://www.confidence-picks.com

### Backend  
- Deploys to Vercel when changes are pushed to `backend/` on `main`
- Primary API: https://api.confidence-picks.com

## Building for Production

### Frontend
```bash
cd frontend
pnpm run build
```

### Backend
```bash
cd backend
pnpm run start
```

## Contributing

Contributions (small fixes / suggestions) are welcome. Feel free to open issues or PRs.

## License

This project is licensed under the MIT License.