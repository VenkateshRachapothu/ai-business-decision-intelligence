import time
import requests

# Test online_retail_II dataset which is dataset_id=1
# Wait, I don't know the token for the API.
# I can just call the python functions directly!

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from app.services.cache_service import get_cached_service_result

file_path = "C:/Project_Data_Sets_Processed/online_retail_II.xlsx"
file_type = "xlsx"

print("--- Testing Phase 2 Performance ---")

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

# Let's test the risk service directly
from app.services.risk_service import detect_risks
from app.services.cache_service import get_cached_df

start = time.time()
df = get_cached_df(file_path, file_type)
risks = detect_risks(df, file_path, file_type)
print(f"Risks took: {time.time() - start:.2f}s")

# Let's see how long the second call takes!
print("\n--- Testing Cached Performance ---")

start = time.time()
analytics2 = get_cached_service_result(file_path, file_type, "analytics")
print(f"Analytics (cached) took: {time.time() - start:.4f}s")

start = time.time()
risks2 = detect_risks(df, file_path, file_type)
print(f"Risks (cached) took: {time.time() - start:.4f}s")
