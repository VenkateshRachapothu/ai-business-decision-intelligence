from typing import List
from langchain_core.embeddings import Embeddings
import logging

logger = logging.getLogger(__name__)

class LocalEmbeddings(Embeddings):
    def __init__(self, model_name: str):
        self.model_name = model_name
        self._model = None

    @property
    def model(self):
        # Lazy loading to avoid blocking at import time
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                logger.info(f"Loading embedding model: {self.model_name}")
                try:
                    self._model = SentenceTransformer(self.model_name, local_files_only=True)
                except Exception:
                    self._model = SentenceTransformer(self.model_name)
            except Exception as e:
                logger.error(f"Failed to load sentence_transformers model {self.model_name}: {e}")
                raise
        return self._model

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        embeddings = self.model.encode(texts)
        return embeddings.tolist()

    def embed_query(self, text: str) -> List[float]:
        embedding = self.model.encode([text])[0]
        return embedding.tolist()
