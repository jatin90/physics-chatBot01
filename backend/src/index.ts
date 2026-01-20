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
        
        console.log(`📝 Received Question: "${question}"`);

        // A. Load Embedding Model (Lazy Load)
        if (!store.model) {
            console.log("⚙️  Loading embedding model...");
            store.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        }

        // B. Convert User Question to Numbers (Vector)
        const output = await store.model(question, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data);

        // C. Search Supabase (RAG)
        const { data: documents, error } = await supabase.rpc('match_documents', {
            query_embedding: embedding,
            match_threshold: 0.3, // Lower threshold = more results, but maybe less relevant
            match_count: 5,
        });

        if (error) {
            console.error("Supabase Error:", error);
            return { answer: "I'm having trouble accessing my library right now." };
        }

        // D. Build Context String
        const context = documents?.map((d: any) => d.content).join("\n\n---\n\n") || "No specific textbook context found.";
        
        console.log(`📚 Found ${documents?.length || 0} relevant pages.`);

        // E. Send to Groq (The "Professor")
        try {
            const completion = await groq.chat.completions.create({
                messages: [
                    { 
                        role: "system", 
                        content: `You are a friendly and enthusiastic High School Physics Professor. 
                        Use the following context to answer the student's question clearly. 
                        If the answer is not in the context, use your general physics knowledge but mention that it wasn't in the provided notes.
                        
                        Context:
                        ${context}` 
                    },
                    ...history, // Include past conversation
                    { role: "user", content: question }
                ],
                model: "qwen/qwen3-32b", // Powerful and fast model
                temperature: 0.5,
            });

            return { 
                answer: completion.choices[0].message.content,
                sources: documents?.map((d: any) => d.file_name) || [] // Return source filenames
            };

        } catch (err) {
            console.error("Groq Error:", err);
            return { answer: "My brain is a bit foggy (Groq API Error). Please try again." };
        }
    })
    // 5. START SERVER
    // Railway assigns a random port in process.env.PORT. We must use it.
    .listen(process.env.PORT || 3001);

console.log(`🚀 BRAIN: Backend is running on port ${process.env.PORT || 3001}`);


//"qwen/qwen3-32b"