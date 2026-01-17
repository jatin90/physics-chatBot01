import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';
import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
import path from 'path';

// This tells the script: "Look in the folder above me for the .env file"
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.SUPABASE_URL) {
    console.error("? ERROR: SUPABASE_URL is missing. Is your .env file in the 'backend' folder?");
    process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY!);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const app = new Elysia()
    .use(cors())              //add the vercel URL here, .use(cors({ origin: 'https://your-frontend-name.vercel.app' }))
    .state('model', null as any)
.post('/chat', async ({ body, store }) => {
    // 1. Lazy-load the embedding model
    if (!store.model) {
        console.log("🚀 Loading AI model...");
        store.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }

    // Pull 'history' from the frontend body
    const { question, history = [] } = body as { question: string, history?: any[] };

    // 2. Vectorize the current question
    const output = await store.model(question, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data);

    // 3. Search Database (RAG)
    const { data: documents, error } = await supabase.rpc('match_documents', {
        query_embedding: embedding,
        match_threshold: 0.3,
        match_count: 5,
    });

    if (error) return { error: error.message };

    // 4. Build Context from PDFs
    const context = documents?.map((d: any) => d.content).join("\n---\n") || "No manual context found.";

    // 5. Send History + Context to Groq
    const completion = await groq.chat.completions.create({
        messages: [
            { 
                role: "system", 
                content: `You are a helpful Physics Professor. Context: ${context}. 
                          Fluently use English and Hindi/Hinglish as requested.` 
            },
            ...history, // Past messages: [{role: "user", content: "..."}, {role: "assistant", content: "..."}]
            { role: "user", content: question }
        ],
        model: "qwen/qwen3-32b",
    });

    return { 
        answer: completion.choices[0].message.content,
        sources: documents?.map((d: any) => d.file_name) || []
    };
})
    .listen(3001);.listen(process.env.PORT || 3001);
	
console.log("?? BRAIN: Backend is running on http://localhost:3001");