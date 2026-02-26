import Fastify from "fastify";
import cors from "@fastify/cors";
import { getChatAgent } from "./agents/chat-agent";
import { getSkillfulAgent } from "./agents/skillful-agent";

const fastify = Fastify({
    logger: true,
});

fastify.register(cors, {
    origin: true, // Allow all origins for development
});

const handleStream = async (reply: any, output: any) => {
    reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
    });

    for await (const chunk of output.fullStream) {
        console.log("Chunk type:", chunk.type);
        if (chunk.type === "text-delta") {
            reply.raw.write(`data: ${JSON.stringify({ type: "text", text: chunk.payload.text })}\n\n`);
        } else if (chunk.type === "reasoning-delta" && 'payload' in chunk) {
            reply.raw.write(`data: ${JSON.stringify({ type: "reasoning", text: (chunk.payload as { text: string }).text })}\n\n`);
        } else if (chunk.type === "tool-output") {
            if (chunk.payload?.output?.type === "text-delta") {
                reply.raw.write(`data: ${JSON.stringify({ type: "text", text: chunk.payload.output.payload.text })}\n\n`);
            } else if (chunk.payload?.output?.type === "tool-call") {
                reply.raw.write(`data: ${JSON.stringify({
                    type: "tool-call",
                    toolName: chunk.payload.output.payload.toolName,
                    args: chunk.payload.output.payload.args,
                    toolCallId: chunk.payload.output.payload.toolCallId
                })}\n\n`);
            } else if (chunk.payload?.output?.type === "tool-result") {
                reply.raw.write(`data: ${JSON.stringify({
                    type: "tool-result",
                    toolName: chunk.payload.output.payload.toolName,
                    result: chunk.payload.output.payload.result,
                    toolCallId: chunk.payload.output.payload.toolCallId
                })}\n\n`);
            }
        } else if (chunk.type === "tool-call") {
            reply.raw.write(`data: ${JSON.stringify({
                type: "tool-call",
                toolName: chunk.payload.toolName,
                args: chunk.payload.args,
                toolCallId: chunk.payload.toolCallId
            })}\n\n`);
        } else if (chunk.type === "tool-result") {
            reply.raw.write(`data: ${JSON.stringify({
                type: "tool-result",
                toolName: chunk.payload.toolName,
                result: chunk.payload.result,
                toolCallId: chunk.payload.toolCallId
            })}\n\n`);
        } else if (chunk.type === "tool-call-approval") {
            reply.raw.write(`data: ${JSON.stringify({
                type: "tool-approval",
                toolName: chunk.payload.toolName,
                args: chunk.payload.args,
                toolCallId: chunk.payload.toolCallId,
                runId: chunk.runId
            })}\n\n`);
        } else if (chunk.type === "finish") {
            reply.raw.write(`data: [DONE]\n\n`);
        }
    }
    reply.raw.end();
};

fastify.post("/api/chat", async (request, reply) => {
    try {
        const { message, chatId, agentId } = request.body as { message: string, chatId: string, agentId?: string };

        if (!message || !chatId) {
            return reply.status(400).send({ error: "message and chatId are required" });
        }

        console.log("Request received:", { message, chatId, agentId });

        let agent;
        if (agentId === "skillful-agent") {
            agent = await getSkillfulAgent();
        } else {
            agent = await getChatAgent();
        }

        const output = await agent.stream(message, {
            memory: { thread: chatId, resource: "web" },
        });

        console.log("Starting stream for chatId:", chatId);
        await handleStream(reply, output);
        console.log("Stream finished for chatId:", chatId);
    } catch (error) {
        console.error("Error in /api/chat:", error);
        reply.status(500).send({ error: "Internal Server Error" });
    }
});

fastify.post("/api/chat/approve", async (request, reply) => {
    try {
        const { runId, toolCallId, agentId, approved, chatId } = request.body as { runId: string, toolCallId: string, agentId?: string, approved: boolean, chatId: string };

        if (!runId || !toolCallId || !chatId) {
            return reply.status(400).send({ error: "runId, toolCallId and chatId are required" });
        }

        let agent;
        if (agentId === "skillful-agent") {
            agent = await getSkillfulAgent();
        } else {
            agent = await getChatAgent();
        }

        let output;

        const approveParams = {
            runId,
            toolCallId,
            memory: { thread: chatId, resource: "web" },
        };

        try {
            if (approved) {
                output = await agent.approveToolCall(approveParams);
            } else {
                output = await agent.declineToolCall(approveParams);
            }
        } catch (error: any) {
            console.warn(`Approval failed on root agent: ${error.message}. Checking sub-agents...`);
            // @ts-ignore
            const subAgents = await agent.listAgents();
            let found = false;
            for (const subAgent of Object.values(subAgents) as any[]) {
                try {
                    if (approved) {
                        output = await subAgent.approveToolCall(approveParams);
                    } else {
                        output = await subAgent.declineToolCall(approveParams);
                    }
                    found = true;
                    break;
                } catch (subError) {
                    continue;
                }
            }
            if (!found) throw error;
        }

        await handleStream(reply, output);
    } catch (error) {
        console.error("Error in /api/chat/approve:", error);
        reply.status(500).send({ error: "Internal Server Error" });
    }
});

const start = async () => {
    try {
        await fastify.listen({ port: 8000, host: "0.0.0.0" });
        console.log("Server listening on http://localhost:8000");
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
