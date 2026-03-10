import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFound } from './middleware/errorHandler';
import router from './routes';

const app = express();

// ── Security headers (OWASP / CBK IT security guidelines) ────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
}));

// ── CORS ─────────────────────────────────────────────────────────────────────
// Allowed origins: explicit list from CORS_ORIGINS env, the configured
// FRONTEND_URL, and any device on the local 172.16.12.0/24 LAN subnet.
const LAN_ORIGIN_RE = /^http:\/\/172\.16\.12\.\d{1,3}(:\d+)?$/;

const allowedOrigins = [
  config.FRONTEND_URL,
  // Support comma-separated extra origins from env
  ...(process.env.CORS_ORIGINS ?? '').split(',').map(o => o.trim()).filter(Boolean),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no Origin header)
    if (!origin) return callback(null, true);
    // Explicit allow-list
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // LAN subnet (172.16.12.x) – dev/pilot access from field laptops/tablets
    if (LAN_ORIGIN_RE.test(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate limiting (prevent brute-force) ──────────────────────────────────────
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(limiter);

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,  // 15 min
  max: 10,
  message: { error: 'Too many login attempts, please wait 15 minutes' },
});
app.use('/api/auth/login', authLimiter);

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(compression());

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
  skip: (req) => req.path === '/health',
}));

// ── Static uploads (served only to authenticated requests via the API) ───────
// Files are NOT served directly; use the /api/documents/:id route instead.

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', router);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 / Error ───────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
