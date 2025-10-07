import { Agent } from '@openai/agents';

export const dateTimeFormaterAgent = new Agent({
    name: 'DateTimeFormaterAgent',
    instructions: `
    You are a date and time formatter agent that formats the given date and time to the ISO format and returns the ISO format.
    The time will be in any format, like described in words or any other format. You need to format the date and time to the ISO format.
    You need to return the ISO format of the date and time.
    Eg. "23rd september 2025 at 10:00 AM" -> "2025-09-23T10:00:00Z"
    `,
    tools: [],
    on: {
        agent_start: (ctx, agent) => {
            console.log(`[${agent.name}] started`);
            console.log("DateTimeFormaterAgent started with input: ", ctx);
        }
    }
});