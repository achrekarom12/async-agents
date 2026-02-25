import { z } from "zod";
import { generateText } from "ai";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { getProvider } from "../client";

const poemTopicSchema = z.object({
  topic: z.string().optional().describe("Theme or subject of the poem"),
});
// ... (omitting intermediate code for brevity, will use multi_replace if needed but let's try to do it cleanly)


const writeSadPoemTool = createTool({
  id: "write-sad-poem",
  description: "Write a short, melancholic poem. Use when the user wants a sad poem.",
  inputSchema: poemTopicSchema,
  execute: async ({ topic }) => {
    const llm = await getProvider("GEMINI");
    const model = llm("gemini-2.5-flash-lite");
    const { text } = await generateText({
      model,
      system: "You are a skilled poet. Write only the poem, no preamble. Use vivid imagery and a melancholic tone.",
      prompt: `Write a short sad poem${topic ? ` about ${topic}` : ""}. Return only the poem.`,
    });
    return { poem: text };
  },
});

const writeHappyPoemTool = createTool({
  id: "write-happy-poem",
  description: "Write a short, uplifting poem. Use when the user wants a happy or cheerful poem.",
  inputSchema: poemTopicSchema,
  execute: async ({ topic }) => {
    const llm = await getProvider("GEMINI");
    const model = llm("gemini-2.5-flash-lite");
    const { text } = await generateText({
      model,
      system: "You are a skilled poet. Write only the poem, no preamble. Use vivid imagery and an uplifting, cheerful tone.",
      prompt: `Write a short happy poem${topic ? ` about ${topic}` : ""}. Return only the poem.`,
    });
    return { poem: text };
  },
});

let _poemAgent: Agent | null = null;

export async function getPoemAgent(): Promise<Agent> {
  if (_poemAgent) return _poemAgent;
  const llm = await getProvider("GEMINI");
  _poemAgent = new Agent({
    id: "poem-agent",
    name: "Poet",
    description: "An agent that writes original poems in various styles and forms.",
    instructions: `You are a poet agent. You must use your tools to write poems.`,
    model: llm("gemini-2.5-flash-lite"),
    tools: {
      writeSadPoem: writeSadPoemTool,
      writeHappyPoem: writeHappyPoemTool,
    },
  });
  return _poemAgent;
}
