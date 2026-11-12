import pytest
import pandas as pd
import tempfile
import os
from agents.nodes.data_understanding import data_understanding_node

@pytest.fixture
def dummy_online_retail_csv():
    # Online Retail II typically has these columns
    df = pd.DataFrame({
        "Invoice": ["536365", "536366"],
        "StockCode": ["85123A", "71053"],
        "Description": ["WHITE HANGING HEART T-LIGHT HOLDER", "WHITE METAL LANTERN"],
        "Quantity": [6, 6],
        "InvoiceDate": ["2010-12-01 08:26:00", "2010-12-01 08:28:00"],
        "Price": [2.55, 3.39],
        "Customer ID": [17850, 17850],
        "Country": ["United Kingdom", "United Kingdom"]
    })
    
    fd, path = tempfile.mkstemp(suffix=".csv")
    os.close(fd)
    df.to_csv(path, index=False)
    yield path
    os.remove(path)

@pytest.fixture
def dummy_olist_csv():
    # Olist orders typically has these columns
    df = pd.DataFrame({
        "order_id": ["e481f51cbdc54678b7cc49136f2d6af7", "53cdb2fc8bc7dce0b6741e2150273451"],
        "customer_id": ["9ef432eb6251297304e76186b10a928d", "b0830fb4747a6c6d20dea0b8c802d7ef"],
        "order_status": ["delivered", "delivered"],
        "order_purchase_timestamp": ["2017-10-02 10:56:33", "2018-07-24 20:41:37"]
    })
    
    fd, path = tempfile.mkstemp(suffix=".csv")
    os.close(fd)
    df.to_csv(path, index=False)
    yield path
    os.remove(path)

def test_data_understanding_online_retail(dummy_online_retail_csv):
    state = {
        "dataset_name": "Online Retail",
        "processed_file_path": dummy_online_retail_csv,
        "errors": []
    }
    
    result = data_understanding_node(state)
    assert result["current_step"] == "data_understanding"
    assert result["workflow_status"] == "in_progress"
    
    du = result["data_understanding_result"]
    assert du["dataset_name"] == "Online Retail"
    assert du["rows"] == 2
    assert du["columns"] == 8
    
    bc = du["business_columns"]
    assert bc["quantity"] == "Quantity"
    assert bc["price"] == "Price"
    assert bc["date"] == "InvoiceDate"
    assert bc["product"] == "StockCode" or bc["product"] == "Description"
    assert bc["customer"] == "Customer ID"
    assert bc["location"] == "Country"
    
    caps = du["capabilities"]
    assert caps["forecasting"] is True
    assert caps["product_analysis"] is True
    assert caps["location_analysis"] is True

def test_data_understanding_olist(dummy_olist_csv):
    state = {
        "dataset_name": "Olist",
        "processed_file_path": dummy_olist_csv,
        "errors": []
    }
    
    result = data_understanding_node(state)
    du = result["data_understanding_result"]
    
    assert du["rows"] == 2
    assert du["columns"] == 4
    
    bc = du["business_columns"]
    assert bc["date"] == "order_purchase_timestamp"
    assert bc["customer"] == "customer_id"
    # No quantity, price, location, product in this mock
    assert bc["quantity"] is None
    assert bc["price"] is None
    assert bc["location"] is None
    
    caps = du["capabilities"]
    assert caps["forecasting"] is False
    assert caps["product_analysis"] is False
    assert caps["location_analysis"] is False
    assert caps["trend_analysis"] is True
    
    limitations = du["limitations"]
    assert len(limitations) > 0
    assert any("Revenue analysis is not possible" in l for l in limitations)

def test_get_dataset_understanding_endpoint(dummy_online_retail_csv):
    from unittest.mock import MagicMock
    from app.routes.datasets import get_dataset_understanding

    mock_dataset = MagicMock()
    mock_dataset.id = 999
    mock_dataset.user_id = 1
    mock_dataset.original_file_location = dummy_online_retail_csv
    mock_dataset.dataset_type = "csv"
    mock_dataset.processing_status = "uploaded"
    
    mock_user = MagicMock()
    mock_user.id = 1
    
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = mock_dataset
    
    result = get_dataset_understanding(999, current_user=mock_user, db=mock_db)
    
    assert "Retail" in result["dataset_title"]
    assert result["confidence"] is not None
    assert result["confidence"] >= 0.8
    assert "retail" in result["summary_text"].lower() or "transaction" in result["summary_text"].lower()
    assert result["unique_counts"]["products"] == 2
    assert result["unique_counts"]["orders"] == 2
    assert result["unique_counts"]["customers"] == 1
    assert len(result["columns_meta"]) == 8
    
    for col_info in result["columns_meta"]:
        assert "name" in col_info
        assert "role" in col_info
        assert "data_type" in col_info
        assert "example_value" in col_info
        assert col_info["example_value"] != "—"
        
    feasibles = {a["name"]: a["feasible"] for a in result["feasible_analyses"]}
    assert feasibles["Trend Analysis"] is True
    assert feasibles["Product Intelligence"] is True
    assert feasibles["Customer Purchasing Analysis"] is True
    assert feasibles["Financial & Revenue KPIs"] is True
    assert feasibles["Geographic Analysis"] is True
    assert feasibles["Demand Forecasting"] is True

def test_get_dataset_understanding_minimal(dummy_olist_csv):
    from unittest.mock import MagicMock
    from app.routes.datasets import get_dataset_understanding

    mock_dataset = MagicMock()
    mock_dataset.id = 998
    mock_dataset.user_id = 1
    mock_dataset.original_file_location = dummy_olist_csv
    mock_dataset.dataset_type = "csv"
    mock_dataset.processing_status = "uploaded"
    
    mock_user = MagicMock()
    mock_user.id = 1
    
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = mock_dataset
    
    result = get_dataset_understanding(998, current_user=mock_user, db=mock_db)
    
    assert result["rows"] == 2
    assert result["columns"] == 4
    assert result["unique_counts"]["products"] is None
    assert result["unique_counts"]["orders"] == 2
    assert result["unique_counts"]["customers"] == 2
    
    feasibles = {a["name"]: a["feasible"] for a in result["feasible_analyses"]}
    assert feasibles["Product Intelligence"] is False
    assert feasibles["Financial & Revenue KPIs"] is False
    assert feasibles["Trend Analysis"] is True

