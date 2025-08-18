import { tool } from "@openai/agents";
import { z } from "zod";
import { vectorSearchOA } from "../services/openaiService.js";

// Define tool schema using Zod
const vectorStoreSearchSchema = z.object({
    query: z.string().describe("The search query to run against the vector store."),
    vector_store_id: z.string().describe("The dynamic ID of the vector store."),
    // filters: z.record(z.any()).optional().describe("Optional filters to refine the search.")
});

export const vectorStoreSearchTool = tool({
    name: "dynamic_vector_store_search",
    description: "Searches any OpenAI vector store using a dynamic vector_store_id.",
    parameters: vectorStoreSearchSchema,
    execute: async ({ query, vector_store_id, }) => {
        return await vectorSearchOA(query, vector_store_id, {});
    }
});
