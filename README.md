# 🤖 RAG Context - AI-Powered Document Chat

A **Retrieval-Augmented Generation (RAG)** chatbot built with **LangChain.js** that enables intelligent conversations with your PDF documents. Supports both **Google Gemini** and **local Ollama models** for flexible deployment.

## ✨ Features

- 📄 **PDF Document Processing** - Load and process PDF files into searchable chunks
- 🔍 **Vector Search** - Semantic search using Pinecone vector database
- 💬 **Conversational Memory** - Maintains context across multiple questions
- 🌐 **Dual Model Support**:
  - **Google Gemini** - Cloud-based, powerful AI (gemini-2.0-flash-exp)
  - **Ollama** - Local inference, no API limits (llama3.2, phi3, gemma2)
- ⚡ **Smart Chunking** - Recursive text splitting with overlap for better context
- 🎯 **Context-Aware Responses** - Uses conversation history for relevant answers

## 🏗️ Architecture

```
PDF Document → Load → Split into Chunks → Embed → Store in Pinecone
                                                         ↓
User Question → Embed → Search Similar Chunks → Retrieve Context
                                                         ↓
                               Context + History + Question → LLM → Answer
```

## 📋 Prerequisites

- Node.js (v18+)
- **Pinecone account** (free tier available)
- **Either**:
  - Google Gemini API key, OR
  - Ollama installed locally

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/RiyanshiTomar/RAG_Context.git
cd RAG_Context
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
# Pinecone Configuration (Required)
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=your_index_name

# Google Gemini (if using cloud model)
GEMINI_API_KEY=your_gemini_api_key_here

# Configuration Flags
UPLOAD_TO_PINECONE=false  # Set to 'true' for first-time upload
USE_OLLAMA=false          # Set to 'true' to use local Ollama instead of Gemini
```

### 4. First-Time Setup: Upload Documents

Set `UPLOAD_TO_PINECONE=true` in your `.env` file, then run:

```bash
node indexing.js
```

This will:
- Load the PDF from `sample-report.pdf`
- Split it into 1000-character chunks
- Create embeddings
- Upload to Pinecone

### 5. Start Chatting

Set `UPLOAD_TO_PINECONE=false` in `.env`, then run:

```bash
node indexing.js
```

## 💡 Usage

### Interactive Commands

- **Ask questions**: Type your question and press Enter
- **`history`** - View conversation history
- **`clear`** - Clear conversation history
- **`exit`** - Quit the application

### Example Session

```
=== RAG Chat Bot Ready ===
Type "exit" to quit, "history" to see conversation history, "clear" to clear history

Ask me anything--> What is this document about?
🔍 Processing your question...
  → Creating embedding...
  ✓ Embedding created
  → Searching Pinecone...
  ✓ Found 5 relevant documents
  → Asking AI...
  ✓ Response received

This document is a comprehensive report about...

Ask me anything--> Can you summarize the key findings?
...
```

## ⚙️ Configuration

### Model Selection

**Google Gemini (Cloud)**:
```env
USE_OLLAMA=false
GEMINI_API_KEY=your_key
```

**Ollama (Local)**:
```env
USE_OLLAMA=true
# Make sure Ollama is running: ollama serve
```

### Supported Ollama Models

- `llama3.2` - Balanced performance (default)
- `phi3` - Lightweight, fast
- `gemma2:2b` - Efficient, good quality

### Advanced Settings

Edit constants in `indexing.js`:

```javascript
const CHUNK_SIZE = 1000;       // Size of text chunks
const CHUNK_OVERLAP = 200;     // Overlap between chunks
const TOP_K_RESULTS = 5;       // Number of results to retrieve
```

## 📁 Project Structure

```
RAG_Context/
├── indexing.js           # Main application
├── package.json          # Dependencies
├── .env                  # Environment variables (not tracked)
├── .gitignore           # Git ignore rules
├── sample-report.pdf    # Your PDF document
└── README.md            # This file
```

## 🔧 Technologies Used

- **LangChain.js** - RAG orchestration framework
- **Pinecone** - Vector database for similarity search
- **Google Gemini** - Cloud LLM (gemini-2.0-flash-exp)
- **Ollama** - Local LLM inference
- **pdf-parse** - PDF text extraction
- **readline-sync** - Interactive CLI interface

## 🐛 Troubleshooting

### "No relevant documents found"
- Ensure you uploaded documents first (`UPLOAD_TO_PINECONE=true`)
- Check Pinecone index name matches your `.env`

### Ollama connection errors
- Verify Ollama is running: `ollama serve`
- Check models are installed: `ollama list`
- Install models if needed: `ollama pull llama3.2`

### API quota exceeded (Gemini)
- Switch to Ollama: `USE_OLLAMA=true`
- Or wait for quota reset

## 📝 License

ISC

## 👤 Author

**Riyanshi Tomar**

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## ⭐ Show Your Support

Give a ⭐️ if this project helped you!

---

**Built with ❤️ using LangChain and AI**
