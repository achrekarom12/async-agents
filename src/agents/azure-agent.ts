import { Agent } from "@mastra/core/agent";
import { getProvider } from "../client";
import { createVMTool, updateVMTool, deleteVMTool } from "../tools/azure-tools";

let _azureAgent: Agent | null = null;

export async function getAzureAgent(): Promise<Agent> {
  if (_azureAgent) return _azureAgent;
  const llm = await getProvider("GEMINI");
  _azureAgent = new Agent({
    id: "azure-agent",
    name: "Azure Agent",
    description: "An agent that can create, update, and delete VM in Azure.",
    instructions: `You are a helpful assistant that can create, update, and delete VM in Azure.`,
    model: llm("gemini-2.5-flash-lite"),
    tools: {
      createVM: createVMTool,
      updateVM: updateVMTool,
      deleteVM: deleteVMTool,
    },
  });
  return _azureAgent;
}

