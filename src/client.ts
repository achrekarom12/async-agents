import { createGoogleGenerativeAI, GoogleGenerativeAIProvider } from '@ai-sdk/google';
import { createAzure, AzureOpenAIProvider } from '@ai-sdk/azure';
import { GEMINI_API_KEY, AZURE_OPENAI_CHAT_API_KEY, AZURE_OPENAI_CHAT_ENDPOINT } from './env';

type IProvider = GoogleGenerativeAIProvider | AzureOpenAIProvider;

export async function getProvider(providerName: string): Promise<IProvider> {
    switch (providerName) {
        case "GEMINI":
            if (!GEMINI_API_KEY) {
                throw new Error("GEMINI_API_KEY is not set");
            }
            return createGoogleGenerativeAI({
                apiKey: GEMINI_API_KEY,
            });
        case "AZURE":
            if (!AZURE_OPENAI_CHAT_API_KEY && !AZURE_OPENAI_CHAT_ENDPOINT) {
                throw new Error("AZURE_API_KEY is not set");
            }
            return createAzure({
                apiKey: AZURE_OPENAI_CHAT_API_KEY,
                baseURL: AZURE_OPENAI_CHAT_ENDPOINT,
            });
        default:
            throw new Error(`Unsupported provider: ${providerName}`);
    }
}