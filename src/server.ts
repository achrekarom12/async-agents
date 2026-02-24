import Fastify from "fastify";
import cors from "@fastify/cors";
import { getChatAgent } from "./agents/chat-agent";

const fastify = Fastify({
    logger: true,
});

fastify.register(cors, {
    origin: true, // Allow all origins for development
});

fastify.post("/api/chat", async (request, reply) => {
    try {
        const { message, chatId } = request.body as { message: string, chatId: string };

        if (!message || !chatId) {
            return reply.status(400).send({ error: "message and chatId are required" });
        }

        console.log("Request received:", { message, chatId });

        const chatAgent = await getChatAgent();

        const output = await chatAgent.stream(message, {
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
            console.log("Chunk type:", chunk.type);
            if (chunk.type === "text-delta") {
                reply.raw.write(`data: ${JSON.stringify({ type: "text", text: chunk.payload.text })}\n\n`);
            } else if (chunk.type === "tool-call") {
                reply.raw.write(`data: ${JSON.stringify({
                    type: "tool-call",
                    toolName: chunk.payload.toolName,
                    args: chunk.payload.args
                })}\n\n`);
            } else if (chunk.type === "tool-result") {
                reply.raw.write(`data: ${JSON.stringify({
                    type: "tool-result",
                    toolName: chunk.payload.toolName,
                    result: chunk.payload.result
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
