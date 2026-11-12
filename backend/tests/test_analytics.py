import pandas as pd
from app.services.analytics_service import map_columns, generate_analytics

def test_map_columns():
    df = pd.DataFrame({
        "InvoiceDate": ["2020-01-01"],
        "StockCode": ["A1"],
        "Quantity": [10],
        "Price": [5.0],
        "Country": ["UK"],
        "Invoice": ["INV1"]
    })
    mapping = map_columns(df)
    assert mapping['quantity'] == 'Quantity'
    assert mapping['price'] == 'Price'
    assert mapping['date'] == 'InvoiceDate'
    assert mapping['product'] == 'StockCode'
    assert mapping['location'] == 'Country'
    assert mapping['order'] == 'Invoice'

def test_generate_analytics_basic():
    df = pd.DataFrame({
        "InvoiceDate": ["2020-01-01", "2020-01-02", "2020-01-02"],
        "StockCode": ["A1", "B1", "A1"],
        "Quantity": [10, 5, 2],
        "Price": [5.0, 10.0, 5.0],
        "Country": ["UK", "US", "UK"],
        "Invoice": ["INV1", "INV2", "INV3"]
    })
    
    analytics = generate_analytics(df)
    assert analytics['summary']['total_revenue'] == 110.0 # 50 + 50 + 10
    assert analytics['summary']['total_orders'] == 3
    assert analytics['summary']['total_quantity'] == 17
    
    assert len(analytics['top_products']) == 2
    assert analytics['top_products'][0]['name'] == 'A1'
    assert analytics['top_products'][0]['revenue'] == 60.0
    
    assert len(analytics['sales_by_location']) == 2
    assert analytics['sales_by_location'][0]['location'] == 'UK'
    assert analytics['sales_by_location'][0]['revenue'] == 60.0

def test_generate_analytics_missing_columns():
    df = pd.DataFrame({
        "StockCode": ["A1", "B1", "A1"],
        "Quantity": [10, 5, 2]
    })
    analytics = generate_analytics(df)
    assert analytics['summary']['total_revenue'] is None
    assert analytics['summary']['total_quantity'] == 17
    # Products are now ranked dynamically by quantity instead of remaining empty
    assert len(analytics['top_products']) == 2
    assert analytics['top_products'][0]['name'] == 'A1'
    assert analytics['top_products'][0]['value'] == 12.0

def test_generate_analytics_with_revenue_col():
    df = pd.DataFrame({
        "date": ["2020-01-01"],
        "product": ["P1"],
        "revenue": [100.0]
    })
    analytics = generate_analytics(df)
    assert analytics['summary']['total_revenue'] == 100.0

def test_generate_analytics_category():
    df = pd.DataFrame({
        "Product": ["P1", "P2"],
        "Category": ["Electronics", "Furniture"],
        "Revenue": [250.0, 150.0]
    })
    analytics = generate_analytics(df)
    assert len(analytics['sales_by_category']) == 2
    assert analytics['sales_by_category'][0]['category'] == 'Electronics'
    assert analytics['sales_by_category'][0]['revenue'] == 250.0

def test_dataset_scenario_1_dates_orders_revenue_quantity():
    # Scenario 1: Dates, orders, revenue, and quantities
    df = pd.DataFrame({
        "order_id": [101, 102, 103, 104],
        "order_date": ["2023-01-15", "2023-01-20", "2023-02-10", "2023-02-15"],
        "sku": ["SKU-A", "SKU-B", "SKU-A", "SKU-C"],
        "quantity": [2, 1, 5, 3],
        "unit_price": [50.0, 100.0, 50.0, 30.0],
        "total": [100.0, 100.0, 250.0, 90.0],
        "status": ["shipped", "shipped", "pending", "shipped"]
    })
    res = generate_analytics(df)
    assert res['summary']['total_revenue'] == 540.0
    assert res['summary']['total_orders'] == 4
    assert res['summary']['total_quantity'] == 11
    assert len(res['sales_over_time']) == 2 # Jan and Feb
    assert len(res['top_products']) == 3
    assert res['top_products'][0]['name'] == 'SKU-A'
    assert res['top_products'][0]['value'] == 350.0
    assert len(res['categorical_distributions']) >= 1
    assert res['categorical_distributions'][0]['column'] == 'status'
    assert len(res['available_charts']) >= 3

def test_dataset_scenario_2_products_categories_no_monetary():
    # Scenario 2: Product and category information, no monetary or date fields
    df = pd.DataFrame({
        "product_id": [f"prod_{i}" for i in range(12)],
        "product_category_name": ["furniture"] * 7 + ["office"] * 5,
        "product_photos_qty": [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4],
        "product_weight_g": [150, 300, 450, 600, 200, 350, 500, 650, 250, 400, 550, 700]
    })
    res = generate_analytics(df)
    assert res['summary']['total_revenue'] is None
    assert res['summary']['primary_measure'] == 'count'
    assert len(res['sales_by_category']) == 2
    assert res['sales_by_category'][0]['category'] == 'furniture'
    assert res['sales_by_category'][0]['value'] == 7
    assert len(res['top_products']) == 5
    assert len(res['numeric_distributions']) >= 1
    assert len(res['available_charts']) >= 2

def test_dataset_scenario_3_no_monetary_no_date():
    # Scenario 3: Sellers/locations dataset without monetary or date fields
    df = pd.DataFrame({
        "seller_id": [f"sel_{i}" for i in range(10)],
        "seller_city": ["Sao Paulo"] * 6 + ["Curitiba"] * 4,
        "seller_state": ["SP"] * 6 + ["PR"] * 4
    })
    res = generate_analytics(df)
    assert res['summary']['total_revenue'] is None
    assert len(res['sales_by_location']) >= 1
    assert res['sales_by_location'][0]['location'] in ['Sao Paulo', 'SP']
    assert res['sales_by_location'][0]['value'] == 6
    assert len(res['available_charts']) >= 1


