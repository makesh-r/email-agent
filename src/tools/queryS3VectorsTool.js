// tools/queryS3VectorsTool.js
import { tool } from '@openai/agents';
import { z } from 'zod';
import { queryS3Vectors } from '../services/awsS3Service.js';

// Tool definition using SDK helper
export const queryS3VectorsTool = tool({
    name: 'query_documents',
    description: 'Search the document knowledge base for relevant text chunks based on a user query.',
    parameters: z.object({
        query: z.string().describe('The user\'s question to search the document store'),
        assistantId: z.string().describe('The assistant ID to filter results by'),
    }),
    async execute({ query, assistantId }) {
        return await queryS3Vectors({ query, assistantId });
    }
});
