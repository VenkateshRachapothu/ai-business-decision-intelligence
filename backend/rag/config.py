import os

# RAG Configuration

# Local directory for ChromaDB storage
CHROMADB_PERSIST_DIR = os.getenv("CHROMADB_PERSIST_DIR", os.path.join(os.path.dirname(__file__), "chroma_db"))

# The local embedding model to use (no API key required)
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")

# Top K documents to retrieve
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "5"))
