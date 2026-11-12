import pandas as pd
import numpy as np

def map_columns(df: pd.DataFrame):
    # Normalize column names for flexible matching
    cols = {c: c.lower().strip() for c in df.columns}
    
    mapping = {
        'quantity': None,
        'price': None,
        'date': None,
        'product': None,
        'category': None,
        'location': None,
        'order': None,
        'revenue': None
    }
    
    # 1. Date Heuristics
    for orig_col, lower_col in cols.items():
        if any(x in lower_col for x in ['order_date', 'invoice_date', 'transaction_date', 'sale_date', 'date', 'timestamp', 'created_at', 'created', 'datetime']):
            mapping['date'] = orig_col
            break

    # 2. Revenue / Monetary Measure Heuristics (Numeric only)
    for orig_col, lower_col in cols.items():
        if pd.api.types.is_numeric_dtype(df[orig_col]):
            # Avoid columns with 'id', 'count', 'qty', 'weight', 'prefix'
            if not any(neg in lower_col for neg in ['id', 'count', 'qty', 'weight', 'prefix', 'code', 'zip']):
                if any(x in lower_col for x in ['subtotal', 'total_amount', 'total_price', 'total', 'revenue', 'sales', 'amount', 'payment_value', 'line_total']):
                    mapping['revenue'] = orig_col
                    break

    # 3. Price / Unit Price Heuristics
    for orig_col, lower_col in cols.items():
        if pd.api.types.is_numeric_dtype(df[orig_col]) and orig_col != mapping['revenue']:
            if any(x in lower_col for x in ['unit_price', 'unitprice', 'price', 'rate', 'item_price']):
                mapping['price'] = orig_col
                break

    # 4. Quantity Heuristics
    for orig_col, lower_col in cols.items():
        if pd.api.types.is_numeric_dtype(df[orig_col]) and orig_col not in [mapping['revenue'], mapping['price']]:
            if not any(neg in lower_col for neg in ['photo', 'image', 'pic', 'page', 'pack', 'min', 'max', 'lead']):
                if any(x in lower_col for x in ['quantity', 'qty', 'units', 'volume', 'order_item_quantity']):
                    mapping['quantity'] = orig_col
                    break

    # 5. Order / Transaction Identifier Heuristics
    for orig_col, lower_col in cols.items():
        if orig_col != mapping['date']:
            norm_col = lower_col.replace(' ', '_')
            if any(x in norm_col for x in ['order_id', 'invoice_no', 'invoiceno', 'invoice_id', 'transaction_id', 'order_no', 'order_number']) or lower_col in ['order', 'invoice', 'transaction']:
                mapping['order'] = orig_col
                break

    # 6. Category Heuristics (Prefer explicit category columns before segment/class/group)
    for orig_col, lower_col in cols.items():
        if any(x in lower_col for x in ['product_category_name', 'category', 'department', 'product_type', 'dept']):
            mapping['category'] = orig_col
            break
    if not mapping['category']:
        for orig_col, lower_col in cols.items():
            if any(x in lower_col for x in ['segment', 'class', 'group']):
                mapping['category'] = orig_col
                break

    # 7. Product / Item Identifier Heuristics
    for orig_col, lower_col in cols.items():
        if orig_col != mapping['category']:
            if any(x in lower_col for x in ['sku', 'product_id', 'product_name', 'item_id', 'item_name', 'stockcode', 'description', 'product', 'item', 'title']):
                mapping['product'] = orig_col
                break

    # 8. Location Heuristics
    for orig_col, lower_col in cols.items():
        if any(x in lower_col for x in ['seller_city', 'customer_city', 'city', 'seller_state', 'customer_state', 'state', 'country', 'region', 'location', 'territory', 'province']):
            mapping['location'] = orig_col
            break

    return mapping

