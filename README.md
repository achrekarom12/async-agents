# Mastra Multi-Agents

A sophisticated multi-agent system built with [Mastra](https://mastra.ai), [Next.js](https://nextjs.org), and [Fastify](https://fastify.io). This project demonstrates how to build, deploy, and interact with multiple AI agents through various interfaces.

## 🚀 Features

- **Multi-Agent Architecture**: Includes specialized agents for general chat, essay writing, and poem generation.
- **Dual Interface**:
  - **CLI**: A terminal-based interface for direct interaction.
  - **Next.js Web App**: A modern, interactive web interface.
- **Fastify Backend**: A high-performance server handling streaming chat responses via Server-Sent Events (SSE).
- **Persistent Memory**: Seamless conversation history using Mastra's memory system (LibSQL).

## 🛠 Tech Stack

- **Framework**: [Mastra Core](https://mastra.ai)
- **Frontend**: Next.js 15+, React 19, Tailwind CSS
- **Backend**: Fastify, Vercel AI SDK
- **Runtime**: Node.js, TypeScript

## 🏁 Getting Started

### Prerequisites

- Node.js installed
- A `.env` file with your AI provider credentials (e.g., `GOOGLE_GENERATIVE_AI_API_KEY`)

### Installation

```bash
npm install
```

### Running the Project

#### 1. CLI Interface
To chat with the agent directly in your terminal:
```bash
npm run cli
```

#### 2. Fastify Server
To start the backend API server (runs on port 8000):
```bash
npm run server
```

#### 3. Next.js Web App
To start the development server for the web interface:
```bash
npm run dev
```
