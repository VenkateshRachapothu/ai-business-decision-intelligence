import pandas as pd
import numpy as np
from .analytics_service import map_columns

def detect_outliers(df: pd.DataFrame):
    mapping = map_columns(df)
    
    outliers = []
    
    # Calculate revenue
    has_revenue = False
    if '_calculated_revenue' in df.columns:
        has_revenue = True
    elif mapping['revenue'] and pd.api.types.is_numeric_dtype(df[mapping['revenue']]):
        df['_calculated_revenue'] = df[mapping['revenue']]
        has_revenue = True
    elif mapping['quantity'] and mapping['price'] and pd.api.types.is_numeric_dtype(df[mapping['quantity']]) and pd.api.types.is_numeric_dtype(df[mapping['price']]):
        df['_calculated_revenue'] = df[mapping['quantity']] * df[mapping['price']]
        has_revenue = True

    def z_score_outliers(series, metric_name, context_cols, max_outliers=10):
        # Drop NaNs
        valid_idx = series.dropna().index
        if len(valid_idx) < 10:
            return
            
        s = series.loc[valid_idx]
        mean_val = s.mean()
        std_val = s.std()
        
        if std_val == 0:
            return
            
        z_scores = (s - mean_val) / std_val
        
        # Consider z > 3 or z < -3 as outliers
        outlier_mask = (z_scores > 3) | (z_scores < -3)
        outlier_indices = s[outlier_mask].index
        
        # Sort by absolute z-score descending to get the most extreme ones
        sorted_outliers = z_scores.loc[outlier_indices].abs().sort_values(ascending=False).index[:max_outliers]
        
        for idx in sorted_outliers:
            val = float(s.loc[idx])
            z = float(z_scores.loc[idx])
            
            context = {c: str(df.loc[idx, mapping[c]]) for c in context_cols if mapping.get(c) and mapping[c] in df.columns}
            
            outlier_type = "Unusually High" if z > 0 else "Unusually Low"
            
            outliers.append({
                "metric": metric_name,
                "value": val,
                "expected_range": f"{mean_val - 3*std_val:.2f} to {mean_val + 3*std_val:.2f}",
                "status": outlier_type,
                "evidence": f"Z-score of {z:.2f} (mean: {mean_val:.2f}, std: {std_val:.2f})",
                "context": context
            })
            
    context_keys = ['product', 'location', 'date', 'order']
    
    if has_revenue:
        z_score_outliers(df['_calculated_revenue'], "Revenue", context_keys)
        
    if mapping['quantity'] and pd.api.types.is_numeric_dtype(df[mapping['quantity']]):
        z_score_outliers(df[mapping['quantity']], "Quantity", context_keys)
        
    return {
        "outliers": outliers
    }
