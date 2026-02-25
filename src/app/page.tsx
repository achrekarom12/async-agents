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
    Tool,
    ToolContent,
    ToolHeader,
    ToolInput,
    ToolOutput,
} from "@/components/ai-elements/tool";
import { Bot, Terminal } from "lucide-react";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";

interface ToolCall {
    id: string;
    name: string;
    args: any;
    result?: any;
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    toolCalls?: ToolCall[];
}

export default function ChatPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [chatId, setChatId] = useState("");
    const [inputValue, setInputValue] = useState("");

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
            const response = await fetch("http://localhost:8000/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: message.text,
                    chatId: chatId,
                }),
            });

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = "";

            setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

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
                                } else if (parsed.type === "tool-call") {
                                    setMessages((prev) => {
                                        const newMessages = [...prev];
                                        const lastMessage = newMessages[newMessages.length - 1];
                                        if (lastMessage.role === "assistant") {
                                            if (!lastMessage.toolCalls) {
                                                lastMessage.toolCalls = [];
                                            }
                                            // Deduplicate by ID
                                            const exists = lastMessage.toolCalls.some(tc => tc.id === parsed.toolCallId);
                                            if (!exists) {
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
                                        if (
                                            lastMessage.role === "assistant" &&
                                            lastMessage.toolCalls
                                        ) {
                                            const toolCall = lastMessage.toolCalls.find(
                                                (tc) => tc.id === parsed.toolCallId
                                            );
                                            if (toolCall) {
                                                toolCall.result = parsed.result;
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

    return (
        <div className="flex flex-col h-screen bg-background text-foreground font-sans max-w-4xl mx-auto px-4">
            {/* Header */}
            <header className="flex items-center justify-between py-6">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <h1 className="text-sm font-semibold tracking-tight">AI Assistant</h1>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase">
                    {chatId.split("_")[1]?.slice(0, 8)}
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
                                            {m.toolCalls.map((tc, j) => (
                                                <Tool key={j} defaultOpen={false}>
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
                                            ))}
                                        </div>
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
    );
}
