import { uploadFileOA, createVectorStoreOA, attachFileToVectorStoreOA, removeFileFromVectorStore } from "../services/openaiService.js";
import { getUserById, updateUserProfile } from "../services/authService.js";
import { sendSuccess, sendError } from "../utils/responseUtil.js";

export const handleUpload = async (req, res) => {
    console.log("REQ-FILES", req.files.file);
    try {
        if (!req.files?.file) {
            return sendError(res, 'No file uploaded', 400);
        }

        const file = req.files.file;
        const userId = req.params.userId;

        const user = await getUserById(userId);

        const vectorStoreId = user?.vectorStoreId || await createVectorStoreOA(userId);
        console.log("VECTOR-STORE-ID", vectorStoreId);

        const fileId = await uploadFileOA(file, "assistants");
        console.log("FILE-ID", fileId);

        const dataToUpdate = {
            vectorStoreId,
            files: [...(user?.files || []), {
                id: fileId,
                name: file.name,
                size: file.size,
                type: file.mimetype,
                createdAt: new Date().toISOString(),
                isEnabled: true,
            }]
        };

        await attachFileToVectorStoreOA(vectorStoreId, fileId);
        await updateUserProfile(userId, dataToUpdate);


        return sendSuccess(res, 'File uploaded successfully');

    } catch (err) {
        console.error(err);
        return sendError(res, 'Internal Server Error', 500);
    }
};

export const getFiles = async (req, res) => {
    const userId = req.params.userId;
    const user = await getUserById(userId);
    return sendSuccess(res, 'Files fetched successfully', { files: user?.files });
};

export const updatedFileStatus = async (req, res) => {
    const userId = req.params.userId;
    const { fileId, isEnabled } = req.body;
    const user = await getUserById(userId);
    const file = user.files.find(file => file.id === fileId);
    if (!file) {
        return sendError(res, 'File not found', 404);
    }
    file.isEnabled = isEnabled;
    await updateUserProfile(userId, { files: user.files });
    if (isEnabled) {
        await attachFileToVectorStoreOA(user.vectorStoreId, fileId);
    } else {
        await removeFileFromVectorStore(user.vectorStoreId, fileId);
    }
    return sendSuccess(res, 'File status updated successfully');
};

// export const deleteFile = async (req, res) => {
//     const { userId, fileId } = req.body;
//     const user = await getUserById(userId);

//     if (!user) {
//         return res.status(404).json({ error: 'User not found' });
//     }

//     const updatedFiles = user.files.filter(file => file.id !== fileId);
//     await updateUserProfile(userId, { files: updatedFiles });

//     return res.json({ message: 'File deleted successfully' });
// }