import time
import requests
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from app.services.cache_service import get_cached_service_result
from app.services.risk_service import detect_risks
from app.services.cache_service import get_cached_df

file_path = "C:/Project_Data_Sets_Processed/olist_orders_dataset.csv"
file_type = "csv"

print(f"--- Testing {file_path} ---")
if not os.path.exists(file_path):
    print("File not found")
    sys.exit(0)

start = time.time()
analytics = get_cached_service_result(file_path, file_type, "analytics")
print(f"Analytics took: {time.time() - start:.2f}s")

start = time.time()
trends = get_cached_service_result(file_path, file_type, "trends")
print(f"Trends took: {time.time() - start:.2f}s")

start = time.time()
outliers = get_cached_service_result(file_path, file_type, "outliers")
print(f"Outliers took: {time.time() - start:.2f}s")

start = time.time()
forecast = get_cached_service_result(file_path, file_type, "forecast")
print(f"Forecast took: {time.time() - start:.2f}s")

start = time.time()
df = get_cached_df(file_path, file_type)
risks = detect_risks(df, file_path, file_type)
print(f"Risks took: {time.time() - start:.2f}s")
