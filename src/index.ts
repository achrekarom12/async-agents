import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import { getChatAgent } from "./agents/chat-agent";

import { nanoid } from "nanoid";
const THREAD_ID = nanoid();
const RESOURCE_ID = "cli";

function ensureDataDir() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

async function streamReply(chatAgent: Awaited<ReturnType<typeof getChatAgent>>, question: string): Promise<void> {
  const output = await chatAgent.stream(question, {
    memory: { thread: THREAD_ID, resource: RESOURCE_ID },
  });

  for await (const chunk of output.fullStream) {
    if (chunk.type === 'text-delta') {
      process.stdout.write(chunk.payload.text);
    } else if (chunk.type === 'tool-output') {
      if (chunk.payload?.output?.type === 'text-delta') {
        process.stdout.write(chunk.payload.output.payload.text);
      } else if (chunk.payload?.output?.type === 'tool-call') {
        console.log(`\n[Subagent Tool Call: ${chunk.payload.output.payload.toolName}]`);
      } else if (chunk.payload?.output?.type === 'tool-result') {
        console.log(`\n[Subagent Tool Result: ${chunk.payload.output.payload.toolName}]`);
      }
    }
  }
}

async function runCli() {
  ensureDataDir();
  const chatAgent = await getChatAgent();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = () => {
    rl.question("\nAsk a question (or 'exit' to quit): ", async (line) => {
      const input = line.trim();
      if (!input) {
        ask();
        return;
      }
      if (input.toLowerCase() === "exit") {
        rl.close();
        process.exit(0);
      }

      try {
        await streamReply(chatAgent, input);
      } catch (err) {
        console.error("Error:", err);
      }
      ask();
    });
  };

  console.log("CLI chat (memory stored in ./data/agent.db). Type 'exit' to quit.\n");
  ask();
}

runCli();
