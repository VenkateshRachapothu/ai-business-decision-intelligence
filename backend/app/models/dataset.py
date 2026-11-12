from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime
from ..core.database import Base

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    original_filename = Column(String)
    dataset_type = Column(String)  # 'csv', 'xlsx', etc.
    file_format = Column(String)
    upload_timestamp = Column(DateTime, default=datetime.utcnow)
    row_count = Column(Integer, nullable=True)
    column_count = Column(Integer, nullable=True)
    processing_status = Column(String, default="uploaded") # uploaded, cleaned
    processed_file_location = Column(String, nullable=True)
    original_file_location = Column(String)
