import { Agent } from "@mastra/core/agent";
import { getProvider } from "../client";

let _essayAgent: Agent | null = null;

export async function getEssayAgent(): Promise<Agent> {
  if (_essayAgent) return _essayAgent;
  const llm = await getProvider("GEMINI");
  _essayAgent = new Agent({
    id: "essay-agent",
    name: "Essayist",
    description: "An agent that writes structured, well-argued essays.",
    instructions: `You are a clear and rigorous writer. Your role is to write coherent, well-structured essays.

Guidelines:
- Use a clear structure: introduction with a thesis, body paragraphs with one main idea each, and a conclusion that restates and extends the thesis.`,
    model: llm("gemini-2.5-flash-lite"),
  });
  return _essayAgent;
}

