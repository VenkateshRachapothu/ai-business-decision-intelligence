import React, { useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileTypeLabel = (file) => {
  if (!file?.name) return 'Unknown';
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return 'CSV Document (.csv)';
  if (name.endsWith('.xlsx')) return 'Excel Spreadsheet (.xlsx)';
  if (name.endsWith('.xls')) return 'Excel Spreadsheet (.xls)';
  return file.type || 'Data File';
};

const DatasetUpload = () => {
  const { datasets = [], fetchDatasets, selectedDataset, setSelectedDatasetId, goNext } = useOutletContext();
  const [file, setFile] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Dataset deletion state
  const [datasetToDelete, setDatasetToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState({ message: '', type: '' });

  const validateAndSetFile = (selectedFile) => {
    setUploadError('');
    setUploadSuccess('');
    setDeleteNotice({ message: '', type: '' });
    if (!selectedFile) return;

    const ext = '.' + selectedFile.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setUploadError(`Unsupported format "${ext}". Please upload a CSV or Excel (.xlsx) file.`);
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setUploadError(`File exceeds maximum size of 50 MB (${formatFileSize(selectedFile.size)}).`);
      return;
    }

    setFile(selectedFile);
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setIsUploading(true);
    setUploadError('');
    setUploadSuccess('');
    setDeleteNotice({ message: '', type: '' });

    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/datasets/upload', formData);
      await fetchDatasets();
      if (res?.data?.id) {
        setSelectedDatasetId(res.data.id);
      }
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setUploadSuccess('Dataset uploaded successfully! It is now selected for analysis.');
    } catch (err) {
      setUploadError(err.response?.data?.detail || 'Upload failed. Please check the file and try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!datasetToDelete) return;
    setIsDeleting(true);
    setDeleteNotice({ message: '', type: '' });
    try {
      await api.delete(`/datasets/${datasetToDelete.id}`);
      setDeleteNotice({
        message: `Dataset "${datasetToDelete.name}" was permanently deleted.`,
        type: 'success'
      });

      // Update selectedDataset state if deleted dataset was currently selected
      if (selectedDataset?.id === datasetToDelete.id) {
        const remaining = datasets.filter((d) => d.id !== datasetToDelete.id);
        if (remaining.length > 0) {
          setSelectedDatasetId(remaining[0].id);
        } else {
          setSelectedDatasetId(null);
        }
      }

      await fetchDatasets();
      setDatasetToDelete(null);
    } catch (err) {
      setDeleteNotice({
        message: err.response?.data?.detail || 'Failed to delete dataset. Please try again.',
        type: 'error'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Simplified Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Upload Dataset</h1>
        <p className="mt-1.5 text-sm sm:text-base text-slate-600">
          Upload a CSV or Excel file. Once uploaded, proceed to understand and analyze your data.
        </p>
      </div>

      {/* Global Deletion Feedback Notice */}
      {deleteNotice.message && (
        <div
          className={`p-4 rounded-xl flex items-start space-x-3 text-sm border ${
            deleteNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {deleteNotice.type === 'success' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            )}
          </svg>
          <div className="flex-1 font-medium">{deleteNotice.message}</div>
          <button
            onClick={() => setDeleteNotice({ message: '', type: '' })}
            className="text-slate-400 hover:text-slate-600 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* 2. Main Two-Column Grid: Upload Card & Available Datasets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
        {/* Upload Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-6 sm:p-7 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center flex-shrink-0 shadow-xs">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 leading-tight">Upload Data File</h2>
                <p className="text-xs text-slate-500 mt-0.5">Select or drag & drop a file to upload</p>
              </div>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100/80">
              CSV / XLSX
            </span>
          </div>

          <form onSubmit={handleUpload} className="space-y-4">
            <input 
              ref={fileInputRef}
              type="file" 
              id="file-upload"
              onChange={handleFileInputChange} 
              accept=".csv,.xlsx,.xls" 
              className="sr-only"
            />

            {/* Drop Zone or Selected File View */}
            {!file ? (
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all duration-200 flex flex-col items-center justify-center ${
                  isDragging 
                    ? 'border-purple-500 bg-purple-50/50 scale-[0.99] ring-4 ring-purple-100' 
                    : 'border-slate-200 hover:border-purple-300 bg-slate-50/40 hover:bg-purple-50/20'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100/80 flex items-center justify-center mb-4 shadow-xs">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                
                <p className="text-base font-semibold text-slate-800">
                  Drag & drop your file here
                </p>
                <p className="text-xs text-slate-400 my-2 font-medium">or</p>
                
                <label 
                  htmlFor="file-upload" 
                  className="cursor-pointer inline-flex items-center px-5 py-2.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-sm font-semibold rounded-xl shadow-sm shadow-purple-200 hover:shadow-md transition-all duration-150 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-purple-500"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Browse File
                </label>

                <div className="mt-6 pt-4 border-t border-slate-200/70 w-full flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-1.5"></span>
                    Supported: <strong className="ml-1 text-slate-700 font-medium">CSV, XLSX</strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>Max file size: <strong className="text-slate-700 font-medium">50 MB</strong></span>
                </div>
              </div>
            ) : (
              <div className="border border-purple-200/90 bg-purple-50/30 rounded-2xl p-5 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3.5 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center flex-shrink-0 shadow-xs">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md">
                          File Ready
                        </span>
                      </div>
                      <p className="text-sm sm:text-base font-bold text-slate-900 truncate mt-1" title={file.name}>
                        {file.name}
                      </p>
                      <div className="flex flex-wrap items-center text-xs text-slate-500 mt-1 gap-x-3 gap-y-1">
                        <span>Format: <strong className="text-slate-700">{getFileTypeLabel(file)}</strong></span>
                        <span className="text-slate-300">•</span>
                        <span>Size: <strong className="text-slate-700">{formatFileSize(file.size)}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                    <label 
                      htmlFor="file-upload" 
                      className="cursor-pointer text-xs font-semibold text-purple-700 hover:text-purple-800 hover:bg-purple-100/80 px-2.5 py-1.5 rounded-lg border border-purple-200 transition-colors"
                    >
                      Change
                    </label>
                    <button 
                      type="button" 
                      onClick={handleRemoveFile}
                      className="text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-transparent transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Upload Button */}
            <button 
              type="submit" 
              disabled={isUploading || !file} 
              className={`w-full flex items-center justify-center py-3 px-5 rounded-xl text-sm font-semibold transition-all ${
                isUploading || !file 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-sm shadow-purple-200 hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500'
              }`}
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2.5 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Uploading Dataset...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Upload Dataset</span>
                </>
              )}
            </button>

            {/* Status alerts */}
            {uploadError && (
              <div className="p-3.5 bg-red-50 border border-red-200/90 rounded-xl flex items-start space-x-2.5 text-xs sm:text-sm text-red-700">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200/90 rounded-xl flex items-start space-x-2.5 text-xs sm:text-sm text-emerald-800">
                <svg className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>{uploadSuccess}</span>
              </div>
            )}
          </form>
        </div>

        {/* Available Datasets Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-6 sm:p-7 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center flex-shrink-0 shadow-xs">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 leading-tight">Available Datasets</h2>
                <p className="text-xs text-slate-500 mt-0.5">Select a dataset to use for business intelligence</p>
              </div>
            </div>
            {datasets.length > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/70">
                {datasets.length} {datasets.length === 1 ? 'Dataset' : 'Datasets'}
              </span>
            )}
          </div>

          <div className="flex-1 min-h-[300px]">
            {datasets.length === 0 ? (
              /* Clean Empty State */
              <div className="text-center py-12 px-4 flex flex-col items-center justify-center h-full">
                <div className="w-14 h-14 rounded-2xl bg-purple-50/80 text-purple-400 border border-purple-100 flex items-center justify-center mb-3.5">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  No datasets uploaded yet
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xs text-center leading-relaxed">
                  Upload a CSV or Excel file using the upload form to begin your analysis.
                </p>
              </div>
            ) : (
              /* Uploaded Datasets List */
              <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
                {datasets.map((ds) => {
                  const isSelected = selectedDataset?.id === ds.id;
                  return (
                    <div 
                      key={ds.id} 
                      onClick={() => setSelectedDatasetId(ds.id)}
                      className={`relative rounded-xl border p-4 cursor-pointer transition-all duration-200 ${
                        isSelected 
                          ? 'border-purple-500 bg-purple-50/50 shadow-xs ring-2 ring-purple-400/20' 
                          : 'border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-3.5 min-w-0 flex-1">
                          {/* Selection indicator */}
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 flex-shrink-0 transition-colors ${
                            isSelected ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300 bg-white hover:border-purple-400'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm sm:text-base font-semibold text-slate-900 truncate" title={ds.name}>
                                {ds.name}
                              </p>
                              {isSelected && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 border border-purple-200/80 px-2 py-0.5 rounded">
                                  Selected
                                </span>
                              )}
                            </div>
                            
                            <div className="mt-1.5 flex flex-wrap items-center text-xs sm:text-sm text-slate-500 gap-x-3 gap-y-1">
                              <span className="flex items-center">
                                <span className="font-semibold text-slate-700 mr-1">
                                  {ds.row_count != null ? ds.row_count.toLocaleString() : '—'}
                                </span>
                                rows
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="flex items-center">
                                <span className="font-semibold text-slate-700 mr-1">
                                  {ds.column_count != null ? ds.column_count : '—'}
                                </span>
                                cols
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="uppercase tracking-wider font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-[11px] border border-purple-100">
                                {ds.file_format || ds.dataset_type || 'CSV'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status badge, Use action, & Delete action */}
                        <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                            ds.processing_status === 'COMPLETED' || ds.processing_status === 'cleaned' || ds.processing_status === 'uploaded'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : ds.processing_status === 'FAILED' 
                              ? 'bg-red-50 text-red-700 border-red-200' 
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {ds.processing_status || 'Ready'}
                          </span>

                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDatasetId(ds.id);
                              }}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                                isSelected
                                  ? 'text-purple-700 bg-purple-100/70'
                                  : 'text-slate-600 hover:text-purple-700 hover:bg-purple-50 border border-slate-200'
                              }`}
                            >
                              {isSelected ? 'Active' : 'Use'}
                            </button>

                            <button
                              type="button"
                              title="Delete dataset"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDatasetToDelete(ds);
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Compact Tip Section */}
      <div className="p-4 sm:p-5 rounded-2xl bg-purple-50/60 border border-purple-100/80 flex items-start space-x-3.5 shadow-xs">
        <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="text-xs sm:text-sm text-slate-600 leading-relaxed min-w-0">
          <strong className="font-bold text-slate-800 mr-1.5">Business Data Tip:</strong>
          For optimal decision intelligence results, ensure your dataset includes standard business records such as transaction dates, product identifiers, revenue, order quantities, customer segments, or store regions.
        </div>
      </div>

      {/* 4. Bottom Continue Action Section */}
      <div className="pt-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs sm:text-sm text-slate-600 text-center sm:text-left flex items-center space-x-2">
          {selectedDataset ? (
            <span className="flex items-center text-slate-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 flex-shrink-0"></span>
              Selected dataset:
              <strong className="text-slate-900 ml-1.5 font-bold truncate max-w-xs">{selectedDataset.name}</strong>
              {selectedDataset.row_count != null && (
                <span className="text-slate-500 text-xs ml-1.5">({selectedDataset.row_count.toLocaleString()} rows)</span>
              )}
            </span>
          ) : (
            <span className="text-slate-500">
              Select or upload a dataset above to proceed to data understanding.
            </span>
          )}
        </div>

        <button 
          type="button"
          onClick={goNext} 
          disabled={!selectedDataset}
          className={`w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold rounded-xl shadow-sm transition-all duration-150 ${
            selectedDataset 
              ? 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-purple-200 hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500' 
              : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-80'
          }`}
        >
          <span>Continue to Data Understanding</span>
          <svg className="ml-2 -mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 5. Safe Dataset Deletion Confirmation Modal */}
      {datasetToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3.5 mb-4">
              <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">Delete Dataset</h3>
                <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Are you sure you want to delete <strong className="text-slate-900 font-semibold">{datasetToDelete.name}</strong>?
              This will remove the uploaded file, data profile, and any associated cleaning results from your workspace.
            </p>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDatasetToDelete(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-sm shadow-red-200 flex items-center transition-all cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Dataset</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatasetUpload;
