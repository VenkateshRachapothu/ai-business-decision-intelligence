import pandas as pd
import os
import threading
from functools import lru_cache
from typing import Dict, Any

from .analytics_service import generate_analytics
from .trend_service import analyze_trends
from .outlier_service import detect_outliers
from .forecasting_service import generate_forecast

_df_cache_lock = threading.Lock()
_df_cache = {}

def get_cached_df(file_path: str, file_type: str) -> pd.DataFrame:
    if not os.path.exists(file_path):
        raise FileNotFoundError("Processed dataset file not found on disk.")
        
    mtime = os.path.getmtime(file_path)
    cache_key = f"{file_path}_{mtime}"
    
    with _df_cache_lock:
        if cache_key in _df_cache:
            return _df_cache[cache_key].copy()
            
        # Clean up old entries (keep max 3)
        if len(_df_cache) >= 3:
            _df_cache.clear()
            
        if file_type == "csv":
            encodings = ["utf-8", "utf-8-sig", "windows-1252", "latin1"]
            df = None
            last_err = None
            for enc in encodings:
                try:
                    df = pd.read_csv(file_path, encoding=enc)
                    break
                except (UnicodeDecodeError, UnicodeError) as e:
                    last_err = e
            if df is None:
                raise last_err or Exception(f"Unable to decode CSV file: {file_path}")
        else:
            df = pd.read_excel(file_path)
            
        # Common Preprocessing to save time across all services
        from .analytics_service import map_columns
        mapping = map_columns(df)
        
        if mapping['date']:
            df['_parsed_date'] = pd.to_datetime(df[mapping['date']], errors='coerce')
            
        if mapping['revenue'] and pd.api.types.is_numeric_dtype(df[mapping['revenue']]):
            df['_calculated_revenue'] = df[mapping['revenue']]
        elif mapping['quantity'] and mapping['price'] and pd.api.types.is_numeric_dtype(df[mapping['quantity']]) and pd.api.types.is_numeric_dtype(df[mapping['price']]):
            df['_calculated_revenue'] = df[mapping['quantity']] * df[mapping['price']]
            
        _df_cache[cache_key] = df
        return df.copy()

_results_cache_lock = threading.Lock()
_results_cache = {}

def get_cached_service_result(file_path: str, file_type: str, service_name: str) -> Dict[str, Any]:
    if not os.path.exists(file_path):
        raise FileNotFoundError("Processed dataset file not found on disk.")
        
    mtime = os.path.getmtime(file_path)
    cache_key = f"{file_path}_{mtime}_{service_name}"
    
    with _results_cache_lock:
        if cache_key in _results_cache:
            return _results_cache[cache_key]
            
    # If not in cache, load df and compute outside the lock to avoid blocking other endpoints
    # Wait, if we compute outside, we might have a stampede. 
    # But it's better than blocking ALL services while one computes.
    
    df = get_cached_df(file_path, file_type)
    
    if service_name == "analytics":
        res = generate_analytics(df)
    elif service_name == "trends":
        res = analyze_trends(df)
    elif service_name == "outliers":
        res = detect_outliers(df)
    elif service_name == "forecast":
        res = generate_forecast(df)
    elif service_name == "risks":
        from .risk_service import detect_risks
        res = detect_risks(df, file_path, file_type)
    else:
        raise ValueError("Unknown service")
        
    with _results_cache_lock:
        # Keep max 20 results
        if len(_results_cache) >= 20:
            _results_cache.clear()
        _results_cache[cache_key] = res
        
    return res
