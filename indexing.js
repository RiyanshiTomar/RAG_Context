import readlineSync from 'readline-sync';
import * as dotenv from 'dotenv';
dotenv.config();
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { OllamaEmbeddings } from '@langchain/ollama';
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';

// Constants
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const PDF_PATH = './sample-report.pdf';
const SHOULD_UPLOAD = process.env.UPLOAD_TO_PINECONE === 'true'; // Set to 'true' in .env to upload
const USE_OLLAMA = process.env.USE_OLLAMA === 'true'; // Set to 'true' to use Ollama instead of Gemini
const TOP_K_RESULTS = USE_OLLAMA ? 3 : 5; // Fewer results for faster Ollama responses

// Conversation history storage
const conversationHistory = [];

//step 3: Initialising the Embedding model
// Ollama embeddings when USE_OLLAMA=true for consistency
// For upload, we can temporarily set USE_OLLAMA=false to use faster Google embeddings
const embeddings = USE_OLLAMA
    ? new OllamaEmbeddings({
        model: 'nomic-embed-text', // Fast, lightweight embedding model
        baseUrl: 'http://127.0.0.1:11434',
      })
    : new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GEMINI_API_KEY,
        model: 'text-embedding-004',
      });

//step 4: Initialize the LLM model
// Using Ollama for local inference when USE_OLLAMA=true (no API quota limits!)
const model = USE_OLLAMA
    ? new ChatOllama({
        model: 'llama3.2', // Fast! Alternatives: 'phi3', 'gemma2:2b', 'llama3.2'----I also have them
        baseUrl: 'http://127.0.0.1:11434',
        temperature: 0.3,
        timeout: 30000, // 30 second timeout
        numCtx: 4096, // Context window size
      })
    : new ChatGoogleGenerativeAI({
        apiKey: process.env.GEMINI_API_KEY,
        model: 'gemini-2.0-flash-exp',
        temperature: 0.3,
      });

//step 5: Initialise Pinecone Client
const pinecone = new Pinecone();
const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

// Upload phase (only if SHOULD_UPLOAD is true)
if (SHOULD_UPLOAD) {
    try {
        console.log('Starting document upload process...');
        
        //step 1 : load the PDF File
        const pdfLoader = new PDFLoader(PDF_PATH);
        const rawDocs = await pdfLoader.load();
        console.log(`✓ Loaded ${rawDocs.length} pages from PDF`);

        // step 2: create chunks of PDF
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: CHUNK_SIZE,
            chunkOverlap: CHUNK_OVERLAP,
        });
        const chunkedDocs = await textSplitter.splitDocuments(rawDocs);
        console.log(`✓ Created ${chunkedDocs.length} chunks`);

        //step 6: Embed Chunks and Upload to Pinecone
        console.log('Uploading to Pinecone (this may take a minute)...');
        await PineconeStore.fromDocuments(chunkedDocs, embeddings, {
            pineconeIndex,
            maxConcurrency: 5,
        });
        console.log('✓ Upload complete!');
    } catch (error) {
        console.error(' Error during upload:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
} else {
    console.log('Skipping upload (UPLOAD_TO_PINECONE not set to true)');
    console.log('Using existing documents in Pinecone...');
}

// Function to format conversation history
function formatHistory() {
    if (conversationHistory.length === 0) {
        return "No previous conversation.";
    }
    
    return conversationHistory
        .map((entry, index) => `[Turn ${index + 1}]\nUser: ${entry.question}\nAssistant: ${entry.answer}`)
        .join("\n\n");
}

// Main chatting function
async function chatting(question) {
    try {
        console.log('🔍 Processing your question...');
        
        //convert user query into embedding (vector)
        console.log('  → Creating embedding...');
        const queryVector = await embeddings.embedQuery(question);
        console.log('  ✓ Embedding created');

        // search relevant document into vector DB
        console.log('  → Searching Pinecone...');
        const searchResults = await pineconeIndex.query({
            topK: TOP_K_RESULTS, // Fewer results for faster processing
            vector: queryVector,
            includeMetadata: true,
        });
        console.log(`  ✓ Found ${searchResults.matches.length} relevant documents`);

        if (!searchResults.matches || searchResults.matches.length === 0) {
            console.log('\n No relevant documents found in database. Please check if documents were uploaded.\n');
            return;
        }

        const context = searchResults.matches
            .map(match => match.metadata?.text || '')
            .filter(text => text.length > 0)
            .join("\n\n---\n\n");

        if (!context) {
            console.log('\n  No text content found in search results.\n');
            return;
        }

        // Get formatted conversation history
        const historyContext = formatHistory();

        //next --> Query + Context + History to LLM-----------ab LLM boss h..
        console.log('  → Asking AI...');
        
        // Create a prompt template with history
        const promptTemplate = PromptTemplate.fromTemplate(`
You are a helpful assistant answering questions based on the provided documentation.

Previous Conversation History:
{history}

Context from the documentation:
{context}

Current Question: {question}

Instructions:
- Answer the question using the information from the context above
- Consider the conversation history to provide contextually relevant answers
- If referring to something from previous conversation, acknowledge it
- If the answer is not in the context, say "I don't have enough information to answer that question."
- Be concise and clear
- Use code examples from the context if relevant

Answer:
        `);

        // Create a chain (prompt → model → parser)
        const chain = RunnableSequence.from([
            promptTemplate,
            model,
            new StringOutputParser(),
        ]);

        // Invoke the chain and get the answer
        const answer = await chain.invoke({
            context: context,
            question: question,
            history: historyContext,
        });

        console.log('  ✓ Response received\n');
        console.log(`${answer}\n`);

        // Store in conversation history
        conversationHistory.push({
            question: question,
            answer: answer,
            timestamp: new Date().toISOString(),
        });

        // Keep only last 5 conversations to avoid token limit
        if (conversationHistory.length > 5) {
            conversationHistory.shift();
        }

    } catch (error) {
        console.error('Error during chatting:', error.message);
    }
}

// PHASE2 ----- Query Resolving Phase
async function main() {
    console.log('\n=== RAG Chat Bot Ready ===');
    console.log('Type "exit" to quit, "history" to see conversation history, "clear" to clear history\n');

    while (true) {
        const userProblem = readlineSync.question("Ask me anything--> ");

        if (userProblem.toLowerCase() === 'exit') {
            console.log('Goodbye!');
            break;
        }

        if (userProblem.toLowerCase() === 'history') {
            console.log('\n=== Conversation History ===');
            console.log(formatHistory() || 'No history yet.');
            console.log('===========================\n');
            continue;
        }

        if (userProblem.toLowerCase() === 'clear') {
            conversationHistory.length = 0;
            console.log('History cleared!\n');
            continue;
        }

        if (userProblem.trim()) {
            await chatting(userProblem);
        }
    }
}

main();