# Confidence Picks

> [!WARNING]
> This is an open-source repository that I'm using to learn Svelte.js and other modern web development techniques. Feel free to explore, but expect occasional experiments and learning-in-progress code!

This project is a full-stack web application that allows users to log in and join groups to make confidence picks in NFL games, competing against friends.

## Project Structure

This is a monorepo containing both frontend and backend applications:

```
confidence-picks/
├── frontend/                    # Svelte frontend application
│   ├── src/
│   │   ├── App.svelte          # Main Svelte component
│   │   ├── main.js             # Entry point
│   │   └── components/
│   │       └── Header.svelte   # Header component
│   ├── public/
│   │   ├── index.html          # Main HTML file
│   │   └── global.css          # Global styles
│   ├── package.json            # Frontend dependencies
│   ├── vite.config.js          # Vite build configuration
│   └── README.md
├── backend/                     # Express.js backend API
│   ├── src/
│   │   ├── app.js              # Main Express application
│   │   ├── config/
│   │   │   └── database.js     # PostgreSQL/Neon database config
│   │   └── routes/
│   │       └── api.js          # API routes
│   ├── package.json            # Backend dependencies
│   ├── vercel.json             # Vercel deployment config
│   └── .env                    # Environment variables (not in git)
├── .github/
│   └── workflows/
│       ├── deploy-frontend.yml # GitHub Pages deployment
│       └── deploy-backend.yml  # Vercel deployment
└── README.md                   # This file
```

## Tech Stack

### Frontend
- **Svelte** - Reactive UI framework
- **Vite** - Build tool and dev server
- **Deployed on:** GitHub Pages

### Backend
- **Express.js** - Web application framework
- **PostgreSQL** - Database (hosted on Neon)
- **Node.js** - Runtime environment
- **Deployed on:** Vercel

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
- Automatically deploys to GitHub Pages when changes are pushed to `frontend/` directory on the `main` branch
- Live at: https://dokun1.github.io/confidence-picks

### Backend  
- Automatically deploys to Vercel when changes are pushed to `backend/` directory on the `main` branch
- Live at: https://confidence-picks-eyb5l3nex-dokun1s-projects.vercel.app

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

This is a learning project, but contributions, suggestions, and feedback are welcome! Feel free to open issues or submit pull requests.

## License

This project is licensed under the MIT License.