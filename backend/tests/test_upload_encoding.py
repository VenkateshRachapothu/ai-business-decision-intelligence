import pandas as pd
import io
from app.routes.datasets import read_csv_with_fallback

def test_read_csv_with_fallback_windows1252():
    # Construct CSV content with non-breaking space (0xA0) encoded in windows-1252
    csv_bytes = b"Order ID,Product,Sales\r\n101,Office Chair\xa0Standard,250.50\r\n"
    stream = io.BytesIO(csv_bytes)
    
    df = read_csv_with_fallback(stream)
    assert len(df) == 1
    assert "Office Chair" in df["Product"].iloc[0]
    assert df["Sales"].iloc[0] == 250.50

def test_read_csv_with_fallback_utf8():
    csv_bytes = "Order ID,Product,Sales\n201,Laptop Stand,45.00\n".encode("utf-8")
    stream = io.BytesIO(csv_bytes)
    
    df = read_csv_with_fallback(stream)
    assert len(df) == 1
    assert df["Product"].iloc[0] == "Laptop Stand"
