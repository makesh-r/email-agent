import axios from "axios";
import FormData from "form-data";
import { OPENAI_API_KEY } from "../lib/config.js";

/**
 * Uploads a file to OpenAI for fine-tuning.
 *
 * @param {string} filePath - Path to the local file (e.g., "./data.jsonl").
 * @param {string} openaiApiKey - Your OpenAI API key.
 * @returns {Promise<Object>} - Response data from OpenAI.
 */
export const uploadFileOA = async (file, purpose) => {

    const form = new FormData();
    form.append("purpose", purpose);
    // form.append("file", file);
    form.append("file", file.data, {
        filename: file.name,
        contentType: file.mimetype,
    });

    try {
        const response = await axios.post("https://api.openai.com/v1/files", form, {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                ...form.getHeaders()
            },
        });

        console.log("RESPONSE", response.data);
        return response.data.id;
    } catch (error) {
        console.error("Upload failed:", error?.response?.data || error.message);
        throw new Error("Failed to upload file to OpenAI.");
    }
}

/**
 * Creates a vector store using OpenAI's Assistants v2 API.
 *
 * @param {string} name - The name of the vector store.
 * @param {string} openaiApiKey - Your OpenAI API key.
 * @returns {Promise<Object>} - The created vector store object.
 */
export const createVectorStoreOA = async (userId) => {
    try {
        const response = await axios.post(
            "https://api.openai.com/v1/vector_stores",
            { name: `Email-Assistant-${userId}` },
            {
                headers: {
                    Authorization: `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );

        console.log("RESPONSE", response.data);
        return response.data.id;
    } catch (error) {
        console.error("Vector store creation failed:", error?.response?.data || error.message);
        throw new Error("Failed to create vector store.");
    }
}

/**
 * Attaches a file to a vector store using OpenAI's Assistants v2 API.
 *
 * @param {string} vectorStoreId - The ID of the vector store (e.g., "vs_abc123").
 * @param {string} fileId - The ID of the file to attach (e.g., "file-abc123").
 * @param {string} openaiApiKey - Your OpenAI API key.
 * @returns {Promise<Object>} - Response from the API.
 */
export const attachFileToVectorStoreOA = async (vectorStoreId, fileId) => {
    try {
        const response = await axios.post(
            `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`,
            { file_id: fileId },
            {
                headers: {
                    Authorization: `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2"
                }
            }
        );

        console.log("RESPONSE", response.data);
        return response.data;
    } catch (error) {
        console.error("Failed to attach file:", error?.response?.data || error.message);
        throw new Error("File attachment failed.");
    }
}

/**
 * Removes a file from a vector store in OpenAI (Assistants v2).
 *
 * @param {string} vectorStoreId - The ID of the vector store (e.g., "vs_abc123").
 * @param {string} fileId - The ID of the file to remove (e.g., "file-abc123").
 * @param {string} openaiApiKey - Your OpenAI API key.
 * @returns {Promise<Object>} - The API response.
 */
export const removeFileFromVectorStore = async (vectorStoreId, fileId) => {
    const url = `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files/${fileId}`;

    try {
        const response = await axios.delete(url, {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
                "OpenAI-Beta": "assistants=v2"
            }
        });

        return response.data;
    } catch (error) {
        console.error("❌ File removal failed:", error?.response?.data || error.message);
        throw new Error("Failed to remove file from vector store.");
    }
}

// Vector search in OpenAI
export const vectorSearchOA = async (query, vector_store_id, filters) => {
    try {
        const response = await axios.post(
            `https://api.openai.com/v1/vector_stores/${vector_store_id}/search`,
            {
                query,
                // filters: filters || {}
            },
            {
                headers: {
                    Authorization: `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const chunks = response.data.data.map((item, i) => {
            const content = item?.content?.[0]?.text || "No content found";
            return `Result ${i + 1} (${item.filename} - ${item.score}):\n${content}`;
        });

        return chunks.join("\n\n");
    } catch (err) {
        console.error("Vector search failed:", err?.response?.data || err.message);
        throw new Error("Vector search failed. Please verify the ID and query.");
    }
}