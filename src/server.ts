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

        reply.raw.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*", // Explicit CORS for stream
        });

        console.log("Starting stream for chatId:", chatId);
        for await (const chunk of output.fullStream) {
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
            } else if (chunk.type === "finish") {
                reply.raw.write(`data: [DONE]\n\n`);
            }
        }
        console.log("Stream finished for chatId:", chatId);

        reply.raw.end();
    } catch (error) {
        console.error("Error in /api/chat:", error);
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
