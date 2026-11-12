import pytest
import tempfile
import os
import shutil
from rag.documents import build_evidence_documents
from rag.service import RAGService
from agents.state import AgentState

@pytest.fixture
def mock_state() -> AgentState:
    return {
        "dataset_id": 999,
        "dataset_name": "TestDataset",
        "processed_file_path": "fake.csv",
        "dataset_metadata": {},
        "cleaned_data_reference": "ref",
        "data_understanding_result": {},
        "analytics_result": {"summary": {"total_revenue": 1000, "total_quantity": 50, "total_orders": 10}},
        "trend_result": {"trends": [{"metric": "Revenue", "trend": "increasing", "evidence": "Revenue went up"}]},
        "outlier_result": {"outliers": [{"metric": "Orders", "context": {"product": "A"}, "evidence": "Too many", "value": 100, "expected_range": "10-20", "status": "High"}]},
        "forecast_result": {"status": "ok", "future_forecast": [{"predicted_demand": 100}, {"predicted_demand": 120}]},
        "risk_result": {"risks": [{"risk_type": "Possible Stock-Out Risk", "severity": "High", "affected_product": "All", "explanation": "test", "evidence": ["test evidence"]}]},
        "recommendation_result": None,
        "verification_result": None,
        "retrieved_evidence": [],
        "evidence": [],
        "messages": [],
        "errors": [],
        "current_step": "init",
        "workflow_status": "pending"
    }

@pytest.fixture
def temp_chroma_dir():
    d = tempfile.mkdtemp()
    yield d
    shutil.rmtree(d, ignore_errors=True)

def test_build_evidence_documents(mock_state):
    docs = build_evidence_documents(mock_state)
    assert len(docs) == 5
    
    # Verify metadata and content
    types = [d.metadata["evidence_type"] for d in docs]
    assert "trend" in types
    assert "outlier" in types
    assert "forecast" in types
    assert "risk" in types
    assert "business_analytics" in types
    
    for d in docs:
        assert d.metadata["dataset_id"] == "999"
        assert d.metadata["dataset_name"] == "TestDataset"
        assert d.metadata["id"].startswith("999_")
        assert len(d.page_content) > 10

def test_rag_service_isolation_and_retrieval(mock_state, temp_chroma_dir):
    service = RAGService(persist_dir=temp_chroma_dir)
    
    # Index dataset 999
    success = service.index_evidence(mock_state)
    assert success is True
    
    # Create another dataset
    state_b = mock_state.copy()
    state_b["dataset_id"] = 888
    state_b["dataset_name"] = "DatasetB"
    state_b["trend_result"] = {"trends": [{"metric": "Revenue", "trend": "decreasing", "evidence": "went down"}]}
    service.index_evidence(state_b)
    
    # Retrieve for dataset 999
    results_999 = service.retrieve_evidence("increasing trend", dataset_id="999", k=2)
    assert len(results_999) > 0
    assert all(r["metadata"]["dataset_id"] == "999" for r in results_999)
    
    # Retrieve for dataset 888
    results_888 = service.retrieve_evidence("decreasing trend", dataset_id="888", k=2)
    assert len(results_888) > 0
    assert all(r["metadata"]["dataset_id"] == "888" for r in results_888)

def test_rag_node(mock_state, temp_chroma_dir, monkeypatch):
    from agents.nodes.rag_retrieval import rag_retrieval_node
    import rag.service
    
    # Patch the global _VECTOR_STORE logic to use temp dir
    monkeypatch.setattr(rag.service, "_VECTOR_STORE", None)
    
    def mock_get_store(*args, **kwargs):
        from rag.vector_store import VectorStore
        return VectorStore(persist_dir=temp_chroma_dir)
        
    monkeypatch.setattr(rag.service, "get_vector_store", mock_get_store)
    
    result = rag_retrieval_node(mock_state)
    assert result["current_step"] == "rag_retrieval"
    assert result["workflow_status"] == "in_progress"
    
    assert "retrieved_evidence" in result
    assert isinstance(result["retrieved_evidence"], list)
    assert len(result["retrieved_evidence"]) > 0
