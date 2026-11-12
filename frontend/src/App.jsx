import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Welcome from './pages/Welcome';
import DashboardLayout from './pages/DashboardLayout';
import DatasetUpload from './pages/DatasetUpload';
import DataUnderstanding from './pages/DataUnderstanding';
import Analytics from './pages/Analytics';
import TrendAnalysis from './pages/TrendAnalysis';
import Forecasting from './pages/Forecasting';
import RiskDetection from './pages/RiskDetection';
import Decision from './pages/Decision';
import Verification from './pages/Verification';
import Chatbot from './pages/Chatbot';
import VisionAnalysis from './pages/VisionAnalysis';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/app" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/app/upload" replace />} />
        <Route path="upload" element={<DatasetUpload />} />
        <Route path="understanding" element={<DataUnderstanding />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="trends" element={<TrendAnalysis />} />
        <Route path="forecasting" element={<Forecasting />} />
        <Route path="risks" element={<RiskDetection />} />
        <Route path="decision" element={<Decision />} />
        <Route path="verification" element={<Verification />} />
        <Route path="chatbot" element={<Chatbot />} />
        <Route path="vision" element={<VisionAnalysis />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
};

export default App;
