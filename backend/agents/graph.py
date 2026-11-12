from langgraph.graph import StateGraph, START, END
from .state import AgentState
from .nodes import (
    data_understanding_node,
    analysis_node,
    forecasting_node,
    risk_detection_node,
    rag_retrieval_node,
    decision_node,
    verification_node
)

def create_workflow():
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("data_understanding", data_understanding_node)
    workflow.add_node("analysis", analysis_node)
    workflow.add_node("forecasting", forecasting_node)
    workflow.add_node("risk_detection", risk_detection_node)
    workflow.add_node("rag_retrieval", rag_retrieval_node)
    workflow.add_node("decision", decision_node)
    workflow.add_node("verification", verification_node)
    
    # Add edges
    workflow.add_edge(START, "data_understanding")
    workflow.add_edge("data_understanding", "analysis")
    workflow.add_edge("analysis", "forecasting")
    workflow.add_edge("forecasting", "risk_detection")
    workflow.add_edge("risk_detection", "rag_retrieval")
    workflow.add_edge("rag_retrieval", "decision")
    workflow.add_edge("decision", "verification")
    workflow.add_edge("verification", END)
    
    return workflow.compile()

# Provide a compiled graph that can be imported
graph = create_workflow()
