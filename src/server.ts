import express from 'express';
import { config } from './config.js';
import routes from './routes/index.js';

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Content-Type validation for POST/PATCH
app.use((req, res, next) => {
  if ((req.method === 'POST' || req.method === 'PATCH') && req.get('Content-Type') !== 'application/json') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Content-Type must be application/json'
    });
  }
  next();
});

// Routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// JSON parse error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid JSON'
    });
  }
  next(error);
});

// Error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.isDevelopment() ? error.message : 'Something went wrong'
  });
});

// Start server
if (!config.isTest()) {
  app.listen(config.server.port, () => {
    console.log(`Server running on port ${config.server.port} in ${config.server.env} mode`);
  });
}

export default app;
