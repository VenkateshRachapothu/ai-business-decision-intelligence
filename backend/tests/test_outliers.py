import pandas as pd
from app.services.outlier_service import detect_outliers

def test_detect_outliers():
    # Create 100 normal rows and 1 outlier
    df = pd.DataFrame({
        "InvoiceDate": pd.date_range(start="2020-01-01", periods=101, freq="D"),
        "Quantity": [10]*100 + [1000],  # 1000 is an outlier
        "Price": [5.0]*101,
        "StockCode": ["A1"]*101
    })
    result = detect_outliers(df)
    outliers = result.get('outliers', [])
    
    assert len(outliers) > 0
    # There should be an outlier for Revenue and Quantity
    q_outlier = next((o for o in outliers if o['metric'] == 'Quantity' and o['status'] == 'Unusually High'), None)
    assert q_outlier is not None
    assert q_outlier['value'] == 1000.0

def test_detect_outliers_no_outliers():
    df = pd.DataFrame({
        "Quantity": [10]*100,
        "Price": [5.0]*100
    })
    result = detect_outliers(df)
    assert len(result['outliers']) == 0

def test_detect_outliers_low_outlier():
    df = pd.DataFrame({
        "Quantity": [100]*100 + [1],  # 1 is an outlier
        "Price": [5.0]*101
    })
    result = detect_outliers(df)
    outliers = result.get('outliers', [])
    assert len(outliers) > 0
    q_outlier = next((o for o in outliers if o['metric'] == 'Quantity' and o['status'] == 'Unusually Low'), None)
    assert q_outlier is not None
    assert q_outlier['value'] == 1.0
