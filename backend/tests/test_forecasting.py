import pandas as pd
import numpy as np
from app.services.forecasting_service import generate_forecast, create_time_series_features

def test_create_time_series_features():
    dates = pd.date_range(start="2020-01-01", periods=5, freq="D")
    df = pd.DataFrame({"Quantity": [10, 20, 30, 40, 50]}, index=dates)
    
    features = create_time_series_features(df, "Quantity")
    assert 'lag_1' in features.columns
    assert 'lag_2' in features.columns
    assert 'rolling_mean_3' in features.columns
    assert features['lag_1'].iloc[1] == 10
    assert features['lag_2'].iloc[2] == 10
    
def test_generate_forecast_insufficient_data():
    df = pd.DataFrame({
        "InvoiceDate": pd.date_range(start="2020-01-01", periods=10, freq="D"),
        "Quantity": [10] * 10
    })
    result = generate_forecast(df)
    assert 'error' in result
    assert "Insufficient historical data" in result['error']

def test_generate_forecast_valid():
    # Need at least 20 periods for forecasting to pass the minimum check
    df = pd.DataFrame({
        "InvoiceDate": pd.date_range(start="2020-01-01", periods=30, freq="D"),
        "Quantity": np.random.randint(10, 100, size=30),
        "Price": [10.0] * 30
    })
    result = generate_forecast(df)
    
    # Check if error exists, we expect it to be successful
    assert 'error' not in result, result.get('error')
    
    assert "evaluation" in result
    assert "test_chart_data" in result
    assert "future_forecast" in result
    
    eval_metrics = result["evaluation"]
    assert "baseline" in eval_metrics
    assert "xgboost" in eval_metrics
    assert "mae" in eval_metrics["baseline"]
    
    # Check forecast structure
    assert len(result["future_forecast"]) == 4 # default periods
    assert "predicted_demand" in result["future_forecast"][0]
