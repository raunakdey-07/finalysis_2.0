import { TrendingUp, Database, Newspaper, Target } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <header className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Finalysis 3.0
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Zero-budget stock analysis for Indian equities with NSE integration,
            cached fundamentals, and RSS-based sentiment analysis
          </p>
        </header>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <FeatureCard
            title="NSE Integration"
            description="Live price quotes from National Stock Exchange for all listed Indian stocks"
            Icon={TrendingUp}
          />
          <FeatureCard
            title="Cached Fundamentals"
            description="Financial ratios and metrics cached for fast analysis without repeated API calls"
            Icon={Database}
          />
          <FeatureCard
            title="News Sentiment"
            description="Automated sentiment scoring from Economic Times, MoneyControl, and LiveMint RSS feeds"
            Icon={Newspaper}
          />
          <FeatureCard
            title="Explainable Metrics"
            description="Each metric includes clear definition, interpretation guide, and common pitfalls"
            Icon={Target}
          />
        </div>

        {/* API Endpoints */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-8">
          <h2 className="text-3xl font-bold mb-6 text-slate-800 dark:text-white">
            API Endpoints
          </h2>
          <div className="space-y-4">
            <ApiEndpoint
              method="GET"
              path="/api/nse/quote?symbol=RELIANCE"
              description="Get current stock price, volume, and trading data"
            />
            <ApiEndpoint
              method="GET"
              path="/api/nse/search?q=tata"
              description="Search for company tickers by name or keyword"
            />
            <ApiEndpoint
              method="GET"
              path="/api/news?symbol=TCS"
              description="Get latest news articles with sentiment scores"
            />
            <ApiEndpoint
              method="GET"
              path="/api/news?type=sentiment"
              description="Get aggregated market sentiment indicator"
            />
            <ApiEndpoint
              method="GET"
              path="/api/metrics?symbol=INFY"
              description="Get Piotroski F-Score, Altman Z, and valuation metrics"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  Icon,
}: {
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <Icon className="w-8 h-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <h3 className="text-xl font-semibold text-slate-800 dark:text-white">
          {title}
        </h3>
      </div>
      <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function ApiEndpoint({
  method,
  path,
  description,
}: {
  method: string;
  path: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">
      <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded uppercase">
        {method}
      </span>
      <div className="flex-1 min-w-0">
        <code className="text-sm text-slate-800 dark:text-slate-200 font-mono block break-all">
          {path}
        </code>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          {description}
        </p>
      </div>
    </div>
  );
}
