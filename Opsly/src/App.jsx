import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { MarketingProvider } from './contexts/MarketingContext'
import ProtectedRoute from './components/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import MarketingDashboard from './pages/MarketingDashboard'
import MarketingPostAnalytics from './pages/MarketingPostAnalytics'
import CustomerSupportDashboard from './pages/CustomerSupportDashboard'
import TicketDetail from './pages/TicketDetail'
import FinanceDashboard from './pages/FinanceDashboard'
import FinanceForecast from './pages/FinanceForecast'
import FinanceAnomaly from './pages/FinanceAnomaly'
import RAGChatbot from './pages/RAGChatbot'
import CustomerChatbot from './pages/CustomerChatbot'
import SupportUs from './pages/SupportUs'

function App() {
  return (
    <Router>
      <AuthProvider>
        <MarketingProvider>
          <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route 
            path="/marketing" 
            element={
              <ProtectedRoute>
                <MarketingDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/marketing/post-analytics" 
            element={
              <ProtectedRoute>
                <MarketingPostAnalytics />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/customer-support" 
            element={
              <ProtectedRoute>
                <CustomerSupportDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/customer-support/ticket/:id" 
            element={
              <ProtectedRoute>
                <TicketDetail />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/finance" 
            element={
              <ProtectedRoute>
                <FinanceDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/finance/forecast" 
            element={
              <ProtectedRoute>
                <FinanceForecast />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/finance/anomaly" 
            element={
              <ProtectedRoute>
                <FinanceAnomaly />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/chatbot" 
            element={
              <ProtectedRoute>
                <RAGChatbot />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/chat" 
            element={<CustomerChatbot />} 
          />
          <Route 
            path="/support-us" 
            element={
              <ProtectedRoute>
                <SupportUs />
              </ProtectedRoute>
            } 
          />
          </Routes>
        </MarketingProvider>
      </AuthProvider>
    </Router>
  )
}

export default App

