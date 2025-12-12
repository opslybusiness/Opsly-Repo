import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { Link } from 'react-router-dom'
import { HiArrowLeft, HiDownload, HiRefresh, HiDocument } from 'react-icons/hi'
import { getFinancialData, getCategories, getFinancialForecast } from '../services/financeService'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const COLORS = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#14B8A6']

function FinanceReports() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [forecastData, setForecastData] = useState(null)
  const reportRef = useRef(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError('')
      const [financeRes, categoriesRes] = await Promise.all([
        getFinancialData({ limit: 500 }),
        getCategories()
      ])
      setTransactions(financeRes.data || [])
      setCategories(categoriesRes.categories || [])
      
      // Also fetch forecast data for PDF report
      try {
        const forecastRes = await getFinancialForecast(90) // 3 months forecast
        setForecastData(forecastRes)
      } catch (forecastErr) {
        console.warn('Could not fetch forecast data:', forecastErr)
        // Continue without forecast data
      }
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // Calculate summary statistics
  const totalTransactions = transactions.length
  const totalExpense = transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
  const avgTransaction = totalTransactions > 0 ? totalExpense / totalTransactions : 0

  // Group by category for pie chart
  const categoryData = transactions.reduce((acc, t) => {
    const cat = t.category || 'Uncategorized'
    acc[cat] = (acc[cat] || 0) + parseFloat(t.amount || 0)
    return acc
  }, {})

  const pieChartData = Object.entries(categoryData)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8) // Top 8 categories

  // Group by month for trend chart
  const monthlyData = transactions.reduce((acc, t) => {
    if (!t.date) return acc
    const date = new Date(t.date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    acc[monthKey] = (acc[monthKey] || 0) + parseFloat(t.amount || 0)
    return acc
  }, {})

  const trendChartData = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12) // Last 12 months
    .map(([month, amount]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      amount: Math.round(amount * 100) / 100
    }))

  // Group by payment method
  const paymentMethodData = transactions.reduce((acc, t) => {
    const method = t.use_chip || 'Unknown'
    acc[method] = (acc[method] || 0) + 1
    return acc
  }, {})

  const paymentChartData = Object.entries(paymentMethodData)
    .map(([name, count]) => ({ name, count }))

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const handleExportReport = () => {
    // Create comprehensive CSV report with all chart data
    const sections = []

    // Section 1: Summary
    sections.push('=== FINANCIAL SUMMARY ===')
    sections.push('Metric,Value')
    sections.push(`Total Transactions,${totalTransactions}`)
    sections.push(`Total Expenses,$${totalExpense.toFixed(2)}`)
    sections.push(`Average Transaction,$${avgTransaction.toFixed(2)}`)
    sections.push(`Categories Used,${Object.keys(categoryData).length}`)
    sections.push('')

    // Section 2: Monthly Trend
    sections.push('=== MONTHLY EXPENSE TREND ===')
    sections.push('Month,Amount')
    trendChartData.forEach(item => {
      sections.push(`${item.month},$${item.amount.toFixed(2)}`)
    })
    sections.push('')

    // Section 3: Category Breakdown
    sections.push('=== EXPENSE BY CATEGORY ===')
    sections.push('Category,Amount,Percentage')
    const totalForPercentage = pieChartData.reduce((sum, item) => sum + item.value, 0)
    pieChartData.forEach(item => {
      const percentage = totalForPercentage > 0 ? ((item.value / totalForPercentage) * 100).toFixed(1) : 0
      sections.push(`"${item.name}",$${item.value.toFixed(2)},${percentage}%`)
    })
    sections.push('')

    // Section 4: Payment Methods
    sections.push('=== PAYMENT METHODS ===')
    sections.push('Payment Method,Transaction Count')
    paymentChartData.forEach(item => {
      sections.push(`"${item.name}",${item.count}`)
    })
    sections.push('')

    // Section 5: All Transactions
    sections.push('=== ALL TRANSACTIONS ===')
    sections.push('Date,Amount,Category,Payment Method')
    transactions.forEach(t => {
      sections.push(`${t.date || '-'},$${parseFloat(t.amount || 0).toFixed(2)},"${t.category || '-'}","${t.use_chip || '-'}"`)
    })

    const csvContent = sections.join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financial_report_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleGeneratePDF = async () => {
    if (!reportRef.current) return
    
    try {
      setGeneratingPDF(true)
      
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      let yPosition = 15
      
      // Color scheme
      const colors = {
        primary: [139, 92, 246],      // Purple
        secondary: [236, 72, 153],    // Pink
        accent: [59, 130, 246],       // Blue
        success: [16, 185, 129],      // Green
        warning: [245, 158, 11],      // Orange
        danger: [239, 68, 68],        // Red
        dark: [31, 41, 55],           // Dark gray
        light: [243, 244, 246],       // Light gray
        text: [55, 65, 81]            // Text gray
      }
      
      // Helper to capture chart as image
      const captureChart = async (chartSelector) => {
        try {
          const chartElement = document.querySelector(chartSelector)
          if (!chartElement) return null
          
          const canvas = await html2canvas(chartElement, {
            backgroundColor: '#1F2937',
            scale: 2,
            logging: false
          })
          return canvas.toDataURL('image/png')
        } catch (err) {
          console.warn('Could not capture chart:', err)
          return null
        }
      }

      // Helper function to add a new page if needed
      const checkNewPage = (requiredHeight) => {
        if (yPosition + requiredHeight > pageHeight - 20) {
          pdf.addPage()
          yPosition = 15
          return true
        }
        return false
      }
      
      // Helper to draw a colored box/header
      const drawHeaderBox = (title, y, color = colors.primary) => {
        pdf.setFillColor(...color)
        pdf.roundedRect(10, y - 5, pageWidth - 20, 8, 2, 2, 'F')
        pdf.setTextColor(255, 255, 255)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(14)
        pdf.text(title, 15, y + 1)
        pdf.setTextColor(...colors.text)
        pdf.setFont('helvetica', 'normal')
        return y + 8 // Return position after header with more spacing
      }
      
      // Helper to draw a card/box
      const drawCard = (x, y, width, height, title, content) => {
        // Card background
        pdf.setFillColor(250, 250, 250)
        pdf.roundedRect(x, y, width, height, 2, 2, 'F')
        
        // Border
        pdf.setDrawColor(220, 220, 220)
        pdf.setLineWidth(0.5)
        pdf.roundedRect(x, y, width, height, 2, 2)
        
        // Title
        if (title) {
          pdf.setFillColor(...colors.primary)
          pdf.roundedRect(x, y, width, 6, 2, 2, 'F')
          pdf.setTextColor(255, 255, 255)
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(10)
          pdf.text(title, x + 2, y + 4)
          pdf.setTextColor(...colors.text)
          pdf.setFont('helvetica', 'normal')
        }
        
        return y + (title ? 6 : 0)
      }

      // Cover Page Header with gradient effect
      pdf.setFillColor(...colors.primary)
      pdf.rect(0, 0, pageWidth, 50)
      
      // Title
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(32)
      pdf.text('Financial Report', pageWidth / 2, 25, { align: 'center' })
      
      // Subtitle
      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'normal')
      pdf.text('Comprehensive Expense Analytics & Insights', pageWidth / 2, 35, { align: 'center' })
      
      // Date badge
      pdf.setFillColor(255, 255, 255)
      pdf.setTextColor(...colors.primary)
      pdf.roundedRect(pageWidth / 2 - 40, 40, 80, 6, 1, 1, 'F')
      pdf.setFontSize(9)
      pdf.text(
        new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric'
        }),
        pageWidth / 2,
        43.5,
        { align: 'center' }
      )
      
      yPosition = 60
      
      // Decorative line
      pdf.setDrawColor(...colors.primary)
      pdf.setLineWidth(0.5)
      pdf.line(10, yPosition, pageWidth - 10, yPosition)
      yPosition += 10

      // Summary Section with Cards
      yPosition += 5 // Extra space before first header
      yPosition = drawHeaderBox('Summary Statistics', yPosition, colors.primary)
      yPosition += 3
      
      // Create summary cards in a grid
      const cardWidth = (pageWidth - 30) / 2
      const cardHeight = 20
      const summaryCards = [
        { label: 'Total Transactions', value: totalTransactions.toString(), color: colors.accent },
        { label: 'Total Expenses', value: formatCurrency(totalExpense), color: colors.danger },
        { label: 'Avg Transaction', value: formatCurrency(avgTransaction), color: colors.success },
        { label: 'Categories', value: Object.keys(categoryData).length.toString(), color: colors.warning }
      ]
      
      let cardX = 10
      let cardY = yPosition
      summaryCards.forEach((card, index) => {
        if (index > 0 && index % 2 === 0) {
          cardY += cardHeight + 5
          cardX = 10
        }
        
        const contentY = drawCard(cardX, cardY, cardWidth, cardHeight, null, null)
        
        // Label
        pdf.setFontSize(10)
        pdf.setTextColor(...colors.text)
        pdf.setFont('helvetica', 'normal')
        pdf.text(card.label, cardX + 5, contentY + 4)
        
        // Value
        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(...card.color)
        pdf.text(card.value, cardX + cardWidth / 2, contentY + 10, { align: 'center' })
        
        cardX += cardWidth + 10
      })
      
      yPosition = cardY + cardHeight + 20

      // Monthly Trend Data Table with styling
      checkNewPage(50)
      yPosition += 5 // Extra space before header
      yPosition = drawHeaderBox('Monthly Expense Trend', yPosition, colors.accent)
      yPosition += 3
      
      // Table header with background
      pdf.setFillColor(...colors.accent)
      pdf.roundedRect(10, yPosition, pageWidth - 20, 7, 1, 1, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text('Month', 15, yPosition + 4.5)
      pdf.text('Amount', pageWidth - 60, yPosition + 4.5, { align: 'right' })
      yPosition += 7

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(...colors.text)
      
      trendChartData.forEach((item, index) => {
        checkNewPage(8)
        
        // Alternate row colors
        if (index % 2 === 0) {
          pdf.setFillColor(250, 250, 250)
          pdf.rect(10, yPosition - 4, pageWidth - 20, 7, 'F')
        }
        
        // Month column (left aligned)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(...colors.text)
        pdf.text(item.month, 15, yPosition + 2)
        
        // Amount column (right aligned)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(...colors.danger)
        pdf.text(formatCurrency(item.amount), pageWidth - 15, yPosition + 2, { align: 'right' })
        
        pdf.setTextColor(...colors.text)
        pdf.setFont('helvetica', 'normal')
        yPosition += 7
      })
      
      // Bottom border
      pdf.setDrawColor(220, 220, 220)
      pdf.line(10, yPosition, pageWidth - 10, yPosition)
      yPosition += 8

      // Category Breakdown with visual bars
      checkNewPage(60)
      yPosition = drawHeaderBox('Expense by Category', yPosition, colors.secondary)
      yPosition += 3
      
      // Table header
      pdf.setFillColor(...colors.secondary)
      pdf.roundedRect(10, yPosition, pageWidth - 20, 7, 1, 1, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text('Category', 15, yPosition + 4.5)
      pdf.text('Amount', pageWidth - 80, yPosition + 4.5, { align: 'right' })
      pdf.text('%', pageWidth - 15, yPosition + 4.5, { align: 'right' })
      yPosition += 7

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      const totalForPct = pieChartData.reduce((sum, item) => sum + item.value, 0)
      const maxAmount = Math.max(...pieChartData.map(item => item.value))
      
      pieChartData.forEach((item, index) => {
        checkNewPage(10)
        
        // Alternate row colors
        if (index % 2 === 0) {
          pdf.setFillColor(250, 250, 250)
          pdf.rect(10, yPosition - 4, pageWidth - 20, 8, 'F')
        }
        
        const percentage = totalForPct > 0 ? ((item.value / totalForPct) * 100).toFixed(1) : 0
        
        // Category name (left column)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.setTextColor(...colors.text)
        const categoryName = item.name.length > 22 ? item.name.substring(0, 22) + '...' : item.name
        pdf.text(categoryName, 15, yPosition + 2)
        
        // Visual progress bar (between category and amount)
        const barWidth = ((item.value / maxAmount) * 50) // Fixed width calculation
        const barX = 90
        const barColors = [
          colors.primary,
          colors.secondary,
          colors.accent,
          colors.success,
          colors.warning,
          colors.danger
        ]
        pdf.setFillColor(...(barColors[index % barColors.length]))
        pdf.roundedRect(barX, yPosition, barWidth, 4, 1, 1, 'F')
        
        // Amount (middle-right column)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(9)
        pdf.setTextColor(...colors.danger)
        pdf.text(formatCurrency(item.value), pageWidth - 50, yPosition + 2, { align: 'right' })
        
        // Percentage badge (right column)
        pdf.setFillColor(...colors.primary)
        pdf.roundedRect(pageWidth - 35, yPosition, 25, 4, 1, 1, 'F')
        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(8)
        pdf.text(`${percentage}%`, pageWidth - 22.5, yPosition + 2, { align: 'center' })
        
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.setTextColor(...colors.text)
        yPosition += 8
      })
      
      pdf.setDrawColor(220, 220, 220)
      pdf.line(10, yPosition, pageWidth - 10, yPosition)
      yPosition += 8

      // Payment Methods with visual indicators
      checkNewPage(40)
      yPosition = drawHeaderBox('Payment Methods', yPosition, colors.success)
      yPosition += 3
      
      // Table header
      pdf.setFillColor(...colors.success)
      pdf.roundedRect(10, yPosition, pageWidth - 20, 7, 1, 1, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text('Payment Method', 15, yPosition + 4.5)
      pdf.text('Transactions', pageWidth - 15, yPosition + 4.5, { align: 'right' })
      yPosition += 7

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      const maxCount = Math.max(...paymentChartData.map(item => item.count))
      
      paymentChartData.forEach((item, index) => {
        checkNewPage(8)
        
        // Alternate row colors
        if (index % 2 === 0) {
          pdf.setFillColor(250, 250, 250)
          pdf.rect(10, yPosition - 4, pageWidth - 20, 7, 'F')
        }
        
        // Method name (left column)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.setTextColor(...colors.text)
        pdf.text(item.name, 15, yPosition + 2)
        
        // Visual bar (middle)
        const barWidth = ((item.count / maxCount) * 80) // Fixed width
        const barX = 90
        pdf.setFillColor(...colors.success)
        pdf.roundedRect(barX, yPosition, barWidth, 4, 1, 1, 'F')
        
        // Count badge (right column)
        pdf.setFillColor(...colors.success)
        pdf.roundedRect(pageWidth - 30, yPosition, 20, 4, 1, 1, 'F')
        pdf.setTextColor(255, 255, 255)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(9)
        pdf.text(item.count.toString(), pageWidth - 20, yPosition + 2, { align: 'center' })
        
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(...colors.text)
        yPosition += 7
      })
      
      pdf.setDrawColor(220, 220, 220)
      pdf.line(10, yPosition, pageWidth - 10, yPosition)
      yPosition += 8

      // Forecast Section (if available) - Enhanced styling
      if (forecastData && forecastData.forecast && forecastData.forecast.length > 0) {
        checkNewPage(60)
        yPosition = drawHeaderBox('Expense Forecast', yPosition, colors.warning)
        yPosition += 3
        
        // Table header
        pdf.setFillColor(...colors.warning)
        pdf.roundedRect(10, yPosition, pageWidth - 20, 7, 1, 1, 'F')
        pdf.setTextColor(255, 255, 255)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10)
        pdf.text('Period', 15, yPosition + 4.5)
        pdf.text('Forecasted', pageWidth - 80, yPosition + 4.5, { align: 'right' })
        pdf.text('Range', pageWidth - 15, yPosition + 4.5, { align: 'right' })
        yPosition += 7

        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'normal')
        
        forecastData.forecast.slice(0, 6).forEach((item, index) => {
          checkNewPage(8)
          
          // Alternate row colors
          if (index % 2 === 0) {
            pdf.setFillColor(255, 247, 237) // Light orange background
            pdf.rect(10, yPosition - 4, pageWidth - 20, 7, 'F')
          }
          
          // Period (left column)
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(9)
          pdf.setTextColor(...colors.text)
          pdf.text(item.date, 15, yPosition + 2)
          
          // Forecasted amount (middle column, right aligned)
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(9)
          pdf.setTextColor(...colors.warning)
          pdf.text(formatCurrency(item.forecasted_amount), pageWidth - 100, yPosition + 2, { align: 'right' })
          
          // Range (right column, smaller, gray)
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(8)
          pdf.setTextColor(150, 150, 150)
          const rangeText = `${formatCurrency(item.lower_bound)}-${formatCurrency(item.upper_bound)}`
          pdf.text(rangeText, pageWidth - 15, yPosition + 2, { align: 'right' })
          
          pdf.setFontSize(9)
          pdf.setTextColor(...colors.text)
          yPosition += 7
        })
        
        pdf.setDrawColor(220, 220, 220)
        pdf.line(10, yPosition, pageWidth - 10, yPosition)
        yPosition += 8

        if (forecastData.summary) {
          checkNewPage(30)
          
          // Summary cards
          const forecastCards = [
            { label: 'Total Predicted', value: formatCurrency(forecastData.summary.total_predicted), color: colors.warning },
            { label: 'Avg Monthly', value: formatCurrency(forecastData.summary.average_monthly), color: colors.accent },
            { label: 'Historical Avg', value: formatCurrency(forecastData.summary.historical_average), color: colors.success }
          ]
          
          const forecastCardWidth = (pageWidth - 30) / 3
          let forecastCardX = 10
          forecastCards.forEach((card, index) => {
            const cardY = yPosition
            const contentY = drawCard(forecastCardX, cardY, forecastCardWidth - 3, 15, null, null)
            
            pdf.setFontSize(8)
            pdf.setTextColor(...colors.text)
            pdf.setFont('helvetica', 'normal')
            pdf.text(card.label, forecastCardX + forecastCardWidth / 2 - 15, contentY + 4, { align: 'center' })
            
            pdf.setFontSize(11)
            pdf.setFont('helvetica', 'bold')
            pdf.setTextColor(...card.color)
            pdf.text(card.value, forecastCardX + forecastCardWidth / 2 - 15, contentY + 9, { align: 'center' })
            
            forecastCardX += forecastCardWidth
          })
          
          yPosition += 20
        }
      }

      // Recent Transactions - Enhanced
      checkNewPage(50)
      yPosition = drawHeaderBox('Recent Transactions', yPosition, colors.dark)
      
      // Table header
      pdf.setFillColor(240, 240, 240) // Light gray background
      pdf.roundedRect(10, yPosition, pageWidth - 20, 7, 2, 2, 'F')
      
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(...colors.dark)
      pdf.text('Date', 15, yPosition + 4.5)
      pdf.text('Category', 60, yPosition + 4.5)
      pdf.text('Amount', pageWidth - 15, yPosition + 4.5, { align: 'right' })
      yPosition += 10

      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      transactions.slice(0, 15).forEach((t, index) => {
        checkNewPage(7)
        
        // Alternate row colors
        if (index % 2 === 0) {
          pdf.setFillColor(248, 250, 252)
          pdf.rect(10, yPosition - 4, pageWidth - 20, 6, 'F')
        }
        
        const date = t.date ? new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '-'
        const category = (t.category || 'Uncategorized').substring(0, 20)
        
        // Date column
        pdf.setTextColor(...colors.text)
        pdf.text(date, 15, yPosition + 2)
        
        // Category column
        pdf.text(category, 60, yPosition + 2)
        
        // Amount column (right aligned)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(...colors.danger)
        pdf.text(formatCurrency(t.amount || 0), pageWidth - 15, yPosition + 2, { align: 'right' })
        pdf.setFont('helvetica', 'normal')
        
        yPosition += 6
      })

      // Add chart images with beautiful styling
      try {
        await new Promise(resolve => setTimeout(resolve, 800))
        
        // Capture Monthly Trend Chart
        const trendChartImg = await captureChart('[data-chart="trend"]')
        if (trendChartImg) {
          checkNewPage(90)
          yPosition += 5 // Extra space before header
          yPosition = drawHeaderBox('Monthly Expense Trend Chart', yPosition, colors.accent)
          yPosition += 5
          const imgWidth = pageWidth - 20
          // Calculate proper aspect ratio (assuming chart is roughly 16:9)
          const imgHeight = (imgWidth * 0.4)
          
          // Shadow effect (light gray)
          pdf.setFillColor(220, 220, 220)
          pdf.roundedRect(12, yPosition + 2, imgWidth, imgHeight, 3, 3, 'F')
          
          // Border with gradient effect
          pdf.setDrawColor(...colors.accent)
          pdf.setLineWidth(1)
          pdf.roundedRect(10, yPosition, imgWidth, imgHeight, 3, 3, 'D')
          
          // Inner border
          pdf.setDrawColor(...colors.accent)
          pdf.setLineWidth(0.3)
          pdf.roundedRect(11, yPosition + 1, imgWidth - 2, imgHeight - 2, 2, 2, 'D')
          
          pdf.addImage(trendChartImg, 'PNG', 10, yPosition, imgWidth, imgHeight, undefined, 'FAST')
          yPosition += imgHeight + 15
        }
        
        // Capture Category Pie Chart
        const pieChartImg = await captureChart('[data-chart="category"]')
        if (pieChartImg) {
          checkNewPage(90)
            yPosition = drawHeaderBox('Expense by Category Chart', yPosition, colors.secondary)
          yPosition -= 5
          const imgWidth = pageWidth - 20
          const imgHeight = (imgWidth * 0.4)
          
          // Shadow
          pdf.setFillColor(220, 220, 220)
          pdf.roundedRect(12, yPosition + 2, imgWidth, imgHeight, 3, 3, 'F')
          
          pdf.setDrawColor(...colors.secondary)
          pdf.setLineWidth(1)
          pdf.roundedRect(10, yPosition, imgWidth, imgHeight, 3, 3, 'D')
          pdf.setLineWidth(0.3)
          pdf.roundedRect(11, yPosition + 1, imgWidth - 2, imgHeight - 2, 2, 2, 'D')
          
          pdf.addImage(pieChartImg, 'PNG', 10, yPosition, imgWidth, imgHeight, undefined, 'FAST')
          yPosition += imgHeight + 15
        }
        
        // Capture Category Bar Chart
        const barChartImg = await captureChart('[data-chart="bar"]')
        if (barChartImg) {
          checkNewPage(90)
          yPosition = drawHeaderBox('Top Categories Chart', yPosition, colors.primary)
          yPosition -= 5
          const imgWidth = pageWidth - 20
          const imgHeight = (imgWidth * 0.4)
          
          // Shadow
          pdf.setFillColor(220, 220, 220)
          pdf.roundedRect(12, yPosition + 2, imgWidth, imgHeight, 3, 3, 'F')
          
          pdf.setDrawColor(...colors.primary)
          pdf.setLineWidth(1)
          pdf.roundedRect(10, yPosition, imgWidth, imgHeight, 3, 3, 'D')
          pdf.setLineWidth(0.3)
          pdf.roundedRect(11, yPosition + 1, imgWidth - 2, imgHeight - 2, 2, 2, 'D')
          
          pdf.addImage(barChartImg, 'PNG', 10, yPosition, imgWidth, imgHeight, undefined, 'FAST')
          yPosition += imgHeight + 15
        }
      } catch (chartErr) {
        console.warn('Could not add charts to PDF:', chartErr)
      }
      
      // Enhanced Footer with branding and design
      const totalPages = pdf.internal.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i)
        
        // Footer background bar
        pdf.setFillColor(245, 245, 250) // Light purple tint
        pdf.rect(0, pageHeight - 18, pageWidth, 18, 'F')
        
        // Decorative line
        pdf.setDrawColor(...colors.primary)
        pdf.setLineWidth(0.5)
        pdf.line(10, pageHeight - 17, pageWidth - 10, pageHeight - 17)
        
        // Page number with badge
        pdf.setFillColor(...colors.primary)
        pdf.roundedRect(pageWidth / 2 - 15, pageHeight - 13, 30, 6, 1, 1, 'F')
        pdf.setFontSize(8)
        pdf.setTextColor(255, 255, 255)
        pdf.setFont('helvetica', 'bold')
        pdf.text(
          `Page ${i} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 9.5,
          { align: 'center' }
        )
        
        // Branding with logo area
        pdf.setFontSize(9)
        pdf.setTextColor(...colors.primary)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Opsly', pageWidth - 15, pageHeight - 9.5, { align: 'right' })
        
        pdf.setFontSize(6)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(150, 150, 150)
        pdf.text('Financial Analytics Platform', pageWidth - 15, pageHeight - 6, { align: 'right' })
        pdf.setFont('helvetica', 'normal')
      }

      // Save PDF
      pdf.save(`financial_report_${new Date().toISOString().split('T')[0]}.pdf`)
      
    } catch (err) {
      console.error('Error generating PDF:', err)
      setError('Failed to generate PDF report. Please try again.')
    } finally {
      setGeneratingPDF(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="min-w-0 max-w-full" ref={reportRef}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link to="/finance" className="text-gray-400 hover:text-white transition">
                <HiArrowLeft className="text-xl" />
              </Link>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">Financial Reports</h1>
            </div>
            <p className="text-sm sm:text-base text-gray-400">Comprehensive overview of your financial data</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2 bg-opsly-card text-white rounded-lg hover:bg-opacity-80 transition flex items-center gap-2 disabled:opacity-50"
            >
              <HiRefresh className={`text-lg ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleExportReport}
              disabled={loading || transactions.length === 0}
              className="px-4 py-2 bg-opsly-card text-white rounded-lg hover:bg-opacity-90 transition flex items-center gap-2 disabled:opacity-50"
            >
              <HiDownload className="text-lg" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={handleGeneratePDF}
              disabled={loading || transactions.length === 0 || generatingPDF}
              className="px-4 py-2 bg-opsly-purple text-white rounded-lg hover:bg-opacity-90 transition flex items-center gap-2 disabled:opacity-50"
            >
              <HiDocument className={`text-lg ${generatingPDF ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">{generatingPDF ? 'Generating...' : 'Generate PDF'}</span>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-opsly-card rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">Total Transactions</p>
            <p className="text-3xl font-bold text-white">{loading ? '...' : totalTransactions}</p>
          </div>
          <div className="bg-opsly-card rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">Total Expenses</p>
            <p className="text-3xl font-bold text-red-400">{loading ? '...' : formatCurrency(totalExpense)}</p>
          </div>
          <div className="bg-opsly-card rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">Average Transaction</p>
            <p className="text-3xl font-bold text-blue-400">{loading ? '...' : formatCurrency(avgTransaction)}</p>
          </div>
          <div className="bg-opsly-card rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">Categories Used</p>
            <p className="text-3xl font-bold text-purple-400">{loading ? '...' : Object.keys(categoryData).length}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-opsly-purple border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Loading report data...</p>
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-opsly-card rounded-xl p-12 text-center">
            <p className="text-gray-400 text-lg mb-4">No transaction data available</p>
            <Link to="/finance" className="text-opsly-purple hover:underline">
              Add transactions to generate reports
            </Link>
          </div>
        ) : (
          <>
            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Monthly Trend Chart */}
              <div className="bg-opsly-card rounded-xl p-5" data-chart="trend">
                <h3 className="text-lg font-semibold text-white mb-4">Monthly Expense Trend</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `$${v}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(value) => [formatCurrency(value), 'Amount']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="amount" 
                        stroke="#8B5CF6" 
                        strokeWidth={3}
                        dot={{ fill: '#8B5CF6', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#A78BFA' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Category Breakdown Pie Chart */}
              <div className="bg-opsly-card rounded-xl p-5" data-chart="category">
                <h3 className="text-lg font-semibold text-white mb-4">Expense by Category</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name.slice(0, 10)}${name.length > 10 ? '..' : ''} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                        formatter={(value) => [formatCurrency(value), 'Amount']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Second Row Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Category Bar Chart */}
              <div className="bg-opsly-card rounded-xl p-5" data-chart="bar">
                <h3 className="text-lg font-semibold text-white mb-4">Top Categories by Amount</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pieChartData.slice(0, 6)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `$${v}`} />
                      <YAxis type="category" dataKey="name" stroke="#9CA3AF" fontSize={11} width={80} tickFormatter={(v) => v.slice(0, 12)} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                        formatter={(value) => [formatCurrency(value), 'Amount']}
                      />
                      <Bar dataKey="value" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Payment Method Chart */}
              <div className="bg-opsly-card rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Payment Methods</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paymentChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} />
                      <YAxis stroke="#9CA3AF" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Recent Transactions Table */}
            <div className="bg-opsly-card rounded-xl p-5">
              <h3 className="text-lg font-semibold text-white mb-4">Recent Transactions</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold text-sm">Date</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold text-sm">Category</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold text-sm">Payment</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-semibold text-sm">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 10).map((t, index) => (
                      <tr key={index} className="border-b border-gray-800">
                        <td className="py-3 px-4 text-gray-300 text-sm">
                          {t.date ? new Date(t.date).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-opsly-purple/20 text-purple-300 rounded text-xs">
                            {t.category || 'Uncategorized'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-300 text-sm">{t.use_chip || '-'}</td>
                        <td className="py-3 px-4 text-right text-red-400 font-medium text-sm">
                          {formatCurrency(t.amount || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {transactions.length > 10 && (
                <p className="text-center text-gray-500 text-sm mt-4">
                  Showing 10 of {transactions.length} transactions
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

export default FinanceReports

