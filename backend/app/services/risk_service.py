import pandas as pd
import numpy as np
from .analytics_service import map_columns
from .trend_service import analyze_trends
from .outlier_service import detect_outliers
from .forecasting_service import generate_forecast

from .cache_service import get_cached_service_result

def calculate_severity(confidence, impact_score):
    score = confidence * impact_score
    if score >= 0.7:
        return "High"
    elif score >= 0.4:
        return "Medium"
    else:
        return "Low"

def detect_risks(df: pd.DataFrame, file_path: str = None, file_type: str = None):
    mapping = map_columns(df)
    risks = []
    
    # Run dependent services to gather evidence (use cache if possible)
    if file_path and file_type:
        trends = get_cached_service_result(file_path, file_type, "trends")
        outliers = get_cached_service_result(file_path, file_type, "outliers")
        forecast = get_cached_service_result(file_path, file_type, "forecast")
    else:
        trends = analyze_trends(df)
        outliers = detect_outliers(df)
        forecast = generate_forecast(df)
    
    # 1. Declining Demand
    if not isinstance(trends, dict) or 'error' not in trends:
        for t in trends.get('trends', []):
            if t['trend'] == 'decreasing':
                conf = min(abs(t['slope']) * 5, 0.95) # Heuristic confidence based on slope steepness
                severity = calculate_severity(conf, 0.8)
                risks.append({
                    "risk_type": "Declining Demand",
                    "severity": severity,
                    "affected_product": "Aggregate " + t['metric'],
                    "affected_location": None,
                    "evidence": [t['evidence']],
                    "confidence": float(round(conf, 2)),
                    "explanation": f"The overall {t['metric'].lower()} has shown a consistent downward trend over the analyzed period."
                })
                
    # 2. Low Demand & 4. Sudden Demand Change
    if mapping['product'] and mapping['quantity'] and pd.api.types.is_numeric_dtype(df[mapping['quantity']]):
        # Analyze product-level demand
        product_demand = df.groupby(mapping['product'])[mapping['quantity']].sum()
        mean_demand = product_demand.mean()
        std_demand = product_demand.std()
        
        # Low Demand
        if std_demand > 0:
            low_threshold = mean_demand - (0.5 * std_demand) # Items selling below half std of mean
            low_products = product_demand[product_demand < low_threshold]
            
            # Limit to worst 5 to avoid overwhelming the user
            for prod, val in low_products.nsmallest(5).items():
                conf = 0.8 # Static confidence for historical aggregate
                risks.append({
                    "risk_type": "Low Demand",
                    "severity": "Medium",
                    "affected_product": str(prod),
                    "affected_location": None,
                    "evidence": [f"Total demand is {val}, well below the average of {mean_demand:.2f}"],
                    "confidence": conf,
                    "explanation": "This product has consistently underperformed compared to the historical catalog average."
                })
                
        # Sudden Demand Change
        if mapping['date']:
            df['_parsed_date'] = pd.to_datetime(df[mapping['date']], errors='coerce')
            valid_dates = df.dropna(subset=['_parsed_date', mapping['quantity']]).copy()
            if not valid_dates.empty:
                valid_dates['_period'] = valid_dates['_parsed_date'].dt.to_period('W').astype(str)
                # Look at top 10 products
                top_prods = product_demand.nlargest(10).index
                prod_time = valid_dates[valid_dates[mapping['product']].isin(top_prods)].pivot_table(
                    index='_period', columns=mapping['product'], values=mapping['quantity'], aggfunc='sum'
                ).fillna(0)
                
                if len(prod_time) >= 2:
                    last_period = prod_time.iloc[-1]
                    prev_period = prod_time.iloc[-2]
                    
                    for prod in top_prods:
                        curr_val = last_period.get(prod, 0)
                        prev_val = prev_period.get(prod, 0)
                        
                        if prev_val > 0:
                            pct_change = (curr_val - prev_val) / prev_val
                            if abs(pct_change) > 0.5: # 50% sudden change
                                risk_type = "Sudden Demand Change (Drop)" if pct_change < 0 else "Sudden Demand Change (Spike)"
                                severity = "High" if pct_change < 0 else "Medium"
                                risks.append({
                                    "risk_type": risk_type,
                                    "severity": severity,
                                    "affected_product": str(prod),
                                    "affected_location": None,
                                    "evidence": [f"Demand went from {prev_val} to {curr_val} in the last period ({pct_change*100:.1f}%)"],
                                    "confidence": 0.9,
                                    "explanation": "A drastic shift in demand occurred recently, requiring attention."
                                })

    # 3. Unusual Sales / Demand
    if not isinstance(outliers, dict) or 'error' not in outliers:
        for out in outliers.get('outliers', []):
            if "Low" in out['status']:
                conf = min(0.6 + abs(float(out['evidence'].split(' ')[2]) / 10), 0.99) # Proxy confidence using Z-score magnitude
                severity = calculate_severity(conf, 0.9)
                risks.append({
                    "risk_type": "Unusual Sales / Demand",
                    "severity": severity,
                    "affected_product": out['context'].get('product', 'Aggregate'),
                    "affected_location": out['context'].get('location', None),
                    "evidence": [out['evidence'], f"Value: {out['value']} vs Expected: {out['expected_range']}"],
                    "confidence": float(round(conf, 2)),
                    "explanation": f"Statistical anomaly detected indicating unusually low {out['metric'].lower()}."
                })
                
    # 5. Possible Stock-Out Risk
    if not isinstance(forecast, dict) or 'error' not in forecast:
        fut_forecast = forecast.get('future_forecast', [])
        if len(fut_forecast) >= 2:
            first_fut = fut_forecast[0]['predicted_demand']
            last_fut = fut_forecast[-1]['predicted_demand']
            
            if last_fut > first_fut * 1.2: # 20% forecasted increase
                risks.append({
                    "risk_type": "Possible Stock-Out Risk",
                    "severity": "Medium",
                    "affected_product": "Aggregate Catalog",
                    "affected_location": None,
                    "evidence": [
                        f"Forecasted demand increases from {first_fut:.1f} to {last_fut:.1f} over the next periods.",
                        "Inventory level unavailable; stock-out risk is estimated from demand behavior."
                    ],
                    "confidence": 0.75,
                    "explanation": "Rising future demand predictions may place pressure on existing inventory levels."
                })
                
    return {"risks": risks}
