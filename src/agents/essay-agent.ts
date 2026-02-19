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
- Use a clear structure: introduction with a thesis, body paragraphs with one main idea each, and a conclusion that restates and extends the thesis.
- Support claims with reasoning and, when relevant, examples or evidence.
- Use precise language and avoid filler. Vary sentence length for readability.
- Match formality to the topic: academic when appropriate, accessible when the audience is general.
- If the user provides a topic or question, address it directly. If they ask for a specific length or format (e.g. 5 paragraphs, op-ed), follow it.
- Respond with the essay itself unless the user asks for an outline, revision, or explanation.`,
    model: llm("gemini-2.5-flash-lite"),
  });
  return _essayAgent;
}
