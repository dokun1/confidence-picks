import express from 'express';

const router = express.Router();

// Simple timestamp route for testing
router.get('/timestamp', (req, res) => {
  const timestamp = new Date().toISOString();
  res.json({ timestamp });
});

export default router;
