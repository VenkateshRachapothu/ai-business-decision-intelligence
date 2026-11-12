import pandas as pd
import json
import os
import sys

# Add backend to path so imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from app.services.forecasting_service import generate_forecast
from app.services.risk_service import detect_risks

df = pd.read_excel("C:/Project_Data_Sets_Processed/online_retail_II.xlsx")

print("Running forecast...")
try:
    f_res = generate_forecast(df)
    print("Forecast output:")
    print(json.dumps(f_res, indent=2))
except Exception as e:
    print(f"Forecast Error: {e}")
    
print("\nRunning risks...")
try:
    r_res = detect_risks(df)
    print("Risks output:")
    print(json.dumps(r_res, indent=2))
except Exception as e:
    print(f"Risks Error: {e}")
