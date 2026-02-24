"use client";

import { useState, useEffect, useRef } from "react";
import { Send, User, Bot, Loader2, ChevronDown, ChevronUp, Terminal } from "lucide-react";
import { nanoid } from "nanoid";

interface ToolCall {
    name: string;
    args: any;
    result?: any;
}

interface Message {
    role: "user" | "assistant";
    content: string;
    toolCalls?: ToolCall[];
}

function CollapsibleToolCall({ tc, index }: { tc: ToolCall, index: number }) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="w-full max-w-[320px] overflow-hidden text-[10px] font-sans border border-slate-100 rounded-lg bg-white/50 backdrop-blur-sm transition-all duration-300 hover:border-slate-200">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-2.5 py-1.5 flex items-center justify-between text-slate-400 hover:text-slate-600 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Terminal size={10} className={tc.result ? 'text-emerald-400' : 'text-slate-300'} />
                    <span className="font-medium tracking-tight">
                        {tc.name}
                    </span>
                </div>
                <div className="flex items-center gap-2 opacity-40">
                    {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                </div>
            </button>
            {isExpanded && (
                <div className="px-3 pb-3 pt-1 space-y-3 font-mono border-t border-gray-50">
                    <div>
                        <div className="text-[9px] text-gray-400 mb-1 uppercase tracking-widest font-bold">Input</div>
                        <pre className="text-gray-600 bg-gray-50 p-2 rounded-lg whitespace-pre-wrap break-all leading-relaxed">
                            {JSON.stringify(tc.args, null, 2)}
                        </pre>
                    </div>
                    {tc.result && (
                        <div>
                            <div className="text-[9px] text-emerald-500 mb-1 uppercase tracking-widest font-bold">Output</div>
                            <pre className="text-emerald-700 bg-emerald-50 p-2 rounded-lg whitespace-pre-wrap break-all leading-relaxed">
                                {typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [chatId, setChatId] = useState("");

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Generate chatId on mount
        setChatId(`chat_${nanoid()}`);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: "user", content: input };
        setMessages((prev) => [...prev, userMessage]);
        const currentInput = input;
        setInput("");
        setIsLoading(true);

        try {
            const response = await fetch("http://localhost:8000/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: currentInput,
                    chatId: chatId,
                }),
            });

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = "";

            setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split("\n");

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
                                        lastMessage.toolCalls.push({
                                            name: parsed.toolName,
                                            args: parsed.args
                                        });
                                    }
                                    return newMessages;
                                });
                            } else if (parsed.type === "tool-result") {
                                setMessages((prev) => {
                                    const newMessages = [...prev];
                                    const lastMessage = newMessages[newMessages.length - 1];
                                    if (lastMessage.role === "assistant" && lastMessage.toolCalls) {
                                        const toolCall = lastMessage.toolCalls.find(tc => tc.name === parsed.toolName && tc.result === undefined);
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
        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Sorry, something went wrong. Please check if the server is running." },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#fafafa] text-slate-900 font-sans">
            {/* Header */}
            <header className="flex items-center justify-between px-8 py-5">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <h1 className="text-sm font-medium text-slate-500 tracking-tight">Assistant Session</h1>
                </div>
                <div className="text-[10px] text-slate-300 font-mono tracking-widest uppercase">{chatId.split('_')[1]?.slice(0, 8)}</div>
            </header>

            {/* Messages */}
            <main className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="max-w-2xl mx-auto space-y-6">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-4">
                                <Bot size={32} />
                            </div>
                            <h2 className="text-2xl font-medium text-gray-800">How can I help you today?</h2>
                            <p className="text-gray-500 mt-2">Start a conversation with the AI assistant.</p>
                        </div>
                    )}

                    {messages.map((m, i) => (
                        <div
                            key={i}
                            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`flex gap-3 max-w-[80%] ${m.role === "user" ? "flex-row-reverse" : "flex-row"
                                    }`}
                            >
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity ${m.role === "user" ? "bg-slate-800 text-white" : "bg-white border border-slate-100 text-slate-400"
                                    }`}>
                                    {m.role === "user" ? <User size={14} /> : <Bot size={14} />}
                                </div>
                                <div
                                    className={`flex flex-col gap-2 max-w-[85%] ${m.role === "user" ? "items-end" : "items-start"
                                        }`}
                                >
                                    {m.toolCalls && m.toolCalls.length > 0 && (
                                        <div className="flex flex-col gap-1.5 w-full mb-1">
                                            {m.toolCalls.map((tc, j) => (
                                                <CollapsibleToolCall key={j} tc={tc} index={j} />
                                            ))}
                                        </div>
                                    )}

                                    <div
                                        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${m.role === "user"
                                            ? "bg-slate-900 text-white rounded-tr-none shadow-sm shadow-slate-200"
                                            : "bg-white border border-gray-100 text-gray-800 rounded-tl-none shadow-sm"
                                            }`}
                                    >
                                        {m.content || (isLoading && i === messages.length - 1 && (!m.toolCalls || m.toolCalls.length === 0) ? <Loader2 className="animate-spin opacity-40" size={14} /> : "")}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </main>

            {/* Input */}
            <footer className="p-8">
                <div className="max-w-2xl mx-auto">
                    <form onSubmit={handleSubmit} className="relative group">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask anything..."
                            className="w-full pl-6 pr-14 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/50 transition-all text-sm shadow-sm placeholder:text-slate-300"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="absolute right-2.5 top-2.5 bottom-2.5 px-4 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-300 transition-all shadow-sm"
                        >
                            {isLoading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Send size={18} />
                            )}
                        </button>
                    </form>
                    <p className="text-center text-[10px] text-gray-400 mt-3">
                        Powered by Mastra & Fastify. Responses may be inaccurate.
                    </p>
                </div>
            </footer>
        </div>
    );
}
