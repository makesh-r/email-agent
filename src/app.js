import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import emailRoutes from "./routes/emailRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
// import { ALLOWED_ORIGINS } from './lib/config.js';

const app = express();

// CORS configuration
const corsOptions = {
    // origin: ALLOWED_ORIGINS ? ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
    origin: true,
    credentials: true, // Allow cookies and authentication headers
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Disposition'] // Expose Content-Disposition for file downloads
};

// Enable file upload
app.use(fileUpload());

// Middleware
app.use(cors(corsOptions));
// app.options('*', cors(corsOptions)); // handle preflight
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
    }
}));

// Routes
app.get('/', (req, res) => res.send('Email Agent Backend Server is running!'));

// Authentication routes
app.use('/auth', authRoutes);

// Email routes
app.use('/email', emailRoutes);

// Upload routes
app.use('/files', fileRoutes);

// Appointment routes
app.use('/appointment', appointmentRoutes);

export default app;