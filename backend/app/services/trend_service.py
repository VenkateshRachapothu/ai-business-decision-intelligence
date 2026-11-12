import pandas as pd
import numpy as np
from .analytics_service import map_columns

def analyze_trends(df: pd.DataFrame):
    mapping = map_columns(df)
    
    if not mapping['date']:
        return {"error": "Date column required for trend analysis."}
        
    if '_parsed_date' not in df.columns:
        df['_parsed_date'] = pd.to_datetime(df[mapping['date']], errors='coerce')
    valid_dates = df.dropna(subset=['_parsed_date']).copy()
    
    if valid_dates.empty:
        return {"error": "No valid dates found."}
        
    # Determine frequency: daily, weekly, or monthly
    # Let's use monthly by default, or weekly if data spans < 3 months
    date_range = valid_dates['_parsed_date'].max() - valid_dates['_parsed_date'].min()
    freq = 'M'
    if date_range.days < 90:
        freq = 'W'
    if date_range.days < 14:
        freq = 'D'
        
    valid_dates['_period'] = valid_dates['_parsed_date'].dt.to_period(freq).astype(str)
    
    # Calculate revenue
    has_revenue = False
    if mapping['revenue'] and pd.api.types.is_numeric_dtype(df[mapping['revenue']]):
        valid_dates['_calculated_revenue'] = valid_dates[mapping['revenue']]
        has_revenue = True
    elif mapping['quantity'] and mapping['price'] and pd.api.types.is_numeric_dtype(df[mapping['quantity']]) and pd.api.types.is_numeric_dtype(df[mapping['price']]):
        valid_dates['_calculated_revenue'] = df['_calculated_revenue'] if '_calculated_revenue' in df.columns else valid_dates[mapping['quantity']] * valid_dates[mapping['price']]
        has_revenue = True
        
    trends = []
    
    # Function to calculate trend classification
    def classify_trend(series, metric_name):
        if len(series) < 3:
            return {"metric": metric_name, "trend": "stable", "slope": 0.0, "strength": 0, "period": freq, "evidence": "Not enough data points for trend analysis."}
            
        y = series.values
        x = np.arange(len(y))
        
        # Linear regression slope
        slope, _ = np.polyfit(x, y, 1)
        mean_val = np.mean(y)
        
        # Normalize slope relative to mean
        normalized_slope = (slope / mean_val) if mean_val != 0 else 0
        
        if normalized_slope > 0.05:
            trend_dir = "increasing"
        elif normalized_slope < -0.05:
            trend_dir = "decreasing"
        else:
            trend_dir = "stable"
            
        return {
            "metric": metric_name,
            "trend": trend_dir,
            "slope": float(normalized_slope),
            "period": freq,
            "evidence": f"Average change of {slope:.2f} per period over {len(y)} periods."
        }
        
    if has_revenue:
        rev_series = valid_dates.groupby('_period')['_calculated_revenue'].sum()
        trends.append(classify_trend(rev_series, "Revenue"))
        
    if mapping['quantity'] and pd.api.types.is_numeric_dtype(df[mapping['quantity']]):
        qty_series = valid_dates.groupby('_period')[mapping['quantity']].sum()
        trends.append(classify_trend(qty_series, "Quantity"))
        
    if mapping['order']:
        order_series = valid_dates.groupby('_period')[mapping['order']].nunique()
        trends.append(classify_trend(order_series, "Orders"))
        
    return {
        "frequency": freq,
        "trends": trends
    }
