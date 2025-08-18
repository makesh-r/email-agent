// import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import OpenAI from 'openai';
import { OPENAI_API_KEY, EMBEDDING_MODEL } from '../lib/config.js';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export const parseDocument = async (file) => {
    // const ext = file.name.split('.').pop().toLowerCase();

    // if (ext === 'pdf') {
    //     const data = await pdfParse(file.data);
    //     return data.text;
    // }

    // if (ext === 'docx') {
    //     const result = await mammoth.extractRawText({ buffer: file.data });
    //     return result.value;
    // }

    // if (ext === 'txt') {
    //     return file.data.toString('utf-8');
    // }

    // throw new Error('Unsupported file type');
};

export const chunkText = (text, chunkSize = 1000, overlap = 200) => {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
        chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
};

export const getEmbeddingsInBatches = async (textChunks, batchSize = 10) => {
    const results = [];

    for (let i = 0; i < textChunks.length; i += batchSize) {
        const batch = textChunks.slice(i, i + batchSize);

        const batchResults = await Promise.all(
            batch.map(async (chunk) => {
                const res = await openai.embeddings.create({
                    model: EMBEDDING_MODEL,
                    input: chunk,
                });
                return { text: chunk, embedding: res.data[0].embedding };
            })
        );

        results.push(...batchResults);
        // Optional: throttle requests to avoid OpenAI rate limits
        if (i + batchSize < textChunks.length) {
            await new Promise((r) => setTimeout(r, 200)); // 200ms delay between batches
        }
    }

    return results;
};


// Embed the query
export const embedQuery = async (query) => {
    const resp = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: query,
    });
    return resp.data[0].embedding;
}

