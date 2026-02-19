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

//   for await (const chunk of output.fullStream) {
//     console.log(chunk.type, (chunk as any).payload, '\n');
//   }

  for await (const chunk of output.fullStream) {
    const payload = (chunk as { type: string; payload?: unknown }).payload as Record<string, unknown> | undefined;


    // Which agent/tool is being called (parent calling a tool)
    if (chunk.type === "tool-call-input-streaming-start" && payload?.toolName) {
      process.stdout.write(`\n→ Calling tool: ${payload.toolName}\n`);
    }
    if (chunk.type === "tool-call" && payload?.toolName) {
      const args = payload.args as Record<string, unknown> | undefined;
      if (args && Object.keys(args).length > 0) {
        process.stdout.write(`  args: ${JSON.stringify(args)}\n`);
      }
    }

    if (chunk.type === "text-delta" && chunk.payload?.text) {
      process.stdout.write(`${chunk.payload.text}`);
    }

    // Sub-agent events (nested inside tool-output)
    if (
      chunk.type === "tool-output" &&
      payload &&
      typeof payload === "object" &&
      payload.output &&
      typeof payload.output === "object"
    ) {
      const out = payload.output as {
        type?: string;
        payload?: { id?: string; text?: string };
        toolName?: string;
        args?: Record<string, unknown>;
      };
      if (out.type === "start" && out.payload?.id) {
        process.stdout.write(`  ↳ Agent running: ${out.payload.id}\n`);
      }
      // Sub-agent is calling one of its tools (toolName can be on out or out.payload)
      const subToolName = out.toolName ?? (out.payload as { toolName?: string } | undefined)?.toolName;
      if (out.type === "tool-call-input-streaming-start" && subToolName) {
        process.stdout.write(`    → Sub-agent calling tool: ${subToolName}\n`);
      }
      if (out.type === "tool-call" && subToolName) {
        const args = out.args ?? (out.payload as { args?: Record<string, unknown> } | undefined)?.args;
        if (args && typeof args === "object" && Object.keys(args).length > 0) {
          process.stdout.write(`      args: ${JSON.stringify(args)}\n`);
        }
      }
    }

    // Skip Gemini "code/API" hallucination (model outputs this instead of real tool calls)
    const isJunkToolOutput = (text: string) =>
      /<ctrl42>|default_api\.|call\s*\n\s*print\s*\(/i.test(text) || /print\s*\(\s*default_api\.\w+/.test(text);

    // Direct text from main agent
    if (chunk.type === "text-delta" && payload && typeof payload === "object" && typeof (payload as { text?: string }).text === "string") {
      const text = (payload as { text: string }).text;
      if (!isJunkToolOutput(text)) process.stdout.write(text);
    }

    // Text from sub-agent (embedded in tool-output)
    if (
      chunk.type === "tool-output" &&
      payload &&
      typeof payload === "object" &&
      payload.output &&
      typeof payload.output === "object"
    ) {
      const out = payload.output as { type?: string; payload?: { text?: string } };
      if (out.type === "text-delta" && out.payload && typeof out.payload.text === "string") {
        const text = out.payload.text;
        if (!isJunkToolOutput(text)) process.stdout.write(text);
      }
    }

    // Show sub-agent result (poem from poem-agent, or other agent output)
    if (chunk.type === "tool-result" && payload?.result && typeof payload.result === "object") {
      const result = payload.result as { poem?: string; text?: string };
      if (typeof result.poem === "string" && result.poem.trim()) {
        process.stdout.write(`\n${result.poem.trim()}\n`);
      } else if (typeof result.text === "string" && result.text.trim() && !isJunkToolOutput(result.text)) {
        process.stdout.write(`\n${result.text.trim()}\n`);
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
