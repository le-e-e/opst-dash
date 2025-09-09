import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useKeystoneAuthStore } from './store/keystoneAuth';
import LoginPage from './components/LoginPage';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ComputePage from './pages/ComputePage';
import InstanceDetailPage from './pages/InstanceDetailPage';
import CreateInstancePage from './pages/CreateInstancePage';
import NetworkPage from './pages/NetworkPage';
import VolumePage from './pages/VolumePage';
import ImagesPage from './pages/ImagesPage';
import AdminManagementPage from './pages/AdminManagementPage';

// 인증 가드 컴포넌트
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useKeystoneAuthStore();
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// 관리자 전용 가드 컴포넌트
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin, isAuthenticated } = useKeystoneAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

const App: React.FC = () => {
  const { checkAuth } = useKeystoneAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Router>
      <div className="App">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            className: 'dark:bg-gray-800 dark:text-gray-100',
            style: {
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            },
            success: {
              className: 'dark:bg-green-800 dark:text-green-100',
              style: {
                background: '#10B981',
                color: '#fff',
              },
            },
            error: {
              className: 'dark:bg-red-800 dark:text-red-100',
              style: {
                background: '#EF4444',
                color: '#fff',
              },
            },
            loading: {
              className: 'dark:bg-blue-800 dark:text-blue-100',
              style: {
                background: '#3B82F6',
                color: '#fff',
              },
            },
          }}
        />
        
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="compute" element={<ComputePage />} />
            <Route path="compute/create" element={<CreateInstancePage />} />
            <Route path="compute/:instanceId" element={<InstanceDetailPage />} />
            <Route path="network" element={<NetworkPage />} />
            <Route path="volume" element={<VolumePage />} />
            <Route path="images" element={<ImagesPage />} />
            <Route 
              path="admin" 
              element={
                <AdminRoute>
                  <AdminManagementPage />
                </AdminRoute>
              } 
            />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App; 