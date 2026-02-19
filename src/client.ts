import { createGoogleGenerativeAI, GoogleGenerativeAIProvider } from '@ai-sdk/google';
import { GEMINI_API_KEY } from './env';

type IProvider = GoogleGenerativeAIProvider;

export async function getProvider(providerName: string): Promise<IProvider> {
    switch (providerName) {
        case "GEMINI":
            if (!GEMINI_API_KEY) {
                throw new Error("GEMINI_API_KEY is not set");
            }
            return createGoogleGenerativeAI({
                apiKey: GEMINI_API_KEY,
            });
        default:
            throw new Error(`Unsupported provider: ${providerName}`);
    }
}