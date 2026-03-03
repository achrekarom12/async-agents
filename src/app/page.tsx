"use client";

import {
    Conversation,
    ConversationContent,
    ConversationEmptyState,
    ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
    Message,
    MessageContent,
    MessageResponse,
} from "@/components/ai-elements/message";
import {
    PromptInput,
    PromptInputTextarea,
    PromptInputSubmit,
    PromptInputFooter,
} from "@/components/ai-elements/prompt-input";
import {
    Reasoning,
    ReasoningContent,
    ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
    Tool,
    ToolContent,
    ToolHeader,
    ToolInput,
    ToolOutput,
} from "@/components/ai-elements/tool";
import {
    Artifact,
    ArtifactHeader,
    ArtifactTitle,
    ArtifactDescription,
    ArtifactContent,
    ArtifactClose,
    ArtifactActions,
    ArtifactAction,
} from "@/components/ai-elements/artifact";
import {
    Confirmation,
    ConfirmationTitle,
    ConfirmationRequest,
    ConfirmationAccepted,
    ConfirmationRejected,
    ConfirmationActions,
    ConfirmationAction,
} from "@/components/ai-elements/confirmation";
import {
    Agent,
    AgentHeader,
    AgentContent,
    AgentInstructions,
    AgentTools,
    AgentTool,
} from "@/components/ai-elements/agent";
import { Badge } from "@/components/ui/badge";
import { Bot, Terminal, Download, Sparkles, Wrench, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ToolCall {
    id: string;
    name: string;
    args: any;
    result?: any;
    status?: "approval-requested" | "approved" | "rejected";
    runId?: string;
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    reasoning?: string;
    toolCalls?: ToolCall[];
}

export default function ChatPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [chatId, setChatId] = useState("");
    const [inputValue, setInputValue] = useState("");
    const [artifact, setArtifact] = useState<{
        title: string;
        description: string;
        content: string;
        language?: string;
    } | null>(null);
    const [agentId, setAgentId] = useState("chat-agent");
    const [availableAgents, setAvailableAgents] = useState<any[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const response = await fetch("http://127.0.0.1:8000/api/agents");
                const data = await response.json();
                setAvailableAgents(data);
            } catch (error) {
                console.error("Error fetching agents:", error);
            }
        };
        fetchAgents();
    }, []);

    useEffect(() => {
        setChatId(`chat_${nanoid()}`);
    }, []);

    const handleSubmit = async (message: { text: string }) => {
        if (!message.text.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: "user", content: message.text };
        setMessages((prev) => [...prev, userMessage]);
        setInputValue("");
        setIsLoading(true);

        try {
            const response = await fetch("http://127.0.0.1:8000/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: message.text,
                    chatId: chatId,
                    agentId: agentId,
                }),
            });

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = "";
            let assistantReasoning = "";

            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "", reasoning: "" },
            ]);

            let buffer = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split("\n\n");
                buffer = parts.pop() || "";

                for (const part of parts) {
                    const lines = part.split("\n");
                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const data = line.slice(6);
                            if (data === "[DONE]") {
                                break;
                            }
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.type === "text" && parsed.text) {
                                    assistantMessage += parsed.text;
                                    setMessages((prev) => {
                                        const newMessages = [...prev];
                                        const lastMessage = newMessages[newMessages.length - 1];
                                        if (lastMessage.role === "assistant") {
                                            lastMessage.content = assistantMessage;
                                        }
                                        return newMessages;
                                    });
                                } else if (parsed.type === "reasoning" && parsed.text) {
                                    assistantReasoning += parsed.text;
                                    setMessages((prev) => {
                                        const newMessages = [...prev];
                                        const lastMessage = newMessages[newMessages.length - 1];
                                        if (lastMessage.role === "assistant") {
                                            lastMessage.reasoning = assistantReasoning;
                                        }
                                        return newMessages;
                                    });
                                } else if (parsed.type === "tool-call") {
                                    setMessages((prev) => {
                                        const newMessages = [...prev];
                                        const lastMessage = newMessages[newMessages.length - 1];
                                        if (lastMessage.role === "assistant") {
                                            if (!lastMessage.toolCalls) lastMessage.toolCalls = [];
                                            const existingToolCall = lastMessage.toolCalls.find(tc => tc.id === parsed.toolCallId);
                                            if (existingToolCall) {
                                                existingToolCall.name = parsed.toolName;
                                                existingToolCall.args = parsed.args;
                                            } else {
                                                lastMessage.toolCalls.push({
                                                    id: parsed.toolCallId,
                                                    name: parsed.toolName,
                                                    args: parsed.args,
                                                });
                                            }
                                        }
                                        return newMessages;
                                    });
                                } else if (parsed.type === "tool-result") {
                                    setMessages((prev) => {
                                        const newMessages = [...prev];
                                        const lastMessage = newMessages[newMessages.length - 1];
                                        if (lastMessage.role === "assistant" && lastMessage.toolCalls) {
                                            const toolCall = lastMessage.toolCalls.find(tc => tc.id === parsed.toolCallId);
                                            if (toolCall) {
                                                toolCall.result = parsed.result;
                                                if (toolCall.name === "generate_artifact" || toolCall.name === "generateArtifact") {
                                                    setArtifact(parsed.result);
                                                }
                                            }
                                        }
                                        return newMessages;
                                    });
                                } else if (parsed.type === "tool-approval") {
                                    setMessages((prev) => {
                                        const newMessages = [...prev];
                                        const lastMessage = newMessages[newMessages.length - 1];
                                        if (lastMessage.role === "assistant") {
                                            if (!lastMessage.toolCalls) lastMessage.toolCalls = [];
                                            const existingToolCall = lastMessage.toolCalls.find(tc => tc.id === parsed.toolCallId);
                                            if (existingToolCall) {
                                                existingToolCall.runId = parsed.runId;
                                                existingToolCall.status = "approval-requested";
                                                existingToolCall.name = parsed.toolName;
                                                existingToolCall.args = parsed.args;
                                            } else {
                                                lastMessage.toolCalls.push({
                                                    id: parsed.toolCallId,
                                                    name: parsed.toolName,
                                                    args: parsed.args,
                                                    runId: parsed.runId,
                                                    status: "approval-requested"
                                                });
                                            }
                                        }
                                        return newMessages;
                                    });
                                }
                            } catch (e) {
                                console.error("Error parsing SSE data", e);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content:
                        "Sorry, something went wrong. Please check if the server is running.",
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToolApproval = async (toolCallId: string, runId: string, approved: boolean) => {
        setIsLoading(true);

        // Update local state to reflect the choice
        setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === "assistant" && lastMessage.toolCalls) {
                const toolCall = lastMessage.toolCalls.find(tc => tc.id === toolCallId);
                if (toolCall) {
                    toolCall.status = approved ? "approved" : "rejected";
                }
            }
            return newMessages;
        });

        try {
            const response = await fetch("http://127.0.0.1:8000/api/chat/approve", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    runId,
                    toolCallId,
                    approved,
                    chatId,
                    agentId,
                }),
            });

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let buffer = "";
            let assistantMessage = "";
            let assistantReasoning = "";

            // Get the current content and reasoning to append
            setMessages((prev) => {
                const last = prev[prev.length - 1];
                assistantMessage = last.content || "";
                assistantReasoning = last.reasoning || "";
                return prev;
            });

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split("\n\n");
                buffer = parts.pop() || "";

                for (const part of parts) {
                    const lines = part.split("\n");
                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const data = line.slice(6);
                            if (data === "[DONE]") break;
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.type === "text" && parsed.text) {
                                    assistantMessage += parsed.text;
                                    setMessages((prev) => {
                                        const newMessages = [...prev];
                                        const lastMessage = newMessages[newMessages.length - 1];
                                        if (lastMessage.role === "assistant") {
                                            lastMessage.content = assistantMessage;
                                        }
                                        return newMessages;
                                    });
                                } else if (parsed.type === "reasoning" && parsed.text) {
                                    assistantReasoning += parsed.text;
                                    setMessages((prev) => {
                                        const newMessages = [...prev];
                                        const lastMessage = newMessages[newMessages.length - 1];
                                        if (lastMessage.role === "assistant") {
                                            lastMessage.reasoning = assistantReasoning;
                                        }
                                        return newMessages;
                                    });
                                } else if (parsed.type === "tool-call") {
                                    setMessages((prev) => {
                                        const newMessages = [...prev];
                                        const lastMessage = newMessages[newMessages.length - 1];
                                        if (lastMessage.role === "assistant") {
                                            if (!lastMessage.toolCalls) lastMessage.toolCalls = [];
                                            const existingToolCall = lastMessage.toolCalls.find(tc => tc.id === parsed.toolCallId);
                                            if (existingToolCall) {
                                                existingToolCall.name = parsed.toolName;
                                                existingToolCall.args = parsed.args;
                                            } else {
                                                lastMessage.toolCalls.push({
                                                    id: parsed.toolCallId,
                                                    name: parsed.toolName,
                                                    args: parsed.args,
                                                });
                                            }
                                        }
                                        return newMessages;
                                    });
                                } else if (parsed.type === "tool-result") {
                                    setMessages((prev) => {
                                        const newMessages = [...prev];
                                        const lastMessage = newMessages[newMessages.length - 1];
                                        if (lastMessage.role === "assistant" && lastMessage.toolCalls) {
                                            const toolCall = lastMessage.toolCalls.find(tc => tc.id === parsed.toolCallId);
                                            if (toolCall) {
                                                toolCall.result = parsed.result;
                                                if (toolCall.name === "generate_artifact" || toolCall.name === "generateArtifact") {
                                                    setArtifact(parsed.result);
                                                }
                                            }
                                        }
                                        return newMessages;
                                    });
                                } else if (parsed.type === "tool-approval") {
                                    setMessages((prev) => {
                                        const newMessages = [...prev];
                                        const lastMessage = newMessages[newMessages.length - 1];
                                        if (lastMessage.role === "assistant") {
                                            if (!lastMessage.toolCalls) lastMessage.toolCalls = [];
                                            const existingToolCall = lastMessage.toolCalls.find(tc => tc.id === parsed.toolCallId);
                                            if (existingToolCall) {
                                                existingToolCall.runId = parsed.runId;
                                                existingToolCall.status = "approval-requested";
                                                existingToolCall.name = parsed.toolName;
                                                existingToolCall.args = parsed.args;
                                            } else {
                                                lastMessage.toolCalls.push({
                                                    id: parsed.toolCallId,
                                                    name: parsed.toolName,
                                                    args: parsed.args,
                                                    runId: parsed.runId,
                                                    status: "approval-requested"
                                                });
                                            }
                                        }
                                        return newMessages;
                                    });
                                }
                            } catch (e) {
                                console.error("Error parsing approval SSE data", e);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Approval error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = () => {
        if (!artifact) return;

        const blob = new Blob([artifact.content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${artifact.title.replace(/[/\\?%*:|"<>]/g, '-') || 'artifact'}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    return (
        <div className={cn(
            "flex h-screen w-full bg-background text-foreground font-sans transition-all duration-300",
            // artifact ? "max-w-full" : "max-w-4xl mx-auto px-4"
        )}>
            {/* Sidebar for Agent Selection & Info */}
            <aside className={cn(
                "bg-muted/5 border-r transition-all duration-300 flex flex-col relative",
                isSidebarOpen ? "w-80" : "w-12"
            )}>
                {isSidebarOpen ? (
                    <div className="flex flex-col h-full">
                        <header className="h-[65px] px-4 border-b flex items-center justify-between bg-background/50 backdrop-blur-sm">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Agents</h2>
                            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
                                <ChevronLeft size={16} />
                            </Button>
                        </header>
                        <ScrollArea className="flex-1 p-4">
                            <div className="space-y-6">
                                {/* Agent Selection */}
                                <div className="space-y-2">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-1">Select Agent</span>
                                    <div className="grid grid-cols-1 gap-2">
                                        {availableAgents.map((agent) => (
                                            <button
                                                key={agent.id}
                                                onClick={() => setAgentId(agent.id)}
                                                className={cn(
                                                    "flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 group",
                                                    agentId === agent.id
                                                        ? "bg-primary/5 border-primary shadow-sm"
                                                        : "bg-background hover:bg-muted/50 border-transparent"
                                                )}
                                            >
                                                <div className={cn(
                                                    "p-2 rounded-lg transition-colors",
                                                    agentId === agent.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                                )}>
                                                    {agent.id === "chat-agent" ? <Bot size={18} /> : <Sparkles size={18} />}
                                                </div>
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className="text-sm font-medium truncate">{agent.name}</span>
                                                    <span className="text-[10px] text-muted-foreground truncate">{agent.id}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Selected Agent Info using Agent Element */}
                                {availableAgents.find(a => a.id === agentId) && (
                                    <div className="space-y-4 pt-4 border-t">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-1">Agent Details</span>
                                        <Agent className="bg-background/50 backdrop-blur-sm border-muted/50">
                                            {(() => {
                                                const selectedAgent = availableAgents.find(a => a.id === agentId);
                                                return (
                                                    <>
                                                        <AgentHeader
                                                            name={selectedAgent.name}
                                                            model={selectedAgent.model}
                                                            className="border-b bg-muted/20"
                                                        />
                                                        <AgentContent className="p-4 space-y-4">
                                                            {selectedAgent.description && (
                                                                <div className="space-y-1.5">
                                                                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Description</span>
                                                                    <p className="text-xs text-muted-foreground leading-relaxed italic">
                                                                        {selectedAgent.description}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {selectedAgent.instructions && (
                                                                <AgentInstructions className="bg-muted/10 border-muted/20">
                                                                    {selectedAgent.instructions.slice(0, 150) + "..."}
                                                                </AgentInstructions>
                                                            )}

                                                            {selectedAgent.tools && selectedAgent.tools.length > 0 && (
                                                                <AgentTools type="single" collapsible={true} className="bg-transparent border-none">
                                                                    {selectedAgent.tools.map((tool: any, idx: number) => (
                                                                        <AgentTool
                                                                            key={tool.name}
                                                                            tool={{
                                                                                description: tool.description,
                                                                                //@ts-ignore
                                                                                jsonSchema: tool.jsonSchema
                                                                            } as any}
                                                                            value={`tool-${idx}`}
                                                                        />
                                                                    ))}
                                                                </AgentTools>
                                                            )}
                                                        </AgentContent>
                                                    </>
                                                );
                                            })()}
                                        </Agent>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                ) : (
                    <div className="flex flex-col items-center py-4 gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)}>
                            <ChevronRight size={16} />
                        </Button>
                        <div className="flex flex-col gap-3">
                            {availableAgents.map((agent) => (
                                <Button
                                    key={agent.id}
                                    variant={agentId === agent.id ? "default" : "ghost"}
                                    size="icon"
                                    onClick={() => setAgentId(agent.id)}
                                    className="h-9 w-9"
                                >
                                    {agent.id === "chat-agent" ? <Bot size={16} /> : <Sparkles size={16} />}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
            </aside>

            {/* Main Chat Section */}
            <div className={cn(
                "flex flex-col h-full transition-all duration-300 flex-1 min-w-0",
                artifact ? "w-1/2 border-r" : "w-full"
            )}>
                {/* Header */}
                <header className="h-[65px] flex items-center justify-between px-6 border-b bg-background/50 backdrop-blur-sm sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
                            <h1 className="text-sm font-semibold tracking-tight">
                                {availableAgents.find(a => a.id === agentId)?.name || "AI Assistant"}
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-2 py-1 bg-muted/30 rounded-full">
                            <div className="w-3 h-3 flex items-center justify-center bg-background rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono tracking-wider tabular-nums">
                                {chatId.split("_")[1]?.slice(0, 8)}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Messages */}
                <Conversation className="flex-1">
                    <ConversationContent>
                        {messages.length === 0 ? (
                            <ConversationEmptyState
                                icon={<Bot size={40} className="text-muted-foreground/50" />}
                                title="Welcome to AI Assistant"
                                description="Start a conversation! I can help you with your tasks."
                            />
                        ) : (
                            messages.map((m, i) => (
                                <Message key={i} from={m.role}>
                                    <MessageContent>
                                        {m.toolCalls && m.toolCalls.length > 0 && (
                                            <div className="flex flex-col gap-2 w-full mb-2">
                                                {m.toolCalls.map((tc, j) => {
                                                    if (tc.status === "approval-requested") {
                                                        return (
                                                            <Confirmation key={j} state="approval-requested" approval={{ id: tc.id }} className="mb-2">
                                                                <ConfirmationTitle className="flex items-center gap-2 bg-green-500/10 px-2 py-0.5 rounded-full">
                                                                    <span>Action Required</span>
                                                                    <Badge variant="outline" className="ml-auto font-mono text-[10px] bg-background/50">
                                                                        <Wrench className="size-3 mr-1" />
                                                                        {tc.name}
                                                                    </Badge>
                                                                </ConfirmationTitle>
                                                                <ConfirmationRequest>
                                                                    wants to execute this tool
                                                                </ConfirmationRequest>
                                                                <ConfirmationActions>
                                                                    <ConfirmationAction
                                                                        variant="ghost"
                                                                        onClick={() => handleToolApproval(tc.id, tc.runId!, false)}
                                                                    >
                                                                        Decline
                                                                    </ConfirmationAction>
                                                                    <ConfirmationAction
                                                                        onClick={() => handleToolApproval(tc.id, tc.runId!, true)}
                                                                    >
                                                                        Approve
                                                                    </ConfirmationAction>
                                                                </ConfirmationActions>
                                                            </Confirmation>
                                                        );
                                                    }

                                                    if (tc.status === "approved") {
                                                        return (
                                                            <Confirmation key={j} state="approval-responded" approval={{ id: tc.id, approved: true }} className="mb-2">
                                                                <ConfirmationTitle>Confirmed</ConfirmationTitle>
                                                                <ConfirmationAccepted>
                                                                    Execution of <strong>{tc.name}</strong> approved.
                                                                </ConfirmationAccepted>
                                                            </Confirmation>
                                                        );
                                                    }

                                                    if (tc.status === "rejected") {
                                                        return (
                                                            <Confirmation key={j} state="approval-responded" approval={{ id: tc.id, approved: false }} className="mb-2">
                                                                <ConfirmationTitle>Declined</ConfirmationTitle>
                                                                <ConfirmationRejected>
                                                                    Execution of <strong>{tc.name}</strong> cancelled.
                                                                </ConfirmationRejected>
                                                            </Confirmation>
                                                        );
                                                    }

                                                    return (
                                                        <Tool key={j} defaultOpen={false} className="mb-2">
                                                            <ToolHeader
                                                                type="dynamic-tool"
                                                                toolName={tc.name}
                                                                state={
                                                                    tc.result !== undefined
                                                                        ? "output-available"
                                                                        : "input-available"
                                                                }
                                                            />
                                                            <ToolContent>
                                                                <ToolInput input={tc.args} />
                                                                {tc.result !== undefined && (
                                                                    <ToolOutput
                                                                        output={
                                                                            <div className="bg-muted/50 p-2 rounded text-xs font-mono overflow-auto max-h-40 no-scrollbar">
                                                                                {typeof tc.result === "string"
                                                                                    ? tc.result
                                                                                    : JSON.stringify(tc.result, null, 2)}
                                                                            </div>
                                                                        }
                                                                        errorText={undefined}
                                                                    />
                                                                )}
                                                            </ToolContent>
                                                        </Tool>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {m.reasoning && (
                                            <Reasoning
                                                isStreaming={
                                                    isLoading && i === messages.length - 1
                                                }
                                            >
                                                <ReasoningTrigger />
                                                <ReasoningContent>{m.reasoning}</ReasoningContent>
                                            </Reasoning>
                                        )}
                                        {m.content && <MessageResponse>{m.content}</MessageResponse>}
                                        {isLoading &&
                                            i === messages.length - 1 &&
                                            m.role === "assistant" &&
                                            !m.content && (
                                                <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                                                    <Terminal size={14} />
                                                    <span>Thinking...</span>
                                                </div>
                                            )}
                                    </MessageContent>
                                </Message>
                            ))
                        )}
                    </ConversationContent>
                    <ConversationScrollButton />
                </Conversation>

                {/* Input */}
                <footer className="p-4 pb-8 max-w-4xl mx-auto w-full">
                    <PromptInput
                        onSubmit={(message) => handleSubmit(message)}
                        className="relative w-full"
                        inputGroupClassName="rounded-xl border bg-background shadow-sm focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500/40 focus-within:shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all duration-300 overflow-hidden"
                    >
                        <PromptInputTextarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Type your message..."
                            className="min-h-[44px] w-full resize-none border-0 bg-transparent px-4 py-3 focus-visible:ring-0 text-sm"
                        />
                        <PromptInputFooter className="px-4 pb-3">
                            <div className="flex items-center gap-2">
                                {/* Optional actions like attachments can go here */}
                            </div>
                            <PromptInputSubmit
                                disabled={isLoading || !inputValue.trim()}
                                status={isLoading ? "streaming" : "ready"}
                            />
                        </PromptInputFooter>
                    </PromptInput>
                </footer>
            </div>

            {/* Artifact Right Panel */}
            {artifact && (
                <div className="w-1/2 h-full p-4 overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
                    <Artifact className="h-full flex flex-col">
                        <ArtifactHeader>
                            <div className="flex flex-col">
                                <ArtifactTitle>{artifact.title}</ArtifactTitle>
                                <ArtifactDescription>{artifact.description}</ArtifactDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <ArtifactActions>
                                    <ArtifactAction
                                        icon={Download}
                                        tooltip="Download as Markdown"
                                        onClick={handleDownload}
                                    />
                                </ArtifactActions>
                                <ArtifactClose onClick={() => setArtifact(null)} />
                            </div>
                        </ArtifactHeader>
                        <ArtifactContent className="p-0 overflow-y-auto custom-scrollbar">
                            <div className="p-6">
                                <MessageResponse>{artifact.content}</MessageResponse>
                            </div>
                        </ArtifactContent>
                    </Artifact>
                </div>
            )}
        </div>
    );
}
