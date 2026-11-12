import pandas as pd
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb
from .analytics_service import map_columns
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

def create_time_series_features(df, target_col):
    df = df.copy()
    df['year'] = df.index.year
    df['month'] = df.index.month
    df['day'] = df.index.day
    df['day_of_week'] = df.index.dayofweek
    
    # Lags and rolling
    df['lag_1'] = df[target_col].shift(1)
    df['lag_2'] = df[target_col].shift(2)
    df['rolling_mean_3'] = df[target_col].shift(1).rolling(window=3).mean()
    df['rolling_std_3'] = df[target_col].shift(1).rolling(window=3).std()
    
    return df

def generate_forecast(df: pd.DataFrame):
    mapping = map_columns(df)
    
    if not mapping['date']:
        return {"error": "Date column required for forecasting."}
    
    target_col = None
    if mapping['quantity'] and pd.api.types.is_numeric_dtype(df[mapping['quantity']]):
        target_col = mapping['quantity']
    elif mapping['revenue'] and pd.api.types.is_numeric_dtype(df[mapping['revenue']]):
        target_col = mapping['revenue']
        
    if not target_col:
        return {"error": "Quantity or Revenue column required for forecasting."}
        
    if '_parsed_date' not in df.columns:
        df['_parsed_date'] = pd.to_datetime(df[mapping['date']], errors='coerce')
    valid_dates = df.dropna(subset=['_parsed_date', target_col]).copy()
    
    if valid_dates.empty:
        return {"error": "No valid data for forecasting."}
        
    try:
        # Aggregation logic...
        date_range = valid_dates['_parsed_date'].max() - valid_dates['_parsed_date'].min()
        freq = 'W' if date_range.days > 180 else 'D'
        
        agg_df = valid_dates.set_index('_parsed_date').resample(freq)[target_col].sum().to_frame()
        agg_df = agg_df.dropna()
        
        if len(agg_df) < 20:
            return {"error": "Insufficient historical data for forecasting (minimum 20 periods required)."}
            
        features_df = create_time_series_features(agg_df, target_col)
        features_df = features_df.dropna()
        
        if len(features_df) < 10:
            return {"error": "Insufficient data after feature engineering."}
            
        split_idx = int(len(features_df) * 0.8)
        train = features_df.iloc[:split_idx]
        test = features_df.iloc[split_idx:]
        
        feature_cols = ['year', 'month', 'day', 'day_of_week', 'lag_1', 'lag_2', 'rolling_mean_3', 'rolling_std_3']
        X_train, y_train = train[feature_cols], train[target_col]
        X_test, y_test = test[feature_cols], test[target_col]
        
        baseline_preds = X_test['lag_1']
        
        xgb_model = xgb.XGBRegressor(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=42)
        xgb_model.fit(X_train, y_train)
        xgb_preds = xgb_model.predict(X_test)
        
        def calc_metrics(y_true, y_pred):
            def safe_float(val):
                f = float(val)
                return 0.0 if (np.isnan(f) or np.isinf(f)) else f
            try:
                return {
                    "mae": safe_float(mean_absolute_error(y_true, y_pred)),
                    "rmse": safe_float(np.sqrt(mean_squared_error(y_true, y_pred))),
                    "r2": safe_float(r2_score(y_true, y_pred)) if len(y_true) >= 2 else 0.0
                }
            except Exception:
                return {"mae": 0.0, "rmse": 0.0, "r2": 0.0}
            
        eval_results = {
            "baseline": calc_metrics(y_test, baseline_preds),
            "xgboost": calc_metrics(y_test, xgb_preds)
        }
        
        future_periods = 4
        future_dates = pd.date_range(start=features_df.index[-1] + pd.Timedelta(days=1 if freq == 'D' else 7), periods=future_periods, freq=freq)
        
        hist_vals = list(agg_df[target_col].values[-3:])
        future_preds = []
        for dt in future_dates:
            feat = {
                'year': dt.year,
                'month': dt.month,
                'day': dt.day,
                'day_of_week': dt.dayofweek,
                'lag_1': hist_vals[-1],
                'lag_2': hist_vals[-2],
                'rolling_mean_3': float(np.mean(hist_vals[-3:])),
                'rolling_std_3': float(np.std(hist_vals[-3:])) if len(hist_vals) >=3 else 0.0
            }
            
            pred = float(xgb_model.predict(pd.DataFrame([feat]))[0])
            future_preds.append({
                "date": str(dt.date()),
                "predicted_demand": max(0.0, pred)
            })
            hist_vals.append(pred)

        # Baseline Moving Average Future Projections
        baseline_hist = list(agg_df[target_col].values[-3:])
        for p in future_preds:
            b_pred = float(np.mean(baseline_hist[-3:]))
            p["baseline_demand"] = max(0.0, b_pred)
            baseline_hist.append(b_pred)
            
        chart_data = []
        for date, actual, base, xgb_pred in zip(test.index, y_test, baseline_preds, xgb_preds):
            chart_data.append({
                "date": str(date.date()),
                "actual": float(actual),
                "baseline": float(base) if pd.notna(base) else 0.0,
                "xgboost": float(xgb_pred)
            })

        # Complete historical timeline for continuous chart visualization
        historical_data = [
            {
                "date": str(idx.date()),
                "actual": float(val)
            }
            for idx, val in agg_df[target_col].items()
        ]

        # Preceding historical period demand for expected change comparison
        preceding_history = agg_df[target_col].tail(future_periods)
        preceding_demand = float(preceding_history.sum()) if not preceding_history.empty else 0.0

        # Product-level forecasts if product column is available
        product_forecasts = []
        if mapping.get('product') and mapping['product'] in valid_dates.columns:
            try:
                prod_col = mapping['product']
                cat_col = mapping.get('category')
                
                recent_cutoff = agg_df.index[-1] - pd.Timedelta(days=future_periods * (7 if freq == 'W' else 1))
                recent_df = valid_dates[valid_dates['_parsed_date'] >= recent_cutoff]
                if len(recent_df) < 5:
                    recent_df = valid_dates
                    
                prod_summary = recent_df.groupby(prod_col)[target_col].sum().sort_values(ascending=False).head(10)
                total_recent = float(recent_df[target_col].sum())
                total_predicted = float(sum(p["predicted_demand"] for p in future_preds))
                
                for rank, (p_name, p_prev) in enumerate(prod_summary.items(), start=1):
                    share = (float(p_prev) / total_recent) if total_recent > 0 else 0.0
                    p_pred = max(0.0, float(total_predicted * share))
                    pct_change = ((p_pred - float(p_prev)) / float(p_prev) * 100) if float(p_prev) > 0 else 0.0
                    
                    cat_name = None
                    if cat_col and cat_col in valid_dates.columns:
                        cat_series = valid_dates[valid_dates[prod_col] == p_name][cat_col].dropna()
                        if not cat_series.empty:
                            cat_name = str(cat_series.iloc[0])
                            
                    product_forecasts.append({
                        "rank": rank,
                        "product_id": str(p_name),
                        "product_name": str(p_name),
                        "category": cat_name,
                        "previous_demand": round(float(p_prev), 2),
                        "predicted_demand": round(p_pred, 2),
                        "expected_change": round(pct_change, 1)
                    })
            except Exception:
                product_forecasts = []
            
        target_metric = "Quantity" if target_col == mapping.get('quantity') else "Revenue"
        unit = "units" if target_col == mapping.get('quantity') else "$"

        return {
            "evaluation": eval_results,
            "test_chart_data": chart_data,
            "future_forecast": future_preds,
            "frequency": "Weekly" if freq == 'W' else "Daily",
            "target_metric": target_metric,
            "unit": unit,
            "historical_data": historical_data,
            "product_forecasts": product_forecasts,
            "historical_summary": {
                "total_periods": len(agg_df),
                "preceding_demand": round(preceding_demand, 2)
            },
            "methods": {
                "baseline": {
                    "name": "Moving Average (Baseline)",
                    "type": "Lag & Moving Average Baseline",
                    "description": "Uses recent historical values to estimate future demand. It provides a simple baseline for comparison.",
                    "mae": eval_results["baseline"]["mae"],
                    "rmse": eval_results["baseline"]["rmse"],
                    "r2": eval_results["baseline"]["r2"]
                },
                "xgboost": {
                    "name": "XGBoost Machine Learning Model",
                    "type": "Gradient Boosted Regression Trees",
                    "description": "Learns patterns from historical observations to estimate future demand. It may capture more complex patterns when enough suitable data is available.",
                    "mae": eval_results["xgboost"]["mae"],
                    "rmse": eval_results["xgboost"]["rmse"],
                    "r2": eval_results["xgboost"]["r2"]
                }
            },
            "selected_method": "XGBoost Machine Learning Model"
        }
    except Exception as e:
        return {"error": f"Forecasting error: {str(e)}"}
