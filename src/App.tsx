import type { JSX } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { AppLayout } from './layout'
import AddUserPage from './pages/AddUserPage'
import CategoryMasterPage from './pages/CategoryMasterPage'
import CustomerDetailPage from './pages/CustomerDetailPage'
import CustomersPage from './pages/CustomersPage'
import DashboardPage from './pages/DashboardPage'
import InvoicingPage from './pages/InvoicingPage'
import LoginPage from './pages/LoginPage'
import OrdersPage from './pages/OrdersPage'
import PaymentReceiptPage from './pages/PaymentReceiptPage'
import PreciousMetalRatesPage from './pages/PreciousMetalRatesPage'
import ProductDetailPage from './pages/ProductDetailPage'
import ProductFormPage from './pages/ProductFormPage'
import RateHistoryPage from './pages/RateHistoryPage'
import SalesJourneyPage from './pages/SalesJourneyPage'
import StockPage from './pages/StockPage'

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function App() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/users/add" element={<AddUserPage />} />

      {/* Standalone print view — deliberately outside AppLayout so no sidebar/header chrome prints. */}
      <Route
        path="/payments/:id/receipt"
        element={
          <RequireAuth>
            <PaymentReceiptPage />
          </RequireAuth>
        }
      />

      {/* Everything authenticated renders inside the app shell. */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/products/new" element={<ProductFormPage />} />
        <Route path="/products/:id/edit" element={<ProductFormPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/sales/new" element={<SalesJourneyPage />} />
        <Route path="/invoices" element={<InvoicingPage />} />
        <Route path="/categories" element={<CategoryMasterPage />} />
        <Route path="/metal-rates" element={<PreciousMetalRatesPage />} />
        <Route path="/metal-rates/history" element={<RateHistoryPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
