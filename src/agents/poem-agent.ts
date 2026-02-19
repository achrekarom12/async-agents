import { z } from "zod";
import { generateText } from "ai";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { getProvider } from "../client";

const poemTopicSchema = z.object({
  topic: z.string().optional().describe("Theme or subject of the poem"),
});

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
    instructions: `You are a poet agent. You must use your tools to write poems—do not write poems yourself.

Critical: Use ONLY the built-in tool call mechanism to invoke writeSadPoem or writeHappyPoem. Never output code, print statements, API call syntax, or any representation of function calls (no Python, no "default_api", no "call" or similar). The only way to produce a poem is to call the tool; then return the poem from the tool result to the user.

Tool use:
- When the user wants a sad, melancholic, or somber poem, call the writeSadPoem tool. Pass an optional topic if they give a theme or subject.
- When the user wants a happy, cheerful, or uplifting poem, call the writeHappyPoem tool. Pass an optional topic if they give a theme or subject.
- If the mood is unclear, infer from words like "sad", "happy", "melancholic", "joyful", "gloomy", "celebratory", etc., and use the matching tool.
- After the tool returns the poem, present only that poem to the user (you may add a brief line like "Here's your poem:"). Do not add your own verses; only relay the tool result.
- For any other poem request (e.g. no mood specified), choose the tool that best fits the context or ask the user to specify sad or happy.`,
    model: llm("gemini-2.5-flash-lite"),
    tools: {
      writeSadPoem: writeSadPoemTool,
      writeHappyPoem: writeHappyPoemTool,
    },
  });
  return _poemAgent;
}
