import dotenv from 'dotenv';

dotenv.config();

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
export const AZURE_OPENAI_CHAT_API_KEY = process.env.AZURE_OPENAI_CHAT_API_KEY;
export const AZURE_OPENAI_CHAT_ENDPOINT = process.env.AZURE_OPENAI_CHAT_ENDPOINT;
export const PARALLEL_API_KEY = process.env.PARALLEL_API_KEY;
