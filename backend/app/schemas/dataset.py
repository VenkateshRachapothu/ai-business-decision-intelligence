from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class DatasetBase(BaseModel):
    name: str

class DatasetCreate(DatasetBase):
    pass

class DatasetResponse(DatasetBase):
    id: int
    user_id: int
    original_filename: str
    dataset_type: str
    file_format: str
    upload_timestamp: datetime
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    processing_status: str
    processed_file_location: Optional[str] = None

    class Config:
        from_attributes = True

class CleaningSummaryResponse(BaseModel):
    original_row_count: int
    cleaned_row_count: int
    duplicates_removed: int
    missing_values_handled: int
    columns_transformed: List[str]
    status: str
