import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import notFound from './app/middlewares/notFound';
import config from './config';
import router from './app/routes';
import cookieParser from 'cookie-parser';
import { PaymentController } from './app/modules/payment/payment.controller';
import rateLimiter from './app/middlewares/rateLimiter';

const app: Application = express();

app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use((_: Request, res: Response, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
});

// Stripe webhook — MUST be before body parsers (needs raw body)
app.post(
    "/api/v1/payments/webhook",
    express.raw({ type: "application/json" }),
    PaymentController.handleStripeWebhookEvent
);

// CORS
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
}));

// Parsers
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/v1', rateLimiter);
app.use("/api/v1", router);

// Health check
app.get('/', (req: Request, res: Response) => {
    res.send({
        message: "🛒 E-Commerce Server is running..",
        environment: config.node_env,
        uptime: process.uptime().toFixed(2) + " sec",
        timeStamp: new Date().toISOString()
    })
});

// Global error handler
app.use(globalErrorHandler);

// Not found handler
app.use(notFound);

export default app;