def generate_analytics(df: pd.DataFrame):
    mapping = map_columns(df)
    total_rows = len(df)
    
    # Revenue Calculation
    has_revenue = False
    if '_calculated_revenue' in df.columns:
        has_revenue = True
    elif mapping['revenue'] and pd.api.types.is_numeric_dtype(df[mapping['revenue']]):
        df['_calculated_revenue'] = df[mapping['revenue']]
        has_revenue = True
    elif mapping['quantity'] and mapping['price'] and pd.api.types.is_numeric_dtype(df[mapping['quantity']]) and pd.api.types.is_numeric_dtype(df[mapping['price']]):
        df['_calculated_revenue'] = df[mapping['quantity']] * df[mapping['price']]
        has_revenue = True
        
    total_revenue = float(df['_calculated_revenue'].sum()) if has_revenue else None
    
    # Orders Calculation
    total_orders = None
    if mapping['order']:
        total_orders = int(df[mapping['order']].nunique())
    elif has_revenue or mapping['quantity']:
        total_orders = int(total_rows)
        
    # Quantity Calculation
    total_quantity = None
    if mapping['quantity'] and pd.api.types.is_numeric_dtype(df[mapping['quantity']]):
        total_quantity = float(df[mapping['quantity']].sum())
        
    # AOV and ASP
    aov = float(total_revenue / total_orders) if (total_revenue is not None and total_orders and total_orders > 0) else None
    asp = float(total_revenue / total_quantity) if (total_revenue is not None and total_quantity and total_quantity > 0) else None
    
    # Primary measure configuration for rankings and breakdowns
    if has_revenue:
        primary_measure = 'revenue'
        primary_label = 'Revenue ($)'
        primary_unit = '$'
    elif total_quantity is not None and total_quantity > 0:
        primary_measure = 'quantity'
        primary_label = 'Quantity (Units)'
        primary_unit = 'units'
    else:
        primary_measure = 'count'
        primary_label = 'Records'
        primary_unit = 'records'

    # Top & Low Products / Items
    top_products = []
    low_products = []
    if mapping['product']:
        try:
            prod_col = mapping['product']
            if has_revenue:
                prod_series = df.groupby(prod_col)['_calculated_revenue'].sum().sort_values(ascending=False)
            elif mapping['quantity'] and pd.api.types.is_numeric_dtype(df[mapping['quantity']]):
                prod_series = df.groupby(prod_col)[mapping['quantity']].sum().sort_values(ascending=False)
            else:
                prod_series = df[prod_col].value_counts()

            # Clean product identifiers for display
            top_products = [
                {
                    "name": str(k),
                    "revenue": float(v) if has_revenue else None,
                    "value": float(v),
                    "measure_label": primary_label,
                    "unit": primary_unit
                }
                for k, v in prod_series.head(5).items()
            ]
            if len(prod_series) > 5:
                low_products = [
                    {
                        "name": str(k),
                        "revenue": float(v) if has_revenue else None,
                        "value": float(v),
                        "measure_label": primary_label,
                        "unit": primary_unit
                    }
                    for k, v in prod_series.tail(5).items()
                ]
        except Exception:
            pass
        
    # Location Analysis
    sales_by_location = []
    if mapping['location']:
        try:
            loc_col = mapping['location']
            if has_revenue:
                loc_series = df.groupby(loc_col)['_calculated_revenue'].sum().sort_values(ascending=False)
            elif mapping['quantity'] and pd.api.types.is_numeric_dtype(df[mapping['quantity']]):
                loc_series = df.groupby(loc_col)[mapping['quantity']].sum().sort_values(ascending=False)
            else:
                loc_series = df[loc_col].value_counts()

            sales_by_location = [
                {
                    "location": str(k),
                    "revenue": float(v) if has_revenue else None,
                    "value": float(v),
                    "measure_label": primary_label,
                    "unit": primary_unit
                }
                for k, v in loc_series.head(10).items()
            ]
        except Exception:
            pass
        
    # Category Analysis
    sales_by_category = []
    if mapping.get('category'):
        try:
            cat_col = mapping['category']
            if has_revenue:
                cat_series = df.groupby(cat_col)['_calculated_revenue'].sum().sort_values(ascending=False)
            elif mapping['quantity'] and pd.api.types.is_numeric_dtype(df[mapping['quantity']]):
                cat_series = df.groupby(cat_col)[mapping['quantity']].sum().sort_values(ascending=False)
            else:
                cat_series = df[cat_col].value_counts()

            sales_by_category = [
                {
                    "category": str(k),
                    "revenue": float(v) if has_revenue else None,
                    "value": float(v),
                    "measure_label": primary_label,
                    "unit": primary_unit
                }
                for k, v in cat_series.head(10).items()
            ]
        except Exception:
            pass
        
    # Temporal Trends (Sales / Orders / Volume Over Time)
    sales_over_time = []
    if mapping['date']:
        try:
            if '_parsed_date' not in df.columns:
                df['_parsed_date'] = pd.to_datetime(df[mapping['date']], errors='coerce')
            valid_dates = df.dropna(subset=['_parsed_date']).copy()
            if len(valid_dates) > 0:
                # Group by month by default
                valid_dates['_period'] = valid_dates['_parsed_date'].dt.to_period('M')
                
                # Check period span; if all in single month, group by day
                if valid_dates['_period'].nunique() <= 1:
                    valid_dates['_period'] = valid_dates['_parsed_date'].dt.to_period('D')
                    
                agg_dict = {}
                if has_revenue:
                    agg_dict['_calculated_revenue'] = 'sum'
                if mapping['quantity'] and pd.api.types.is_numeric_dtype(df[mapping['quantity']]):
                    agg_dict[mapping['quantity']] = 'sum'
                if mapping['order']:
                    agg_dict[mapping['order']] = 'nunique'
                else:
                    agg_dict[mapping['date']] = 'count'
                    
                grouped = valid_dates.groupby('_period').agg(agg_dict)
                for period, row in grouped.iterrows():
                    period_data = {"date": str(period)}
                    if has_revenue:
                        period_data["revenue"] = float(row['_calculated_revenue'])
                        period_data["value"] = float(row['_calculated_revenue'])
                    if mapping['quantity'] and mapping['quantity'] in row:
                        period_data["quantity"] = float(row[mapping['quantity']])
                        if not has_revenue:
                            period_data["value"] = float(row[mapping['quantity']])
                    if mapping['order'] and mapping['order'] in row:
                        period_data["orders"] = int(row[mapping['order']])
                    elif mapping['date'] in row:
                        period_data["orders"] = int(row[mapping['date']])
                    if "value" not in period_data:
                        period_data["value"] = period_data.get("orders", 0)
                        
                    period_data["measure_label"] = primary_label
                    period_data["unit"] = primary_unit
                    sales_over_time.append(period_data)
        except Exception:
            pass

    # Categorical Distributions (e.g. status, segment, state)
    categorical_distributions = []
    used_cols = {mapping['category'], mapping['product'], mapping['location'], mapping['date'], mapping['order'], mapping['revenue'], mapping['price'], mapping['quantity']}
    for col in df.columns:
        if col.startswith('_') or col in used_cols:
            continue
        # Categorical or string column with 2 to 15 unique values (exclude purely numeric columns)
        if pd.api.types.is_numeric_dtype(df[col]):
            continue
        try:
            n_unique = df[col].nunique(dropna=True)
            if 2 <= n_unique <= 15:
                vc = df[col].value_counts(dropna=True).head(8)
                items = [
                    {
                        "name": str(name),
                        "count": int(count),
                        "percentage": round((count / total_rows) * 100, 1) if total_rows > 0 else 0
                    }
                    for name, count in vc.items()
                ]
                categorical_distributions.append({
                    "column": col,
                    "title": f"{col.replace('_', ' ').title()} Distribution",
                    "data": items,
                    "unit": "records"
                })
                if len(categorical_distributions) >= 2:
                    break
        except Exception:
            continue

    # Numeric Distributions (e.g. product weight, shipping, dimensions)
    numeric_distributions = []
    for col in df.columns:
        if col.startswith('_') or col in used_cols or col in [mapping['revenue'], mapping['price'], mapping['quantity']]:
            continue
        try:
            if pd.api.types.is_numeric_dtype(df[col]) and not any(k in col.lower() for k in ['id', 'zip', 'code', 'prefix']):
                clean_s = df[col].dropna()
                if len(clean_s) > 10 and clean_s.nunique() > 5:
                    # Create 5 bins
                    bins = pd.cut(clean_s, bins=5, precision=1)
                    bin_counts = bins.value_counts().sort_index()
                    items = [
                        {
                            "bin": f"{b.left:g} - {b.right:g}",
                            "count": int(cnt),
                            "percentage": round((cnt / len(clean_s)) * 100, 1)
                        }
                        for b, cnt in bin_counts.items()
                    ]
                    numeric_distributions.append({
                        "column": col,
                        "title": f"{col.replace('_', ' ').title()} Spread",
                        "data": items,
                        "unit": "items"
                    })
                    if len(numeric_distributions) >= 2:
                        break
        except Exception:
            continue

    # Assemble dynamic available charts list
    available_charts = []
    if sales_over_time:
        available_charts.append({
            "id": "trend",
            "title": f"Sales & Activity Trend ({primary_label})",
            "type": "line",
            "dataKey": "date",
            "valueKey": "revenue" if has_revenue else ("quantity" if mapping['quantity'] else "orders"),
            "unit": primary_unit,
            "measure_label": primary_label,
            "data": sales_over_time
        })
    if sales_by_category:
        available_charts.append({
            "id": "category",
            "title": f"Category Performance ({primary_label})",
            "type": "bar",
            "dataKey": "category",
            "valueKey": "value",
            "unit": primary_unit,
            "measure_label": primary_label,
            "data": sales_by_category
        })
    if top_products:
        available_charts.append({
            "id": "products",
            "title": f"Top Items & Products ({primary_label})",
            "type": "horizontal_bar",
            "dataKey": "name",
            "valueKey": "value",
            "unit": primary_unit,
            "measure_label": primary_label,
            "data": top_products
        })
    if sales_by_location:
        available_charts.append({
            "id": "location",
            "title": f"Geographic Distribution ({primary_label})",
            "type": "bar",
            "dataKey": "location",
            "valueKey": "value",
            "unit": primary_unit,
            "measure_label": primary_label,
            "data": sales_by_location
        })
    for dist in categorical_distributions:
        available_charts.append({
            "id": f"cat_dist_{dist['column']}",
            "title": dist["title"],
            "type": "bar",
            "dataKey": "name",
            "valueKey": "count",
            "unit": "records",
            "measure_label": "Record Count",
            "data": dist["data"]
        })
    for ndist in numeric_distributions:
        available_charts.append({
            "id": f"num_dist_{ndist['column']}",
            "title": ndist["title"],
            "type": "bar",
            "dataKey": "bin",
            "valueKey": "count",
            "unit": "items",
            "measure_label": "Distribution Count",
            "data": ndist["data"]
        })

    return {
        "summary": {
            "total_revenue": total_revenue,
            "total_orders": total_orders,
            "total_quantity": total_quantity,
            "aov": aov,
            "asp": asp,
            "total_rows": total_rows,
            "primary_measure": primary_measure,
            "primary_label": primary_label,
            "primary_unit": primary_unit
        },
        "top_products": top_products,
        "low_products": low_products,
        "sales_by_category": sales_by_category,
        "sales_by_location": sales_by_location,
        "sales_over_time": sales_over_time,
        "categorical_distributions": categorical_distributions,
        "numeric_distributions": numeric_distributions,
        "available_charts": available_charts,
        "column_mapping": mapping
    }

