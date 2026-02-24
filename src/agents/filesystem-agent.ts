import { Agent } from "@mastra/core/agent";
import { getProvider } from "../client";
import { Workspace, LocalFilesystem } from '@mastra/core/workspace'

let _fileSystemAgent: Agent | null = null;

export async function getFileSystemAgent(): Promise<Agent> {
  if (_fileSystemAgent) return _fileSystemAgent;
  const llm = await getProvider("GEMINI");
  _fileSystemAgent = new Agent({
    id: "filesystem-agent",
    name: "FileSystemAgent",
    description: "An agent that interacts with the file system.",
    instructions: `You are a helpful assistant that interacts with the file system.`,
    model: llm("gemini-2.5-flash-lite"),
    workspace: new Workspace({
      filesystem: new LocalFilesystem({
        basePath: '/Users/achrekarom/Downloads/STGs',
      }),
    })
  });
  return _fileSystemAgent;
}
