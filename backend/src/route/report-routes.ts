import { Router } from 'express';
import failureSimulationMiddleware from '../middleware/failure-simulation-middleware.js';
import upload from '../middleware/upload-middleware.js';
import { createReport, getReports } from '../controller/report-controller.js';

const router = Router();
router.use(failureSimulationMiddleware);

// Create a report
router.post('/', upload.array('images', 5), createReport);

// Retrieve all reports
router.get('/', getReports);

export default router;
