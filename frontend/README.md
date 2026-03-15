# Öpsly - Smart Support, Strong Decisions

A modern React.js frontend application for business operations automation and analytics.

## Features

- **Landing Page**: Beautiful hero section with feature cards showcasing Integrations, Customer Support, and Analytics
- **Login Page**: Secure authentication with Google OAuth option
- **Marketing Dashboard**: Social media account management and post creation
- **Customer Support Dashboard**: Ticket management and AI-powered support conversations
- **Finance Analytics**: Transaction tracking, forecasting, and anomaly detection

## Tech Stack

- React 18
- React Router for navigation
- Tailwind CSS for styling
- Recharts for data visualization
- React Icons for iconography
- Vite for build tooling

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Pages

- `/` - Landing page
- `/login` - Login page
- `/marketing` - Marketing dashboard
- `/marketing/post-analytics` - Post analytics detail
- `/customer-support` - Customer support dashboard
- `/customer-support/ticket/:id` - Ticket detail page
- `/finance` - Finance analytics dashboard
- `/finance/forecast` - Financial forecasting
- `/finance/anomaly` - Anomaly detection

## Color Scheme

- Primary Purple: `#9333EA` (opsly-purple)
- Dark Background: `#0F0F0F` (opsly-dark)
- Gray Background: `#1A1A1A` (opsly-gray)
- Card Background: `#1E1E2E` (opsly-card)

## Project Structure

```
src/
├── components/
│   └── DashboardLayout.jsx    # Reusable dashboard layout with sidebar
├── pages/
│   ├── LandingPage.jsx        # Landing page
│   ├── LoginPage.jsx          # Login page
│   ├── MarketingDashboard.jsx # Marketing dashboard
│   ├── MarketingPostAnalytics.jsx # Post analytics
│   ├── CustomerSupportDashboard.jsx # Support dashboard
│   ├── TicketDetail.jsx       # Ticket detail page
│   ├── FinanceDashboard.jsx   # Finance dashboard
│   ├── FinanceForecast.jsx    # Financial forecasting
│   └── FinanceAnomaly.jsx     # Anomaly detection
├── App.jsx                     # Main app component with routing
├── main.jsx                    # Entry point
└── index.css                   # Global styles
```

