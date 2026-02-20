import { getProvider } from "./src/client";
import { generateText } from "ai";

async function test() {
    try {
        const llm = await getProvider("GEMINI");
        const model = llm("gemini-1.5-flash"); // Testing with a known good name
        const { text } = await generateText({
            model,
            prompt: "Hello",
        });
        console.log("Response:", text);
    } catch (err) {
        console.error("Error:", err);
    }
}

test();
