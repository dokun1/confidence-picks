import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import passport from './config/passport.js';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import groupsRoutes from './routes/groups.js';
import picksRoutes from './routes/picks.js';
import invitesRoutes from './routes/invites.js';
import { initDatabase } from './database/init.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173',      // Local development
        'http://localhost:5175',      // Local development
        'http://localhost:4173',      // Vite preview
        'https://www.confidence-picks.com', // Production
        'https://confidence-picks.com', // Production
        'https://confidence-picks-frontend.vercel.app' // Vercel domain
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api', apiRoutes);
app.use('/auth', authRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/groups', picksRoutes);
app.use('/api/invites', invitesRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Confidence Picks API is running!' });
});

// Initialize database (optionally) and start server
async function startServer() {
  try {
    const env = process.env.NODE_ENV || 'development';
    const initFlag = process.env.INIT_DB;
    const shouldInit = (
      // In development & test, initialize unless explicitly disabled
      (env !== 'production' && initFlag !== 'false') ||
      // In production only when explicitly enabled
      (env === 'production' && initFlag === 'true')
    );

    if (shouldInit) {
      console.log(`[startup] INIT_DB flag allows schema sync (env=${env}, INIT_DB=${initFlag})`);
      await initDatabase();
      console.log('[startup] Database initialized successfully');
    } else {
      console.log(`[startup] Skipping schema initialization (env=${env}, INIT_DB=${initFlag})`);
    }

    // Only call listen() outside serverless production; Vercel will invoke handler per request
    if (env !== 'production') {
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    }
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

startServer();

export default app;