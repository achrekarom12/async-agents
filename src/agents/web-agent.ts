import { Agent } from "@mastra/core/agent";
import { getProvider } from "../client";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { PARALLEL_API_KEY } from "../env";

let _webAgent: Agent | null = null;

const searchWebTool = createTool({
    id: "search_web",
    description: "Search the web and provide information.",
    inputSchema: z.object({
        query: z.string().describe("The search query"),
    }),
    requireApproval: true,
    execute: async (input) => {
        console.log(`Searching the web for: ${input.query}`);

        if (!PARALLEL_API_KEY) {
            throw new Error("PARALLEL_API_KEY is not defined in environment variables");
        }

        const response = await fetch("https://api.parallel.ai/v1beta/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": PARALLEL_API_KEY,
                "parallel-beta": "search-extract-2025-10-10",
            },
            body: JSON.stringify({
                objective: input.query,
                search_queries: [input.query],
                max_results: 10,
                excerpts: {
                    max_chars_per_result: 10000,
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Search API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        return {
            status: "success",
            results: data.results || data, // Handle both potential result structures
        };
    },
});

export async function getWebAgent(): Promise<Agent> {
    if (_webAgent) return _webAgent;
    const llm = await getProvider("GEMINI");
    _webAgent = new Agent({
        id: "web-agent",
        name: "Web Agent",
        description: "An agent that can search the web and provide information.",
        instructions: `You are a helpful assistant that can search the web and provide information.`,
        model: llm("gemini-2.5-flash-lite"),
        tools: {
            searchWeb: searchWebTool,
        },
    });
    return _webAgent;
}

