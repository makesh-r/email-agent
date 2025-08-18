import express from 'express';
import { handleUpload, getFiles, updatedFileStatus } from '../controllers/fileController.js';

const router = express.Router();

router.post('/upload/:userId', handleUpload);
router.get('/:userId', getFiles);
router.put('/update/:userId', updatedFileStatus);

export default router;
// This route handles file uploads for vector database.