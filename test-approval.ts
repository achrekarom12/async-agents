
import { getAzureAgent } from "./src/agents/azure-agent";

async function test() {
    const agent = await getAzureAgent();
    const output = await agent.stream("Create a VM called test-vm with Ubuntu and size Standard_DS1_v2", {
        memory: { thread: "test-thread", resource: "web" },
    });

    console.log("Run ID:", output.runId);

    for await (const chunk of output.fullStream) {
        console.log("Chunk type:", chunk.type);
        if (chunk.type === "tool-call") {
            console.log("Tool call payload:", JSON.stringify(chunk.payload, null, 2));
        }
        if (chunk.type === 'tool-output' && chunk.payload?.output?.type === 'tool-call') {
            console.log("Tool call in tool-output payload:", JSON.stringify(chunk.payload.output.payload, null, 2));
        }
        // Check for approval chunk
        if (chunk.type.includes('approval') || (chunk as any).type.includes('approval')) {
            console.log("Found approval chunk:", JSON.stringify(chunk, null, 2));
        }
    }
}

test().catch(console.error);
