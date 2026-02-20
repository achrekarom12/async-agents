"use client";

import { useState, useEffect, useRef } from "react";
import { Send, User, Bot, Loader2 } from "lucide-react";
import { nanoid } from "nanoid";

interface Message {
    role: "user" | "assistant";
    content: string;
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
                            if (parsed.text) {
                                assistantMessage += parsed.text;
                                setMessages((prev) => {
                                    const newMessages = [...prev];
                                    newMessages[newMessages.length - 1].content = assistantMessage;
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
        <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
                <h1 className="text-xl font-semibold tracking-tight">AI Assistant</h1>
                <div className="text-xs text-gray-400 font-mono">{chatId}</div>
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
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === "user" ? "bg-black text-white" : "bg-blue-100 text-blue-600"
                                    }`}>
                                    {m.role === "user" ? <User size={16} /> : <Bot size={16} />}
                                </div>
                                <div
                                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${m.role === "user"
                                            ? "bg-black text-white rounded-tr-none"
                                            : "bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm"
                                        }`}
                                >
                                    {m.content || (isLoading && i === messages.length - 1 ? <Loader2 className="animate-spin" size={16} /> : "")}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </main>

            {/* Input */}
            <footer className="p-6 bg-white border-t border-gray-100">
                <div className="max-w-2xl mx-auto">
                    <form onSubmit={handleSubmit} className="relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type your message..."
                            className="w-full pl-5 pr-14 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="absolute right-2 top-2 bottom-2 px-4 bg-black text-white rounded-xl hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
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
