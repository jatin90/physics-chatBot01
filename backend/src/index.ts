import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';
import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';

dotenv.config();

// 1. Setup Clients
const supabase = createClient(
  process.env.SUPABASE_URL!, 
  process.env.SUPABASE_KEY!
);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// 2. Start Elysia
const app = new Elysia()
    .use(cors())
    .state('model', null as any) // Store the AI model here to save memory
    
    // Health Check (Keeps Railway happy)
    .get('/', () => "⚛️ Physics Professor Server: ONLINE")

    // The Chat Logic
    .post('/chat', async ({ body, store }) => {
        const { question, history = [] } = body as { question: string, history?: any[] };
        
        console.log(`📝 Question Received: "${question}"`);

        try {
            // Load the embedding model if it's not already loaded
            if (!store.model) {
                console.log("📥 Loading Embedding Model...");
                store.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            }

            // Generate Vector for the question
            const output = await store.model(question, { pooling: 'mean', normalize: true });
            const embedding = Array.from(output.data);

            // Search Supabase for the best physics matches
            const { data: documents, error } = await supabase.rpc('match_documents', {
					query_embedding: embedding,
					match_threshold: 0.3,
					match_count: 5, // Keep this at 5 or 10. If it's 50, it might crash the RAM.
					});

            if (dbError) throw dbError;

            const contextText = documents?.map((d: any) => d.content).join("\n---\n") || "";
            const uniqueSources = Array.from(new Set(documents?.map((d: any) => d.file_name)));

            // Ask the Professor (Groq)
            const completion = await groq.chat.completions.create({
                messages: [
                    { 
                        role: "system", 
                        content: `You are a Physics Professor. 
                        RULES:
                        1. Use the provided context to answer. 
                        2. Use LaTeX for math (e.g., $E=mc^2$). 
                        3. Be direct. Do not show internal thinking.` 
                    },
                    ...history,
                    { role: "user", content: `Context: ${contextText}\n\nQuestion: ${question}` }
                ],
                model: "qwen/qwen3-32b",
                temperature: 0.3,
            });

            return { 
                answer: completion.choices[0].message.content,
                sources: uniqueSources 
            };

        } catch (err: any) {
            console.error("❌ Server Error:", err.message);
            return { answer: "The Professor is having trouble thinking. (Error)", sources: [] };
        }
    })
		// 1. Add a simple root route for the Healthcheck
			.get('/', () => ({ status: "Professor is Awake", version: "1.0.0" }))

			// 2. Use the dynamic PORT variable
			.listen(process.env.PORT || 3001, ({ hostname, port }) => {
				console.log(`🚀 BRAIN: Physics Professor is live at http://${hostname}:${port}`);
			});

//"qwen/qwen3-32b"