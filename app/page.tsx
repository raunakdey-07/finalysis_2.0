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
            description="Real-time price data from National Stock Exchange"
            Icon={TrendingUp}
          />
          <FeatureCard
            title="Cached Fundamentals"
            description="Efficient caching layer for fundamental stock data"
            Icon={Database}
          />
          <FeatureCard
            title="News Sentiment"
            description="RSS-based sentiment analysis from financial news"
            Icon={Newspaper}
          />
          <FeatureCard
            title="Explainable Metrics"
            description="Transparent metrics with clear explanations"
            Icon={Target}
          />
        </div>

        {/* API Endpoints */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-8 mb-16">
          <h2 className="text-3xl font-bold mb-6 text-slate-800 dark:text-white">
            API Endpoints
          </h2>
          <div className="space-y-4">
            <ApiEndpoint
              method="GET"
              path="/api/nse/quote?symbol=RELIANCE"
              description="Get stock quote from NSE"
            />
            <ApiEndpoint
              method="GET"
              path="/api/nse/search?q=tata"
              description="Search for stocks by keyword"
            />
            <ApiEndpoint
              method="GET"
              path="/api/news?symbol=TCS"
              description="Get news with sentiment analysis"
            />
            <ApiEndpoint
              method="GET"
              path="/api/news?type=sentiment"
              description="Get overall market sentiment"
            />
            <ApiEndpoint
              method="GET"
              path="/api/metrics?symbol=INFY"
              description="Get explainable metrics for a stock"
            />
          </div>
        </div>

        {/* Tech Stack */}
        <div className="text-center">
          <h3 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white">
            Built With
          </h3>
          <div className="flex flex-wrap justify-center gap-4">
            <TechBadge name="Next.js 16.1" />
            <TechBadge name="TypeScript 5" />
            <TechBadge name="Tailwind CSS 4" />
            <TechBadge name="Node.js 20" />
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
      <Icon className="w-10 h-10 mb-4 text-blue-600 dark:text-blue-400" />
      <h3 className="text-xl font-semibold mb-2 text-slate-800 dark:text-white">
        {title}
      </h3>
      <p className="text-slate-600 dark:text-slate-300">{description}</p>
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
    <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
      <span className="px-3 py-1 bg-green-500 text-white text-sm font-semibold rounded">
        {method}
      </span>
      <div className="flex-1">
        <code className="text-sm text-slate-800 dark:text-slate-200 font-mono">
          {path}
        </code>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {description}
        </p>
      </div>
    </div>
  );
}

function TechBadge({ name }: { name: string }) {
  return (
    <span className="px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded-full text-sm font-semibold">
      {name}
    </span>
  );
}
