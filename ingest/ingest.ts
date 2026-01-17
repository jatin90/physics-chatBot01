import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import mammoth from 'mammoth';
// We are using the new, compatible library here
import pdf from 'pdf-parse-new';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function run() {
    console.log("🚀 LIBRARIAN: Starting up...");

    // This downloads the 80MB AI model (first time only)
    const generateEmbedding = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

    const docsDir = path.join(__dirname, 'docs');
    const files = fs.readdirSync(docsDir).filter(f => !f.startsWith('.'));

    for (const file of files) {
        const filePath = path.join(docsDir, file);
        const ext = path.extname(file).toLowerCase();
        let text = "";

        console.log(`📖 LIBRARIAN: Reading ${file}...`);

        try {
            if (ext === '.pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                // pdf-parse-new works directly as a function!
                const data = await pdf(dataBuffer);
                text = data.text;
            } else if (ext === '.docx') {
                const result = await mammoth.extractRawText({ path: filePath });
                text = result.value;
            }

            if (!text || text.trim().length < 10) {
                console.log(`⚠️ LIBRARIAN: No text found in ${file}, skipping.`);
                continue;
            }

            // Chunking: 800 characters per "knowledge piece"
            const chunks = text.match(/[\s\S]{1,800}/g) || [];
            console.log(`✂️ LIBRARIAN: Splitting into ${chunks.length} pieces...`);

            for (let i = 0; i < chunks.length; i++) {
                // Turn text into a vector (384 numbers)
                const output = await generateEmbedding(chunks[i], { pooling: 'mean', normalize: true });
                const embedding = Array.from(output.data);

                const { error } = await supabase.from('doc_chunks').insert({
                    file_name: file,
                    content: chunks[i],
                    embedding: embedding,
                    page_number: 0 
                });

                if (error) console.error("❌ DB Error:", error.message);
                if (i % 10 === 0) process.stdout.write("."); 
            }
            console.log(`\n✅ LIBRARIAN: Successfully archived ${file}`);

        } catch (err: any) {
            console.error(`\n❌ LIBRARIAN: Error processing ${file}: ${err.message}`);
        }
    }
    console.log("\n🎉 SYSTEM: Warehouse is full. Ready for physics questions!");
}

run();