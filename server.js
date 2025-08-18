import app from "./src/app.js";
import { run } from "@openai/agents";
import { emailAgent } from "./src/agents/emailAgent.js";

app.listen(8080, async () => {
    console.log('Server is running on port 8080');

    // try {
    //     const result = await run(emailAgent, `{
    //         "assistantEmail": "makesh@5xtechnologies.in,
    //         "customerEmail": "makesh.2167@gmail.com",
    //         "subject": "Test",
    //         "body": "Who are you?",
    //         "vector_store_id": "vs_683566293d6c8191969695488704080d"
    //     }`);
    //     console.log("Result:", result.finalOutput);
    //     console.log("type of result:", typeof result.finalOutput);
    //     console.log("type of result:", typeof JSON.parse(result.finalOutput));
    // } catch (error) {
    //     console.error("Error:", error);
    // }
});