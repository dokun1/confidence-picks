import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import passport from './config/passport.js';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import groupsRoutes from './routes/groups.js';
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

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Confidence Picks API is running!' });
});

// Initialize database and start server
async function startServer() {
  try {
    // Skip database initialization in test environment if it's already done
    if (process.env.NODE_ENV !== 'test' || process.env.INIT_DB !== 'false') {
      console.log('Initializing database...');
      await initDatabase();
      console.log('Database initialized successfully');
    } else {
      console.log('Skipping database initialization in test environment');
    }

    // Start server for both local and production
    if (process.env.NODE_ENV !== 'production') {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    }
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

startServer();

export default app;