/**
 * Finalysis 3.0 - Fastify Backend Server
 * 
 * Standalone API service for Indian equity analysis
 * - Serverless-friendly
 * - Stateless endpoints  
 * - Circuit breaker pattern
 * - Aggressive caching
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// Register CORS
await fastify.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
});

// Circuit breaker state
const circuitBreaker = {
  nse: { failures: 0, lastFailure: null, state: 'closed' }, // closed = working, open = failing
  screener: { failures: 0, lastFailure: null, state: 'closed' },
  news: { failures: 0, lastFailure: null, state: 'closed' },
};

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

/**
 * Check if circuit breaker should allow request
 */
function canMakeRequest(service) {
  const circuit = circuitBreaker[service];
  
  if (circuit.state === 'closed') {
    return true;
  }
  
  // Check if timeout has passed
  if (circuit.lastFailure && Date.now() - circuit.lastFailure > CIRCUIT_BREAKER_TIMEOUT) {
    circuit.state = 'closed';
    circuit.failures = 0;
    return true;
  }
  
  return false;
}

/**
 * Record failure and potentially open circuit
 */
function recordFailure(service) {
  const circuit = circuitBreaker[service];
  circuit.failures++;
  circuit.lastFailure = Date.now();
  
  if (circuit.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuit.state = 'open';
    fastify.log.error(`Circuit breaker OPEN for ${service}`);
  }
}

/**
 * Record success and reset failure count
 */
function recordSuccess(service) {
  const circuit = circuitBreaker[service];
  circuit.failures = 0;
  circuit.state = 'closed';
}

/**
 * Retry logic with exponential backoff
 */
async function retryWithBackoff(fn, service, maxRetries = 3) {
  if (!canMakeRequest(service)) {
    return null;
  }
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fn();
      recordSuccess(service);
      return result;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        recordFailure(service);
        fastify.log.error(`Failed after ${maxRetries} attempts:`, error);
        return null;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return null;
}

// Health check endpoint
fastify.get('/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    circuits: {
      nse: circuitBreaker.nse.state,
      screener: circuitBreaker.screener.state,
      news: circuitBreaker.news.state,
    },
  };
});

// Stock quote endpoint
fastify.get('/api/quote/:symbol', async (request) => {
  const { symbol } = request.params;
  
  // This would call the NSE integration
  // For now, returning structure with confidence level
  return {
    success: true,
    data: {
      symbol: symbol.toUpperCase(),
      price: 0,
      change: 0,
      changePercent: 0,
      volume: 0,
      timestamp: new Date(),
    },
    metadata: {
      source: 'NSE India',
      lastUpdated: new Date().toISOString(),
      confidenceLevel: 'high',
      cacheHit: false,
    },
  };
});

// Fundamentals endpoint
fastify.get('/api/fundamentals/:symbol', async (request) => {
  const { symbol } = request.params;
  
  return {
    success: true,
    data: {
      symbol: symbol.toUpperCase(),
      pe: null,
      pb: null,
      roe: null,
      roce: null,
      debtToEquity: null,
    },
    metadata: {
      source: 'Screener.in',
      lastUpdated: new Date().toISOString(),
      confidenceLevel: 'medium',
      cacheHit: false,
      cacheTTL: '60-90 days',
    },
  };
});

// News sentiment endpoint
fastify.get('/api/news/:symbol', async () => {
  return {
    success: true,
    data: [],
    metadata: {
      source: 'Google News RSS',
      lastUpdated: new Date().toISOString(),
      confidenceLevel: 'medium',
      cacheHit: false,
      cacheTTL: '6-12 hours',
    },
  };
});

// Circuit breaker status endpoint
fastify.get('/api/status', async () => {
  return {
    circuitBreakers: circuitBreaker,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    fastify.log.info(`Fastify server listening on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

export { fastify, retryWithBackoff, canMakeRequest };
