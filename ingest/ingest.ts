import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import mammoth from 'mammoth';
import pdf from 'pdf-parse-new';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function run() {
    console.log("🚀 LIBRARIAN: Opening the library gates...");

    const generateEmbedding = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

    const docsDir = path.join(__dirname, 'docs');
    const files = fs.readdirSync(docsDir).filter(f => !f.startsWith('.'));

    for (const file of files) {
        const filePath = path.join(docsDir, file);
        const ext = path.extname(file).toLowerCase();
        let text = "";

        // 1. DUPLICATE CHECK: Skip if book is already in the database
        const { data: existing } = await supabase
            .from('doc_chunks')
            .select('file_name')
            .eq('file_name', file)
            .limit(1);

        if (existing && existing.length > 0) {
            console.log(`⏩ LIBRARIAN: ${file} is already indexed. Skipping...`);
            continue;
        }

        console.log(`📖 LIBRARIAN: Reading ${file}...`);

        try {
            if (ext === '.pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdf(dataBuffer);
                text = data.text;
            } else if (ext === '.docx') {
                const result = await mammoth.extractRawText({ path: filePath });
                text = result.value;
            }

            if (!text || text.trim().length < 10) continue;

            // 2. SMARTER CHUNKING (Overlap)
            // We take 1000 characters but overlap by 200 so concepts aren't cut off
            const chunkSize = 1000;
            const overlap = 200;
            const chunks: string[] = [];
            
            for (let i = 0; i < text.length; i += (chunkSize - overlap)) {
                chunks.push(text.substring(i, i + chunkSize));
            }

            console.log(`✂️ LIBRARIAN: Processing ${chunks.length} segments...`);

            // 3. BATCH PROCESSING (Preparing data)
            const rowsToInsert = [];

            for (let i = 0; i < chunks.length; i++) {
                const output = await generateEmbedding(chunks[i], { pooling: 'mean', normalize: true });
                const embedding = Array.from(output.data);

                rowsToInsert.push({
                    file_name: file,
                    content: chunks[i],
                    embedding: embedding,
                    page_number: 0 
                });

                // Insert in batches of 20 to speed things up and avoid timeouts
                if (rowsToInsert.length === 20 || i === chunks.length - 1) {
                    const { error } = await supabase.from('doc_chunks').insert(rowsToInsert);
                    if (error) console.error("❌ DB Error:", error.message);
                    rowsToInsert.length = 0; // Clear the batch
                    process.stdout.write("."); 
                }
            }
            
            console.log(`\n✅ LIBRARIAN: Successfully archived ${file}`);

        } catch (err: any) {
            console.error(`\n❌ LIBRARIAN: Error processing ${file}: ${err.message}`);
        }
    }
    console.log("\n🎉 SYSTEM: All books shelved. Ready for physics questions!");
}

run();