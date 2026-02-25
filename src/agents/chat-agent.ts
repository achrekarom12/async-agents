import * as fs from "fs";
import * as path from "path";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { getProvider } from "../client";
import { getPoemAgent } from "./poem-agent";
import { getEssayAgent } from "./essay-agent";
import { getFileSystemAgent } from "./filesystem-agent";

import { generateArtifactTool } from "../tools/artifact";

const dataDir = path.join(process.cwd(), "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, "agent.db");
const storage = new LibSQLStore({
  id: "cli-storage",
  url: `file:${dbPath}`,
});

let _chatAgent: Agent | null = null;

export async function getChatAgent(): Promise<Agent> {
  if (_chatAgent) return _chatAgent;
  const [llm, poemAgent, essayAgent, fileSystemAgent] = await Promise.all([
    getProvider("GEMINI"),
    getPoemAgent(),
    getEssayAgent(),
    getFileSystemAgent(),
  ]);
  _chatAgent = new Agent({
    id: "triage-agent",
    name: "Triage Agent",
    description: "Triage agent with capabilties to write poems and essays.",
    instructions: `You are a skilled triage agent. Your role is to triage the user's request and determine the best agent to use (poem or essay). 
Be concise and helpful. 
## Creative Writing — Artifact Generation

You have access to a 'createArtifact' tool. You MUST use it whenever generating essays or poems.

### When to Use 'createArtifact'
Trigger on ANY of these user intents:
- "Write me an essay/poem about..."
- "Can you compose/create/draft a poem/essay..."
- "I need an essay/poem on..."
- Any request that results in a poem or essay as the output

### How to Use
Call 'createArtifact' with:
- **title**: A descriptive title for the piece (e.g., "Essay: The Future of AI" or "Poem: Autumn Leaves")
- **content**: The full essay or poem text
- **type**: "essay" or "poem"

### Rules
1. NEVER paste the full essay or poem inline in chat — ALWAYS use the artifact tool
2. Generate the complete piece inside the tool call, not partially
3. After the artifact is created, provide ONLY a 1-2 sentence summary of what you wrote
4. If the user asks for edits, generate a NEW artifact with the updated content

### Anti-Patterns (DO NOT do these)
❌ Writing the poem/essay in your chat response instead of using the tool
❌ Saying "Here's your essay:" followed by the full text
❌ Asking "Would you like me to create an artifact?" — just do it
❌ Splitting the content between chat and artifact`,
    agents: {
      poemAgent,
      essayAgent,
      // fileSystemAgent,
    },
    tools: {
      generateArtifact: generateArtifactTool,
    },
    model: llm("gemini-2.5-flash-lite"),
    memory: new Memory({ storage }),

  });
  return _chatAgent;
}
