import os
import logging
from typing import List
from langchain_chroma import Chroma
from langchain_core.documents import Document
from .embeddings import LocalEmbeddings
from .config import CHROMADB_PERSIST_DIR, EMBEDDING_MODEL_NAME

logger = logging.getLogger(__name__)

class VectorStore:
    def __init__(self, persist_dir: str = CHROMADB_PERSIST_DIR):
        self.persist_dir = persist_dir
        self.embeddings = LocalEmbeddings(EMBEDDING_MODEL_NAME)
        
        # Ensure directory exists
        os.makedirs(self.persist_dir, exist_ok=True)
        
        try:
            self.db = Chroma(
                collection_name="business_evidence",
                embedding_function=self.embeddings,
                persist_directory=self.persist_dir
            )
        except Exception as e:
            logger.error(f"Failed to initialize Chroma DB: {e}")
            self.db = None

    def add_documents(self, documents: List[Document]):
        if not self.db or not documents:
            return
            
        try:
            ids = [doc.metadata["id"] for doc in documents]
            # Chroma handles upserts via add_documents if IDs are provided
            self.db.add_documents(documents, ids=ids)
        except Exception as e:
            logger.error(f"Failed to add documents to Chroma DB: {e}")

    def similarity_search(self, query: str, dataset_id: str, k: int = 5) -> List[Document]:
        if not self.db:
            return []
            
        try:
            # Enforce dataset isolation via filter
            docs = self.db.similarity_search(
                query,
                k=k,
                filter={"dataset_id": str(dataset_id)}
            )
            return docs
        except Exception as e:
            logger.error(f"Failed to search Chroma DB: {e}")
            return []
