import * as fs from "fs";
import * as path from "path";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { getProvider } from "../client";
import { getPoemAgent } from "./poem-agent";
import { getEssayAgent } from "./essay-agent";
import { getFileSystemAgent } from "./filesystem-agent";

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
    description: "Triage agent with chat memory for CLI conversations.",
    instructions: `You are a skilled triage agent. Your role is to triage the user's request and determine the best agent to use (poem or essay). Be concise and helpful.`,
    agents: {
      // poemAgent,
      // essayAgent,
      fileSystemAgent,
    },
    model: llm("gemini-2.5-flash-lite"),
    memory: new Memory({ storage }),
  });
  return _chatAgent;
}
