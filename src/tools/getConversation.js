import { tool } from '@openai/agents';
import { z } from 'zod';
import { db } from '../lib/firebaseAdmin.js';

export const getConversation = async (assistantEmail, customerEmail) => {
    console.log(`[getConversation] Fetching conversation for assistantEmail: ${assistantEmail} and customerEmail: ${customerEmail}`);

    const ref = await db.collection("emails")
        .where("assistantEmail", "==", assistantEmail)
        .where("customerEmail", "==", customerEmail)
        .get();

    if (!ref.empty) {
        const conversations = ref.docs.map(doc => ({
            ...doc.data(),
        }));

        console.log(`[getConversation] Found ${conversations.length} conversations for assistantEmail: ${assistantEmail} and customerEmail: ${customerEmail}`);
        return conversations;
    }

    console.log(`[getConversation] No conversation found for assistantEmail: ${assistantEmail} and customerEmail: ${customerEmail}`);
    return [];
};

export const saveConversation = async (assistantEmail, customerEmail, role, content) => {
    console.log(`[saveConversation] Adding the conversation for assistantEmail: ${assistantEmail} and customerEmail: ${customerEmail}`);

    try {
        const docRef = await db.collection("emails").add({
            assistantEmail: assistantEmail,
            customerEmail: customerEmail,
            role: role,
            content: content,
            createdAt: new Date().toISOString(),
        });

        await db.collection("emails").doc(docRef.id).update({
            id: docRef.id
        });

        console.log(`[saveConversation] Successfully added the conversation for assistantEmail: ${assistantEmail} and customerEmail: ${customerEmail}`);
        return "Conversation added successfully";
    } catch (error) {
        console.error('[saveConversation] Error saving conversation:', error);
        throw error;
    }
};

export const getUserSession = tool({
    name: 'get_user_session',
    description: 'Get a user session from Firestore',
    parameters: z.object({
        assistantEmail: z.string(),
        customerEmail: z.string(),
    }),
    execute: async ({ assistantEmail, customerEmail }) => {
        return await getConversation(assistantEmail, customerEmail);
    },
});

export const saveUserSession = tool({
    name: 'save_user_session',
    description: 'Save a user conversation in Firestore',
    parameters: z.object({
        assistantEmail: z.string(),
        customerEmail: z.string(),
        role: z.string(),
        content: z.object({
            subject: z.string(),
            body: z.string(),
        }),
    }),
    execute: async ({ assistantEmail, customerEmail, role, content }) => {
        return await saveConversation(assistantEmail, customerEmail, role, content);
    },
});


