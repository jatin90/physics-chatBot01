import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';
import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
import path from 'path';

// 1. CONFIGURATION: Load environment variables
// If we are NOT in production (i.e., on your laptop), load from .env file
if (process.env.NODE_ENV !== 'production') {
    dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

// 2. VALIDATION: Check if keys exist (Crucial for Railway)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const groqApiKey = process.env.GROQ_API_KEY;

if (!supabaseUrl || !supabaseKey || !groqApiKey) {
    console.error("❌ CRITICAL ERROR: Missing Environment Variables.");
    console.error("If on Railway: Check the 'Variables' tab.");
    console.error("If Local: Check your .env file.");
    process.exit(1);
}

// 3. INITIALIZATION: Connect to services
const supabase = createClient(supabaseUrl, supabaseKey);
const groq = new Groq({ apiKey: groqApiKey });

console.log("🚀 System initializing...");

// 4. THE APPLICATION
const app = new Elysia()
    .use(cors({
        origin: true, // This allows ANY website to talk to your backend
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }))
    .use(cors()) // <--- ALLOWS VERCEL TO CONNECT
    .state('model', null as any) // Store the AI model in memory so we don't reload it every time

    .post('/chat', async ({ body, store }) => {
        const { question, history = [] } = body as { question: string, history?: any[] };
        
        console.log(`📝 Question: "${question}"`);

        // 1. Load Embedding Model
        if (!store.model) {
            store.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        }

        // 2. Vectorize Question
        const output = await store.model(question, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data);

        // 3. Search Supabase
        const { data: documents, error } = await supabase.rpc('match_documents', {
            query_embedding: embedding,
            match_threshold: 0.3,
            match_count: 5,
        });

        if (error) {
            console.error("Supabase Error:", error);
            return { answer: "Error accessing library.", sources: [] };
        }

        const contextText = documents?.map((d: any) => d.content).join("\n---\n") || "";
        const uniqueSources = Array.from(new Set(documents?.map((d: any) => d.file_name)));

        // 4. Call Groq
        try {
            const completion = await groq.chat.completions.create({
                messages: [
                    { 
                        role: "system", 
                        content: `You are a Physics Professor. 
                        RULES:
                        1. Use the provided context to answer. 
                        2. Use LaTeX for math ($E=mc^2$). 
                        3. Do NOT show internal thinking or "Searching..." text.
                        4. Be direct and academic.` 
                    },
                    ...history,
                    { role: "user", content: `Context: ${contextText}\n\nQuestion: ${question}` }
                ],
                model: "qwen/qwen3-32b",
                temperature: 0.3, // Lower temperature = more factual
            });

            return { 
                answer: completion.choices[0].message.content,
                sources: uniqueSources 
            };

        } catch (err) {
            console.error("Groq Error:", err);
            return { answer: "The Professor is tired. (Groq Error)", sources: [] };
        }
    }) // <--- Make sure this closing bracket and parenthesis are here!

//"qwen/qwen3-32b"