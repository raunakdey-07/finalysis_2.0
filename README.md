# Finalysis 3.0

A from-scratch, API-only, zero-budget stock analysis application for Indian equities built with Next.js, TypeScript, and Tailwind CSS.

## 🎯 Overview

Finalysis 3.0 is a production-grade stock analysis platform designed specifically for Indian equities (NSE). It provides comprehensive market analysis, cached fundamentals, RSS-based news sentiment, and explainable metrics - all without requiring paid APIs or datasets.

## 🚀 Features

- **NSE Price Integration**: Real-time price data from National Stock Exchange
- **Cached Fundamentals**: Efficient caching layer for fundamental stock data
- **RSS-Based News Sentiment**: Automated sentiment analysis from news feeds
- **Explainable Metrics**: Transparent, interpretable financial metrics
- **Production-Grade UI**: Clean, responsive interface built with Tailwind CSS
- **API-First Architecture**: RESTful API design for scalability
- **Zero-Budget**: No paid APIs or datasets required

## 🛠️ Tech Stack

- **Framework**: Next.js 16.1+ (App Router)
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS 4+
- **Runtime**: Node.js 20+
- **Package Manager**: npm

## 📋 Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher

## 🏁 Getting Started

### Installation

1. Clone the repository:
```bash
git clone https://github.com/raunakdey-07/finalysis_2.0.git
cd finalysis_2.0
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
finalysis_2.0/              # Repository name (Finalysis 3.0 codebase)
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── nse/          # NSE price data endpoints
│   │   ├── fundamentals/  # Cached fundamental data
│   │   ├── news/         # RSS news sentiment
│   │   └── metrics/      # Explainable metrics
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── lib/                   # Utility functions and helpers
│   ├── cache/            # Caching implementations
│   ├── nse/              # NSE API integrations
│   ├── sentiment/        # Sentiment analysis
│   └── metrics/          # Metric calculations
├── components/           # React components
├── types/               # TypeScript type definitions
├── public/              # Static assets
└── README.md
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 🏗️ Architecture

### API-Only Design
All data processing and business logic is handled through API routes, ensuring:
- Clean separation of concerns
- Easy scalability
- Reusable endpoints

### Caching Strategy
- In-memory caching for frequently accessed data
- Configurable TTL (Time To Live) for different data types
- Efficient cache invalidation

### Data Sources
- **NSE Data**: Public NSE APIs for price information
- **RSS Feeds**: Curated financial news sources
- **Fundamentals**: Publicly available financial statements

## 🌐 Deployment

This application can be deployed to:
- **Vercel** (Recommended for Next.js)
- **Railway**
- **DigitalOcean App Platform**
- **Any Node.js hosting platform**

### Environment Variables
Create a `.env.local` file for local development:
```bash
# Add your environment variables here
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org)
- Styled with [Tailwind CSS](https://tailwindcss.com)
- Powered by open-source tools and public APIs
