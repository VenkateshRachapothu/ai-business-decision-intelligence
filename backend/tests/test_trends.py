import pandas as pd
from app.services.trend_service import analyze_trends

def test_analyze_trends_increasing():
    df = pd.DataFrame({
        "InvoiceDate": pd.date_range(start="2020-01-01", periods=5, freq="ME"),
        "Quantity": [10, 20, 30, 40, 50],
        "Price": [10, 10, 10, 10, 10],
        "Invoice": ["INV1", "INV2", "INV3", "INV4", "INV5"]
    })
    result = analyze_trends(df)
    assert 'error' not in result
    trends = result['trends']
    assert len(trends) == 3 # Revenue, Quantity, Orders
    for t in trends:
        if t['metric'] in ['Revenue', 'Quantity']:
            assert t['trend'] == 'increasing'
            assert t['slope'] > 0

def test_analyze_trends_decreasing():
    df = pd.DataFrame({
        "InvoiceDate": pd.date_range(start="2020-01-01", periods=5, freq="ME"),
        "Quantity": [50, 40, 30, 20, 10],
        "Price": [10, 10, 10, 10, 10]
    })
    result = analyze_trends(df)
    for t in result['trends']:
        if t['metric'] in ['Revenue', 'Quantity']:
            assert t['trend'] == 'decreasing'
            assert t['slope'] < 0

def test_analyze_trends_stable():
    df = pd.DataFrame({
        "InvoiceDate": pd.date_range(start="2020-01-01", periods=5, freq="ME"),
        "Quantity": [20, 21, 20, 19, 20],
        "Price": [10, 10, 10, 10, 10]
    })
    result = analyze_trends(df)
    for t in result['trends']:
        if t['metric'] in ['Revenue', 'Quantity']:
            assert t['trend'] == 'stable'
