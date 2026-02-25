import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const generateArtifactTool = createTool({
    id: "generate_artifact",
    description: "Use this tool to display code, documents, or long-form content (like essays or poems) in a dedicated UI container on the right side of the screen.",
    inputSchema: z.object({
        title: z.string().describe("The title of the artifact"),
        description: z.string().describe("A short summary of the content"),
        content: z.string().describe("The main body of the artifact (text or code)"),
        language: z.string().optional().describe("The programming language for highlighting (e.g., 'markdown', 'typescript', 'text')"),
    }),
    execute: async (input) => {
        return input;
    },
});
