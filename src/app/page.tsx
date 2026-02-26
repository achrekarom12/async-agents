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
import { Bot, Terminal, Download, Sparkles } from "lucide-react";
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
            const response = await fetch("http://10.10.40.73:8000/api/chat", {
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
            const response = await fetch("http://10.10.40.73:8000/api/chat/approve", {
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
            "flex h-screen bg-background text-foreground font-sans transition-all duration-300",
            artifact ? "max-w-full" : "max-w-4xl mx-auto px-4"
        )}>
            {/* Main Chat Section */}
            <div className={cn(
                "flex flex-col h-full transition-all duration-300",
                artifact ? "w-1/2 border-r px-4" : "w-full"
            )}>
                {/* Header */}
                <header className="flex items-center justify-between py-6">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <h1 className="text-sm font-semibold tracking-tight">AI Assistant</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <Select value={agentId} onValueChange={setAgentId}>
                            <SelectTrigger size="sm" className="w-[140px] h-7 text-[10px] font-medium uppercase tracking-wider">
                                <SelectValue placeholder="Select Agent" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="chat-agent">
                                    <div className="flex items-center gap-2">
                                        <Bot size={12} />
                                        <span>Chat Agent</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="skillful-agent">
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={12} />
                                        <span>Skillful Agent</span>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase">
                            {chatId.split("_")[1]?.slice(0, 8)}
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
                                                                <ConfirmationTitle>
                                                                    Tool Call Approval Required
                                                                </ConfirmationTitle>
                                                                <ConfirmationRequest>
                                                                    Agent wants to call <strong>{tc.name}</strong> with args:
                                                                    <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-auto">
                                                                        {JSON.stringify(tc.args, null, 2)}
                                                                    </pre>
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
                                                                <ConfirmationTitle>Tool Call Approved</ConfirmationTitle>
                                                                <ConfirmationAccepted>
                                                                    You approved the call to <strong>{tc.name}</strong>.
                                                                </ConfirmationAccepted>
                                                            </Confirmation>
                                                        );
                                                    }

                                                    if (tc.status === "rejected") {
                                                        return (
                                                            <Confirmation key={j} state="approval-responded" approval={{ id: tc.id, approved: false }} className="mb-2">
                                                                <ConfirmationTitle>Tool Call Declined</ConfirmationTitle>
                                                                <ConfirmationRejected>
                                                                    You declined the call to <strong>{tc.name}</strong>.
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
                <footer className="py-6 pt-0">
                    <PromptInput
                        onSubmit={(message) => handleSubmit(message)}
                        className="relative w-full"
                        inputGroupClassName="rounded-xl border bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring overflow-hidden"
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
