import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import MarketingDashboard from './pages/MarketingDashboard'
import MarketingPostAnalytics from './pages/MarketingPostAnalytics'
import CustomerSupportDashboard from './pages/CustomerSupportDashboard'
import TicketDetail from './pages/TicketDetail'
import FinanceDashboard from './pages/FinanceDashboard'
import FinanceForecast from './pages/FinanceForecast'
import FinanceAnomaly from './pages/FinanceAnomaly'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/marketing" element={<MarketingDashboard />} />
        <Route path="/marketing/post-analytics" element={<MarketingPostAnalytics />} />
        <Route path="/customer-support" element={<CustomerSupportDashboard />} />
        <Route path="/customer-support/ticket/:id" element={<TicketDetail />} />
        <Route path="/finance" element={<FinanceDashboard />} />
        <Route path="/finance/forecast" element={<FinanceForecast />} />
        <Route path="/finance/anomaly" element={<FinanceAnomaly />} />
      </Routes>
    </Router>
  )
}

export default App

