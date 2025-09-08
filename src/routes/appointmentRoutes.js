import express from 'express';
import {
    getAppointmentsCountController, getConfirmedAppointmentsCountController, getPendingAppointmentsCountController,
    getRejectedAppointmentsCountController
} from '../controllers/appointmentController.js';

const router = express.Router();

router.get('/count', getAppointmentsCountController);

router.get('/count/confirmed', getConfirmedAppointmentsCountController);

router.get('/count/pending', getPendingAppointmentsCountController);

router.get('/count/rejected', getRejectedAppointmentsCountController);

export default router;