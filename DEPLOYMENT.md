# Deployment Guide for Finalysis 3.0

This guide covers deploying Finalysis 3.0 to various platforms.

## Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- Git repository access

## Deployment Platforms

### 1. Vercel (Recommended)

Vercel is the recommended platform for deploying Next.js applications.

#### Steps:

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy from the repository root:
```bash
vercel
```

3. Follow the prompts to configure your project

4. For production deployment:
```bash
vercel --prod
```

#### Environment Variables:
Set in Vercel Dashboard → Settings → Environment Variables

### 2. Railway

Railway offers simple deployment with automatic SSL and custom domains.

#### Steps:

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login to Railway:
```bash
railway login
```

3. Initialize project:
```bash
railway init
```

4. Deploy:
```bash
railway up
```

### 3. DigitalOcean App Platform

#### Steps:

1. Connect your GitHub repository
2. Select the branch to deploy
3. Configure build command: `npm run build`
4. Configure run command: `npm start`
5. Add environment variables
6. Deploy

### 4. Docker Deployment

Create a `Dockerfile` in the project root:

```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t finalysis .
docker run -p 3000:3000 finalysis
```

## Post-Deployment Checklist

- [ ] Verify all API endpoints are accessible
- [ ] Test NSE quote API
- [ ] Test news sentiment API
- [ ] Test metrics API
- [ ] Configure custom domain (if applicable)
- [ ] Set up SSL/TLS certificate
- [ ] Configure environment variables
- [ ] Test caching behavior
- [ ] Monitor application performance
- [ ] Set up error tracking (optional: Sentry)
- [ ] Configure analytics (optional: Google Analytics)

## Monitoring and Maintenance

### Health Check Endpoint
Consider adding a health check endpoint at `/api/health`:

```typescript
// app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date() });
}
```

### Performance Monitoring
- Use Vercel Analytics for performance insights
- Monitor API response times
- Track cache hit rates
- Monitor memory usage

### Updating Dependencies
```bash
npm update
npm audit fix
```

## Troubleshooting

### Build Failures
- Check Node.js version compatibility
- Ensure all dependencies are installed
- Review build logs for specific errors

### API Errors
- Verify environment variables are set correctly
- Check network connectivity to external APIs
- Review API rate limits

### Performance Issues
- Adjust cache TTL values
- Enable Next.js image optimization
- Use CDN for static assets
- Implement API rate limiting

## Support

For issues or questions:
- Check the [README.md](README.md)
- Review Next.js documentation
- Open an issue on GitHub
