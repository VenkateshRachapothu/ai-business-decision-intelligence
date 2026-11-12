import os
import shutil
import pandas as pd
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

from ..core.database import get_db
from ..core.config import settings
from ..models.dataset import Dataset
from ..models.user import User
from ..schemas.dataset import DatasetResponse
from .auth import get_current_user

router = APIRouter()

def read_csv_with_fallback(file_path, **kwargs) -> pd.DataFrame:
    encodings = ["utf-8", "utf-8-sig", "windows-1252", "latin1"]
    last_err = None
    for enc in encodings:
        try:
            if hasattr(file_path, "seek"):
                file_path.seek(0)
            return pd.read_csv(file_path, encoding=enc, **kwargs)
        except (UnicodeDecodeError, UnicodeError) as e:
            last_err = e
            continue
    raise last_err or Exception(f"Unable to decode CSV file: {file_path}")

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}

@router.post("/upload", response_model=DatasetResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    safe_filename = os.path.basename(file.filename or "dataset")
    _, ext = os.path.splitext(safe_filename)
    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file format: {ext}")
        
    file_location = os.path.join(settings.UPLOADS_DIR, f"{current_user.id}_{safe_filename}")
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)

    estimated_rows = None
    try:
        if ext.lower() == ".csv":
            df = read_csv_with_fallback(file_location, nrows=5)
            try:
                with open(file_location, "rb") as f:
                    total_lines = 0
                    last_byte = b""
                    for buf in iter(lambda: f.read(1024 * 1024), b''):
                        total_lines += buf.count(b'\n')
                        last_byte = buf[-1:]
                    if last_byte and last_byte != b'\n':
                        total_lines += 1
                    estimated_rows = max(0, total_lines - 1)
            except Exception:
                estimated_rows = None
        else:
            df = pd.read_excel(file_location, nrows=5)
        cols = len(df.columns)
    except Exception as e:
        if os.path.exists(file_location):
            os.remove(file_location)
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")

    dataset = Dataset(
        user_id=current_user.id,
        name=safe_filename,
        original_filename=safe_filename,
        dataset_type=ext.lower()[1:],
        file_format=ext.lower()[1:],
        column_count=cols,
        row_count=estimated_rows,
        original_file_location=file_location,
        processing_status="uploaded"
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    
    return dataset

@router.delete("/{dataset_id}")
@router.delete("/{dataset_id}/")
def delete_dataset(dataset_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    orig_file = dataset.original_file_location
    if orig_file and os.path.exists(orig_file):
        other_ref_count = db.query(Dataset).filter(
            Dataset.original_file_location == orig_file,
            Dataset.id != dataset.id
        ).count()
        if other_ref_count == 0:
            try:
                os.remove(orig_file)
            except Exception:
                pass

    proc_file = dataset.processed_file_location
    if proc_file and os.path.exists(proc_file):
        other_proc_count = db.query(Dataset).filter(
            Dataset.processed_file_location == proc_file,
            Dataset.id != dataset.id
        ).count()
        if other_proc_count == 0:
            try:
                os.remove(proc_file)
            except Exception:
                pass

    summary_path = os.path.join(settings.PROCESSED_DATA_DIR, f"{dataset_id}_summary.json")
    if os.path.exists(summary_path):
        try:
            os.remove(summary_path)
        except Exception:
            pass

    quality_cache_path = os.path.join(settings.PROCESSED_DATA_DIR, f"{dataset_id}_quality.json")
    if os.path.exists(quality_cache_path):
        try:
            os.remove(quality_cache_path)
        except Exception:
            pass

    understanding_cache_path = os.path.join(settings.PROCESSED_DATA_DIR, f"{dataset_id}_understanding.json")
    if os.path.exists(understanding_cache_path):
        try:
            os.remove(understanding_cache_path)
        except Exception:
            pass

    try:
        from chatbot.context import _CHATBOT_CONTEXT_CACHE
        _CHATBOT_CONTEXT_CACHE.pop(dataset_id, None)
    except Exception:
        pass

    db.delete(dataset)
    db.commit()

    return {"message": "Dataset deleted successfully", "id": dataset_id}

@router.get("", response_model=List[DatasetResponse])
def get_datasets(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    datasets = db.query(Dataset).filter(Dataset.user_id == current_user.id).all()
    return datasets

@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_dataset(dataset_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset

@router.get("/{dataset_id}/preview")
def preview_dataset(
    dataset_id: int, 
    limit: int = 20, 
    version: str = "auto", 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    clamped_limit = max(1, min(limit, 20))
    has_cleaned = bool(dataset.processed_file_location and os.path.exists(dataset.processed_file_location))
    
    if version == "original":
        file_to_read = dataset.original_file_location
    elif version == "cleaned":
        file_to_read = dataset.processed_file_location if has_cleaned else dataset.original_file_location
    else:  # auto
        file_to_read = dataset.processed_file_location if has_cleaned else dataset.original_file_location
    
    try:
        if dataset.dataset_type == "csv":
            df = read_csv_with_fallback(file_to_read, nrows=clamped_limit)
        else:
            df = pd.read_excel(file_to_read, nrows=clamped_limit)
        
        return {
            "columns": list(df.columns),
            "rows": df.astype(object).where(pd.notna(df), "").to_dict(orient="records"),
            "version_used": "cleaned" if (has_cleaned and file_to_read == dataset.processed_file_location) else "original",
            "has_cleaned_version": has_cleaned,
            "preview_count": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{dataset_id}/quality")
def dataset_quality(dataset_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    quality_cache_path = os.path.join(settings.PROCESSED_DATA_DIR, f"{dataset_id}_quality.json")
    target_file = dataset.original_file_location

    if os.path.exists(quality_cache_path) and os.path.exists(target_file):
        try:
            current_mtime = os.path.getmtime(target_file)
            import json
            with open(quality_cache_path, "r", encoding="utf-8") as f:
                cached = json.load(f)
            if cached.get("_file_mtime") == current_mtime:
                return {
                    "rows": cached["rows"],
                    "columns": cached["columns"],
                    "column_types": cached["column_types"],
                    "missing_values": cached["missing_values"],
                    "missing_percentage": cached["missing_percentage"],
                    "duplicates": cached["duplicates"]
                }
        except Exception:
            pass

    summary_path = os.path.join(settings.PROCESSED_DATA_DIR, f"{dataset_id}_summary.json")
    if dataset.processing_status == "cleaned" and os.path.exists(summary_path):
        try:
            import json
            with open(summary_path, "r", encoding="utf-8") as f:
                s_data = json.load(f)
            if s_data.get("cleaned_row_count") is not None:
                return {
                    "rows": s_data.get("cleaned_row_count"),
                    "columns": dataset.column_count or len(s_data.get("columns_transformed", [])),
                    "column_types": {},
                    "missing_values": {},
                    "missing_percentage": {},
                    "duplicates": 0
                }
        except Exception:
            pass

    try:
        if dataset.dataset_type == "csv":
            df = read_csv_with_fallback(target_file)
        else:
            df = pd.read_excel(target_file)
            
        dataset.row_count = len(df)
        dataset.column_count = len(df.columns)
        db.commit()

        missing = {str(k): int(v) for k, v in df.isnull().sum().to_dict().items()}
        duplicates = int(df.duplicated().sum())
        types = {str(k): str(v) for k, v in df.dtypes.astype(str).to_dict().items()}
        
        pct_series = (df.isnull().sum() / len(df) * 100) if len(df) > 0 else df.isnull().sum()
        missing_pct = {str(k): float(v) for k, v in pct_series.fillna(0).to_dict().items()}
        
        result_data = {
            "rows": int(len(df)),
            "columns": int(len(df.columns)),
            "column_types": types,
            "missing_values": missing,
            "missing_percentage": missing_pct,
            "duplicates": duplicates
        }

        try:
            import json
            cache_payload = dict(result_data)
            cache_payload["_file_mtime"] = os.path.getmtime(target_file)
            with open(quality_cache_path, "w", encoding="utf-8") as f:
                json.dump(cache_payload, f)
        except Exception:
            pass

        return result_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{dataset_id}/understanding")
def get_dataset_understanding(dataset_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    understanding_cache_path = os.path.join(settings.PROCESSED_DATA_DIR, f"{dataset_id}_understanding.json")
    if dataset.processing_status == "cleaned" and isinstance(dataset.processed_file_location, str) and os.path.exists(dataset.processed_file_location):
        target_file = dataset.processed_file_location
    else:
        target_file = dataset.original_file_location
        if not target_file or not os.path.exists(target_file):
            target_file = dataset.processed_file_location
    
    if not target_file or not os.path.exists(target_file):
        raise HTTPException(status_code=404, detail="Dataset file not found on disk")
        
    # Check cache validity using mtime and presence of enhanced fields
    if os.path.exists(understanding_cache_path):
        try:
            mtime = os.path.getmtime(target_file)
            import json
            with open(understanding_cache_path, "r", encoding="utf-8") as f:
                cached = json.load(f)
            if (
                cached.get("_file_mtime") == mtime
                and "columns_meta" in cached
                and "dataset_title" in cached
                and "unique_counts" in cached
            ):
                return cached
        except Exception:
            pass

    try:
        if dataset.dataset_type == "csv":
            df = read_csv_with_fallback(target_file)
        else:
            df = pd.read_excel(target_file)
            
        rows_count = int(len(df))
        cols_count = int(len(df.columns))
        
        # 1. Map business columns using analytics heuristics
        from ..services.analytics_service import map_columns
        mapping = map_columns(df)
        
        # Additional heuristics for customer, category, order, revenue, status
        cols_lower = {str(c).lower(): c for c in df.columns}
        customer_col = None
        category_col = mapping.get('category')
        order_col = mapping.get('order')
        revenue_col = mapping.get('revenue')
        price_col = mapping.get('price')
        quantity_col = mapping.get('quantity')
        date_col = mapping.get('date')
        product_col = mapping.get('product')
        location_col = mapping.get('location')

        for lower, orig in cols_lower.items():
            if not customer_col and any(x in lower for x in ['customer', 'user', 'client', 'buyer', 'account', 'cust_id']):
                customer_col = orig
            if not category_col and any(x in lower for x in ['category', 'dept', 'department', 'product_type', 'segment', 'class']):
                category_col = orig
            norm_lower = lower.replace(' ', '_')
            if not order_col and orig != date_col and any(x in norm_lower for x in ['order_id', 'invoice_no', 'invoiceno', 'invoice_id', 'transaction_id', 'trans_id', 'bill_no', 'order_no']):
                order_col = orig
            if not revenue_col and orig != date_col and pd.api.types.is_numeric_dtype(df[orig]) and any(x in norm_lower for x in ['revenue', 'sales', 'total_amount', 'total_price', 'amount', 'net_sales']):
                revenue_col = orig
            if not price_col and orig != revenue_col and pd.api.types.is_numeric_dtype(df[orig]) and any(x in norm_lower for x in ['price', 'unitprice', 'unit_price', 'payment_value', 'cost']):
                price_col = orig
            if not product_col and orig != category_col and orig != date_col and any(x in norm_lower for x in ['stockcode', 'product', 'item', 'description', 'sku', 'product_name']):
                product_col = orig

        business_columns = {
            "date": date_col,
            "product": product_col,
            "customer": customer_col,
            "category": category_col,
            "location": location_col,
            "quantity": quantity_col,
            "revenue": revenue_col,
            "order": order_col,
            "price": price_col
        }

        # 2. Parse date range if date column present
        date_range = None
        if business_columns['date'] and business_columns['date'] in df.columns:
            try:
                # Sample evenly across rows to capture full timeline accurately and efficiently
                sample_step = max(1, len(df) // 1000)
                sampled_dates = df[business_columns['date']].dropna().iloc[::sample_step]
                date_series = pd.to_datetime(sampled_dates, errors='coerce').dropna()
                if not date_series.empty:
                    date_range = {
                        "column": business_columns['date'],
                        "start": str(date_series.min().strftime('%Y-%m-%d')),
                        "end": str(date_series.max().strftime('%Y-%m-%d'))
                    }
            except Exception:
                pass

        # 3. Numeric metric ranges (revenue, price, quantity)
        numeric_metrics = {}
        for metric_name in ['revenue', 'price', 'quantity']:
            col = business_columns.get(metric_name)
            if col and col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                series = df[col].dropna()
                if not series.empty:
                    numeric_metrics[metric_name] = {
                        "column": col,
                        "min": round(float(series.min()), 2),
                        "max": round(float(series.max()), 2),
                        "mean": round(float(series.mean()), 2)
                    }

        # 4. Sample products, categories, locations
        samples = {}
        for sample_key in ['product', 'category', 'location']:
            col = business_columns.get(sample_key)
            if col and col in df.columns:
                unique_vals = [str(x) for x in df[col].dropna().unique()[:4] if str(x).strip()]
                if unique_vals:
                    samples[sample_key] = unique_vals

        # 5. Calculate real unique entity counts without fabricating
        unique_counts = {}
        for entity_key, col in [
            ("products", business_columns.get("product")),
            ("orders", business_columns.get("order")),
            ("customers", business_columns.get("customer")),
            ("categories", business_columns.get("category")),
            ("locations", business_columns.get("location"))
        ]:
            if col and col in df.columns:
                try:
                    unique_counts[entity_key] = int(df[col].nunique(dropna=True))
                except Exception:
                    unique_counts[entity_key] = None
            else:
                unique_counts[entity_key] = None

        # 6. Quality metrics (nulls & duplicates)
        total_missing = int(df.isnull().sum().sum())
        duplicates_count = int(df.duplicated().sum())
        cols_with_missing = [str(c) for c, cnt in df.isnull().sum().items() if cnt > 0]

        # 7. Inferred dataset domain, title & confidence score
        matched_dims = 0
        for dim in ['product', 'order', 'customer', 'date', 'location', 'category']:
            if business_columns.get(dim):
                matched_dims += 1
        if business_columns.get('revenue') or business_columns.get('price'):
            matched_dims += 1
        if business_columns.get('quantity'):
            matched_dims += 1

        if matched_dims >= 6:
            confidence = 0.98
        elif matched_dims == 5:
            confidence = 0.95
        elif matched_dims == 4:
            confidence = 0.88
        elif matched_dims == 3:
            confidence = 0.78
        elif matched_dims == 2:
            confidence = 0.65
        elif matched_dims == 1:
            confidence = 0.50
        else:
            confidence = None

        # Inferred domain and title
        if business_columns['product'] and (business_columns['revenue'] or business_columns['price'] or business_columns['order']):
            domain = "Retail & E-Commerce Transactions"
            if business_columns['customer']:
                dataset_title = "Retail Transactions & Customer Orders Dataset"
            else:
                dataset_title = "Retail Transactions Dataset"
        elif business_columns['customer'] and business_columns['order']:
            domain = "Customer Orders & Account Activity"
            dataset_title = "Customer Orders Dataset"
        elif business_columns['revenue'] and business_columns['location'] and business_columns['date']:
            domain = "Regional Sales & Financial Revenue"
            dataset_title = "Regional Sales & Revenue Dataset"
        elif business_columns['product'] and business_columns['quantity']:
            domain = "Inventory & Product Distribution"
            dataset_title = "Inventory & Product Distribution Dataset"
        elif business_columns['date'] and (business_columns['revenue'] or business_columns['quantity']):
            domain = "Time-Series Business Metrics"
            dataset_title = "Time-Series Business Dataset"
        elif business_columns['product']:
            domain = "Product Catalog & Items"
            dataset_title = "Product Catalog Dataset"
        elif business_columns['customer']:
            domain = "Customer Profiles & Accounts"
            dataset_title = "Customer Directory Dataset"
        else:
            domain = "Tabular Business Profile"
            dataset_title = "Dataset Profile"

        # 8. Supported business entities list (truthfully grounded in dataset)
        contained_entities = []
        if business_columns['product'] and business_columns['product'] in df.columns:
            p_col = business_columns['product']
            p_cnt = unique_counts.get("products")
            p_samples = samples.get("product", [])
            detail_p = f"{p_cnt:,} distinct catalog items" if p_cnt is not None else "Product catalog items"
            if p_samples:
                detail_p += f" (e.g. {', '.join(p_samples[:2])})"
            contained_entities.append({
                "key": "products",
                "label": "Products & Items",
                "column": p_col,
                "detail": detail_p,
                "count": p_cnt,
                "samples": p_samples
            })

        if business_columns['order'] and business_columns['order'] in df.columns:
            o_col = business_columns['order']
            o_cnt = unique_counts.get("orders")
            detail_o = f"{o_cnt:,} distinct orders/transactions" if o_cnt is not None else "Order identifiers"
            contained_entities.append({
                "key": "orders",
                "label": "Orders & Transactions",
                "column": o_col,
                "detail": detail_o,
                "count": o_cnt
            })

        if business_columns['customer'] and business_columns['customer'] in df.columns:
            c_col = business_columns['customer']
            c_cnt = unique_counts.get("customers")
            detail_c = f"{c_cnt:,} distinct customer accounts" if c_cnt is not None else "Customer identifiers"
            contained_entities.append({
                "key": "customers",
                "label": "Customer Information",
                "column": c_col,
                "detail": detail_c,
                "count": c_cnt
            })

        if business_columns['revenue'] or business_columns['price']:
            rp_col = business_columns['revenue'] or business_columns['price']
            rp_metric = numeric_metrics.get("revenue") or numeric_metrics.get("price")
            detail_rp = f"Monetary values averaging {rp_metric['mean']:,.2f} (range: {rp_metric['min']:,.2f} to {rp_metric['max']:,.2f})" if rp_metric else "Pricing and sales revenue fields"
            contained_entities.append({
                "key": "revenue_price",
                "label": "Prices & Revenue",
                "column": rp_col,
                "detail": detail_rp,
                "metric": rp_metric
            })

        if business_columns['quantity'] and business_columns['quantity'] in df.columns:
            q_col = business_columns['quantity']
            q_metric = numeric_metrics.get("quantity")
            detail_q = f"Quantities averaging {q_metric['mean']:,.1f} units (range: {q_metric['min']:,} to {q_metric['max']:,})" if q_metric else "Order item quantities"
            contained_entities.append({
                "key": "quantities",
                "label": "Quantities & Volumes",
                "column": q_col,
                "detail": detail_q,
                "metric": q_metric
            })

        if date_range:
            contained_entities.append({
                "key": "dates",
                "label": "Dates & Time Periods",
                "column": date_range["column"],
                "detail": f"Timeline spanning {date_range['start']} to {date_range['end']}",
                "date_range": date_range
            })

        if business_columns['category'] and business_columns['category'] in df.columns:
            cat_col = business_columns['category']
            cat_cnt = unique_counts.get("categories")
            cat_samples = samples.get("category", [])
            detail_cat = f"{cat_cnt:,} categories" if cat_cnt is not None else "Department / categories"
            if cat_samples:
                detail_cat += f" (e.g. {', '.join(cat_samples[:2])})"
            contained_entities.append({
                "key": "categories",
                "label": "Categories & Segments",
                "column": cat_col,
                "detail": detail_cat,
                "count": cat_cnt,
                "samples": cat_samples
            })

        if business_columns['location'] and business_columns['location'] in df.columns:
            loc_col = business_columns['location']
            loc_cnt = unique_counts.get("locations")
            loc_samples = samples.get("location", [])
            detail_loc = f"{loc_cnt:,} distinct locations" if loc_cnt is not None else "Geographic locations"
            if loc_samples:
                detail_loc += f" (e.g. {', '.join(loc_samples[:2])})"
            contained_entities.append({
                "key": "locations",
                "label": "Geographic Locations",
                "column": loc_col,
                "detail": detail_loc,
                "count": loc_cnt,
                "samples": loc_samples
            })

        # 9. Important Columns Table (Schema & Inferred Meanings)
        columns_meta = []
        for col in df.columns:
            col_str = str(col)
            col_lower = col_str.lower()
            
            # Meaning & Role derivation
            role = "General Business Attribute"
            is_uncertain = True
            
            if col == business_columns.get('product'):
                role = "Product Identifier / Description"
                is_uncertain = False
            elif col == business_columns.get('order'):
                role = "Order / Transaction Identifier"
                is_uncertain = False
            elif col == business_columns.get('customer'):
                role = "Customer Account Identifier"
                is_uncertain = False
            elif col == business_columns.get('date'):
                role = "Transaction Date / Timestamp"
                is_uncertain = False
            elif col == business_columns.get('price'):
                role = "Unit Price / Cost"
                is_uncertain = False
            elif col == business_columns.get('quantity'):
                role = "Order Quantity / Volume"
                is_uncertain = False
            elif col == business_columns.get('revenue'):
                role = "Sales Revenue Metric"
                is_uncertain = False
            elif col == business_columns.get('category'):
                role = "Product Category / Department"
                is_uncertain = False
            elif col == business_columns.get('location'):
                role = "Geographic Location / Country"
                is_uncertain = False
            elif any(x in col_lower for x in ['status', 'state']) and not any(x in col_lower for x in ['country', 'province', 'state_code']):
                role = "Fulfillment / Order Status"
                is_uncertain = False
            elif any(x in col_lower for x in ['discount', 'promo', 'rebate']):
                role = "Discount / Promotion Metric"
                is_uncertain = False
            elif any(x in col_lower for x in ['tax', 'vat', 'gst', 'fee']):
                role = "Tax / Surcharge Metric"
                is_uncertain = False
            elif any(x in col_lower for x in ['stock', 'sku', 'code', 'part_number']):
                role = "Item / Catalog Code"
                is_uncertain = False
            elif any(x in col_lower for x in ['desc', 'title', 'item_name', 'name']):
                role = "Item Name / Description"
                is_uncertain = False
            elif pd.api.types.is_numeric_dtype(df[col]):
                role = "Numeric Business Metric"
                is_uncertain = True
            elif pd.api.types.is_datetime64_any_dtype(df[col]):
                role = "Date / Timestamp"
                is_uncertain = True
            elif pd.api.types.is_bool_dtype(df[col]):
                role = "Boolean Flag"
                is_uncertain = False
            else:
                role = "Descriptive Attribute (Uncertain)"
                is_uncertain = True

            # Readable Data Type
            if pd.api.types.is_integer_dtype(df[col]):
                dtype_name = "Integer"
            elif pd.api.types.is_float_dtype(df[col]):
                dtype_name = "Decimal"
            elif pd.api.types.is_datetime64_any_dtype(df[col]) or (business_columns.get('date') == col):
                dtype_name = "Date / Time"
            elif pd.api.types.is_bool_dtype(df[col]):
                dtype_name = "Boolean"
            else:
                dtype_name = "Text"

            # Example Value handling nulls & sensitive info
            non_null = df[col].dropna()
            if non_null.empty:
                example_val = "—"
            else:
                raw = non_null.iloc[0]
                if any(x in col_lower for x in ['password', 'secret', 'token', 'ssn', 'credit_card', 'cvv']):
                    example_val = "••••••••"
                elif isinstance(raw, float):
                    example_val = f"{raw:,.2f}" if abs(raw) < 1e9 else f"{raw:.2e}"
                elif isinstance(raw, (int, np.integer)):
                    example_val = f"{raw:,}"
                else:
                    raw_str = str(raw).strip()
                    example_val = (raw_str[:38] + "...") if len(raw_str) > 40 else raw_str

            try:
                col_unique = int(df[col].nunique(dropna=True))
            except Exception:
                col_unique = None
                
            col_nulls = int(df[col].isnull().sum())

            columns_meta.append({
                "name": col_str,
                "role": role,
                "is_uncertain": is_uncertain,
                "data_type": dtype_name,
                "example_value": example_val,
                "unique_count": col_unique,
                "null_count": col_nulls
            })

        # 10. Downstream Feasible Business Analyses
        feasible_analyses = []
        if business_columns['date']:
            feasible_analyses.append({
                "name": "Trend Analysis",
                "feasible": True,
                "reason": f"Historical date field '{business_columns['date']}' is present."
            })
        else:
            feasible_analyses.append({
                "name": "Trend Analysis",
                "feasible": False,
                "reason": "Unavailable — no date column was identified."
            })

        if business_columns['product']:
            feasible_analyses.append({
                "name": "Product Intelligence",
                "feasible": True,
                "reason": f"Product identifier '{business_columns['product']}' is present."
            })
        else:
            feasible_analyses.append({
                "name": "Product Intelligence",
                "feasible": False,
                "reason": "Unavailable — no product identifier was identified."
            })

        if business_columns['customer']:
            feasible_analyses.append({
                "name": "Customer Purchasing Analysis",
                "feasible": True,
                "reason": f"Customer account field '{business_columns['customer']}' is present."
            })
        else:
            feasible_analyses.append({
                "name": "Customer Purchasing Analysis",
                "feasible": False,
                "reason": "Unavailable — no customer identifier was identified."
            })

        if business_columns['revenue'] or (business_columns['quantity'] and business_columns['price']):
            rev_display = business_columns['revenue'] or f"{business_columns['quantity']} * {business_columns['price']}"
            feasible_analyses.append({
                "name": "Financial & Revenue KPIs",
                "feasible": True,
                "reason": f"Monetary pricing/revenue field '{rev_display}' is present."
            })
        else:
            feasible_analyses.append({
                "name": "Financial & Revenue KPIs",
                "feasible": False,
                "reason": "Unavailable — price or revenue field was not found."
            })

        if business_columns['location']:
            feasible_analyses.append({
                "name": "Geographic Analysis",
                "feasible": True,
                "reason": f"Location/country field '{business_columns['location']}' is present."
            })
        else:
            feasible_analyses.append({
                "name": "Geographic Analysis",
                "feasible": False,
                "reason": "Unavailable — geographic location field was not found."
            })

        if business_columns['date'] and (business_columns['quantity'] or business_columns['revenue']):
            feasible_analyses.append({
                "name": "Demand Forecasting",
                "feasible": True,
                "reason": "Timestamped sequence with measurable sales volume is available."
            })
        else:
            feasible_analyses.append({
                "name": "Demand Forecasting",
                "feasible": False,
                "reason": "Unavailable — requires date and quantity or revenue fields."
            })

        # 11. Plain-English Business Summary
        summary_sentences = []
        if dataset_title != "Dataset Profile":
            summary_sentences.append(f"This dataset is identified as a {dataset_title} containing {rows_count:,} records across {cols_count} columns.")
        else:
            summary_sentences.append(f"This dataset contains {rows_count:,} tabular business records across {cols_count} columns.")

        learnings = []
        if business_columns['product']:
            learnings.append("item demand and catalog performance")
        if business_columns['order']:
            learnings.append("transaction volume and purchasing patterns")
        if business_columns['customer']:
            learnings.append("customer account behavior and repeat purchasing")
        if business_columns['revenue'] or business_columns['price']:
            learnings.append("pricing structures and monetary sales performance")
        if business_columns['quantity']:
            learnings.append("unit sales volume")
        if business_columns['date']:
            learnings.append("historical seasonality and temporal trends")
        if business_columns['location']:
            learnings.append("geographic distribution across regional markets")

        if learnings:
            summary_sentences.append(f"From this data, we can learn {', '.join(learnings)}.")
        else:
            summary_sentences.append("From this data, we can evaluate attribute distributions and data completeness.")

        # Capabilities dict for backward compatibility
        capabilities = {
            "forecasting": bool(business_columns['date'] and (business_columns['quantity'] or business_columns['revenue'])),
            "product_intelligence": bool(business_columns['product']),
            "geographic_analysis": bool(business_columns['location']),
            "trend_analysis": bool(business_columns['date']),
            "financial_kpis": bool(business_columns['revenue'] or (business_columns['quantity'] and business_columns['price']))
        }
        
        limitations = [a["reason"] for a in feasible_analyses if not a["feasible"]]

        result_payload = {
            "domain": domain,
            "dataset_title": dataset_title,
            "confidence": confidence,
            "summary_text": " ".join(summary_sentences),
            "rows": rows_count,
            "columns": cols_count,
            "business_columns": business_columns,
            "contained_entities": contained_entities,
            "unique_counts": unique_counts,
            "columns_meta": columns_meta,
            "feasible_analyses": feasible_analyses,
            "date_range": date_range,
            "numeric_metrics": numeric_metrics,
            "samples": samples,
            "capabilities": capabilities,
            "limitations": limitations,
            "quality": {
                "duplicates": duplicates_count,
                "total_missing": total_missing,
                "columns_with_missing": cols_with_missing
            },
            "_file_mtime": os.path.getmtime(target_file)
        }

        # Save cache
        try:
            import json
            with open(understanding_cache_path, "w", encoding="utf-8") as f:
                json.dump(result_payload, f)
        except Exception:
            pass

        return result_payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{dataset_id}/clean")
def clean_dataset(dataset_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    summary_path = os.path.join(settings.PROCESSED_DATA_DIR, f"{dataset_id}_summary.json")

    # If dataset is already cleaned and summary exists, return it immediately without re-processing
    if dataset.processing_status == "cleaned" and os.path.exists(summary_path):
        if dataset.processed_file_location and os.path.exists(dataset.processed_file_location):
            import json
            try:
                with open(summary_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass

    try:
        source_path = dataset.original_file_location
        if dataset.dataset_type == "csv":
            df = read_csv_with_fallback(source_path)
        else:
            df = pd.read_excel(source_path)
            
        orig_rows = len(df)
        orig_missing = int(df.isnull().sum().sum())
        
        # 1. Deduplication
        df_cleaned = df.drop_duplicates()
        dups_removed = orig_rows - len(df_cleaned)
        
        # 2. Vectorized String Whitespace Normalization (fast & preserves NaNs)
        for col in df_cleaned.select_dtypes(include=['object', 'str']):
            df_cleaned[col] = df_cleaned[col].map(lambda x: x.strip() if isinstance(x, str) else x)
            
        remaining_missing = int(df_cleaned.isnull().sum().sum())
        missing_handled = int(orig_missing - remaining_missing)
            
        base_filename = os.path.basename(dataset.original_filename or "dataset")
        if dataset.dataset_type == "csv":
            processed_path = os.path.join(settings.PROCESSED_DATA_DIR, f"{dataset_id}_cleaned_{base_filename}")
            df_cleaned.to_csv(processed_path, index=False)
        else:
            stem, ext = os.path.splitext(base_filename)
            out_name = f"{dataset_id}_cleaned_{stem}.xlsx" if ext.lower() == ".xls" else f"{dataset_id}_cleaned_{base_filename}"
            processed_path = os.path.join(settings.PROCESSED_DATA_DIR, out_name)
            df_cleaned.to_excel(processed_path, index=False)
            
        dataset.processed_file_location = processed_path
        dataset.processing_status = "cleaned"
        dataset.row_count = int(len(df_cleaned))
        db.commit()
        
        summary_data = {
            "original_row_count": int(orig_rows),
            "cleaned_row_count": int(len(df_cleaned)),
            "duplicates_removed": int(dups_removed),
            "original_duplicates": int(dups_removed),
            "remaining_duplicates": 0,
            "original_missing_values": int(orig_missing),
            "remaining_missing_values": int(remaining_missing),
            "missing_values_handled": int(missing_handled),
            "columns_transformed": [str(c) for c in df.columns],
            "status": "cleaned",
            "processed_file": processed_path
        }
        
        import json
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(summary_data, f)
            
        # Update quality cache with clean metrics so subsequent visits are instant
        quality_cache_path = os.path.join(settings.PROCESSED_DATA_DIR, f"{dataset_id}_quality.json")
        try:
            clean_quality = {
                "rows": int(len(df_cleaned)),
                "columns": int(len(df_cleaned.columns)),
                "column_types": {str(k): str(v) for k, v in df_cleaned.dtypes.astype(str).to_dict().items()},
                "missing_values": {str(k): int(v) for k, v in df_cleaned.isnull().sum().to_dict().items()},
                "missing_percentage": {str(k): float(v) for k, v in ((df_cleaned.isnull().sum() / len(df_cleaned) * 100) if len(df_cleaned) > 0 else df_cleaned.isnull().sum()).fillna(0).to_dict().items()},
                "duplicates": 0,
                "_file_mtime": os.path.getmtime(source_path)
            }
            with open(quality_cache_path, "w", encoding="utf-8") as f:
                json.dump(clean_quality, f)
        except Exception:
            pass

        # Invalidate understanding cache & chatbot context cache so clean metrics refresh immediately
        understanding_cache_path = os.path.join(settings.PROCESSED_DATA_DIR, f"{dataset_id}_understanding.json")
        if os.path.exists(understanding_cache_path):
            try:
                os.remove(understanding_cache_path)
            except Exception:
                pass

        try:
            from chatbot.context import _CHATBOT_CONTEXT_CACHE
            _CHATBOT_CONTEXT_CACHE.pop(dataset_id, None)
        except Exception:
            pass
        
        return summary_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{dataset_id}/cleaning-summary")
def cleaning_summary(dataset_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    if dataset.processing_status != "cleaned":
        return {"status": "not_cleaned_yet"}
        
    summary_path = os.path.join(settings.PROCESSED_DATA_DIR, f"{dataset_id}_summary.json")
    if os.path.exists(summary_path):
        import json
        with open(summary_path, "r") as f:
            return json.load(f)
            
    return {"status": dataset.processing_status, "processed_file": dataset.processed_file_location}

@router.get("/{dataset_id}/context")
def get_dataset_context(dataset_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from chatbot.context import get_or_build_dataset_context
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    try:
        file_path = dataset.processed_file_location or dataset.original_file_location
        full_context = get_or_build_dataset_context(
            dataset_id=dataset.id,
            dataset_name=dataset.original_filename or dataset.name,
            file_path=file_path
        )
        return full_context
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

