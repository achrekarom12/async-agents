import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { getChatAgent } from "./agents/chat-agent";
import { getSkillfulAgent } from "./agents/skillful-agent";

const fastify = Fastify({
    logger: true,
});

fastify.register(cors, {
    origin: true,
});

type AgentId = "skillful-agent" | "chat-agent";

async function getAgentInfo(agentId: AgentId) {
    const agent: any = agentId === "skillful-agent" ? await getSkillfulAgent() : await getChatAgent();
    return {
        id: agentId,
        name: agent.name,
        description: agent.description || agent.getDescription?.(),
        instructions: agent.instructions || agent.getInstructions?.(),
        model: "gpt-5-mini",
        tools: Object.entries(agent.tools || {}).map(([name, tool]: [string, any]) => ({
            name,
            description: tool.description,
            jsonSchema: tool.jsonSchema || tool.inputSchema,
        })),
    };
}

fastify.get("/api/agents", async (request, reply) => {
    const agents = await Promise.all([
        getAgentInfo("chat-agent"),
        getAgentInfo("skillful-agent"),
    ]);
    return agents;
});

interface BaseChatRequest {
    chatId: string;
    agentId?: AgentId;
}

interface ChatRequest extends BaseChatRequest {
    message: string;
}

interface ApproveRequest extends BaseChatRequest {
    runId: string;
    toolCallId: string;
    approved: boolean;
}

const getAgent = async (agentId?: string) => {
    return agentId === "skillful-agent" ? getSkillfulAgent() : getChatAgent();
};

const sendSSE = (reply: FastifyReply, data: any) => {
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
};

const processChunk = (chunk: any): { type: string;[key: string]: any } | null => {
    const { type, payload, runId } = chunk;

    switch (type) {
        case "text-delta":
            return { type: "text", text: payload.text };
        case "reasoning-delta":
            return { type: "reasoning", text: payload.text };
        case "tool-call":
            return {
                type: "tool-call",
                toolName: payload.toolName,
                args: payload.args,
                toolCallId: payload.toolCallId,
            };
        case "tool-result":
            return {
                type: "tool-result",
                toolName: payload.toolName,
                result: payload.result,
                toolCallId: payload.toolCallId,
            };
        case "tool-call-approval":
            return {
                type: "tool-approval",
                toolName: payload.toolName,
                args: payload.args,
                toolCallId: payload.toolCallId,
                runId,
            };
        case "tool-output":
            if (payload?.output) {
                return processChunk({ ...payload.output, runId });
            }
            return null;
        default:
            return null;
    }
};

const handleStream = async (reply: FastifyReply, output: any) => {
    reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
    });

    try {
        for await (const chunk of output.fullStream) {
            console.log("Chunk type:", chunk.type);

            if (chunk.type === "finish") {
                reply.raw.write("data: [DONE]\n\n");
                continue;
            }

            const processed = processChunk(chunk);
            if (processed) {
                sendSSE(reply, processed);
            }
        }
    } catch (error) {
        console.error("Streaming error:", error);
    } finally {
        reply.raw.end();
    }
};

fastify.post("/api/chat", async (request: FastifyRequest<{ Body: ChatRequest }>, reply) => {
    const { message, chatId, agentId } = request.body;

    if (!message || !chatId) {
        return reply.status(400).send({ error: "message and chatId are required" });
    }

    try {
        const agent = await getAgent(agentId);
        const output = await agent.stream(message, {
            memory: { thread: chatId, resource: "web" },
        });

        await handleStream(reply, output);
    } catch (error) {
        console.error("Error in /api/chat:", error);
        reply.status(500).send({ error: "Internal Server Error" });
    }
});

fastify.post("/api/chat/approve", async (request: FastifyRequest<{ Body: ApproveRequest }>, reply) => {
    const { runId, toolCallId, agentId, approved, chatId } = request.body;

    if (!runId || !toolCallId || !chatId) {
        return reply.status(400).send({ error: "runId, toolCallId and chatId are required" });
    }

    try {
        const agent = await getAgent(agentId);
        const approveParams = {
            runId,
            toolCallId,
            memory: { thread: chatId, resource: "web" },
        };

        const executeAction = async (target: any) =>
            approved ? target.approveToolCall(approveParams) : target.declineToolCall(approveParams);

        let output;
        try {
            output = await executeAction(agent);
        } catch (error: any) {
            console.warn(`Approval failed on root agent: ${error.message}. Checking sub-agents...`);
            const subAgents = await (agent as any).listAgents();
            let found = false;

            for (const subAgent of Object.values(subAgents) as any[]) {
                try {
                    output = await executeAction(subAgent);
                    found = true;
                    break;
                } catch {
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
        const port = Number(process.env.PORT) || 8000;
        await fastify.listen({ port, host: "0.0.0.0" });
        console.log(`Server listening on http://localhost:${port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
