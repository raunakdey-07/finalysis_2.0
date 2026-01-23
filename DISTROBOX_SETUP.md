# Distrobox Setup Guide for Finalysis 3.0

This guide provides step-by-step instructions for setting up a clean development environment using Distrobox.

## What is Distrobox?

Distrobox allows you to use any Linux distribution inside your terminal, with tight integration with your host system. Perfect for creating isolated, reproducible development environments.

## Prerequisites

- Podman or Docker installed on your system
- Distrobox installed (`curl -s https://raw.githubusercontent.com/89luca89/distrobox/main/install | sh -s -- --prefix ~/.local`)

## Step 1: Create a New Distrobox Container

```bash
# Create a new Ubuntu-based container for development
distrobox create --name finalysis-dev --image ubuntu:22.04

# Enter the container
distrobox enter finalysis-dev
```

## Step 2: Install Node.js (LTS)

```bash
# Update package lists
sudo apt update

# Install Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show v10.x.x
```

## Step 3: Install pnpm

```bash
# Install pnpm globally
npm install -g pnpm

# Verify installation
pnpm --version  # Should show v10.x.x
```

## Step 4: Install Git

```bash
# Install Git
sudo apt install -y git

# Configure Git
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Verify installation
git --version
```

## Step 5: Install Additional Tools

```bash
# Install build essentials (for native modules)
sudo apt install -y build-essential

# Install curl and wget (if not already installed)
sudo apt install -y curl wget

# Install vim or your preferred editor
sudo apt install -y vim
```

## Step 6: Clone the Repository

```bash
# Navigate to your projects directory
cd ~
mkdir -p projects
cd projects

# Clone the Finalysis repository
git clone https://github.com/raunakdey-07/finalysis_2.0.git
cd finalysis_2.0
```

## Step 7: Install Dependencies

```bash
# Install project dependencies with pnpm
pnpm install

# Verify installation
pnpm list
```

## Step 8: Environment Setup

```bash
# Create environment file
cp .env.example .env.local

# Edit environment variables if needed
vim .env.local
```

## Step 9: Verify Setup

```bash
# Run linter
pnpm run lint

# Build the project
pnpm run build

# Start development server
pnpm run dev
```

Open your browser to `http://localhost:3000` to verify the frontend is running.

## Step 10: Start Backend Service (Optional)

In a new terminal (within the same Distrobox):

```bash
# Start the Fastify backend
pnpm run dev:api
```

The API server will start on `http://localhost:3001`.

## Running Both Services Concurrently

```bash
# Run both frontend and backend together
pnpm run dev:all
```

## Distrobox Tips

### Accessing Host Files
Your home directory is automatically mounted in Distrobox. You can access files from your host system seamlessly.

### Exporting Applications
You can export applications from Distrobox to your host:

```bash
distrobox-export --app firefox
```

### Stopping the Container
```bash
# Exit the container
exit

# Stop the container (from host)
distrobox stop finalysis-dev
```

### Removing the Container
```bash
# Remove the container if you need to start fresh
distrobox rm finalysis-dev
```

## Troubleshooting

### Port Already in Use
If ports 3000 or 3001 are already in use:

```bash
# Find process using the port
lsof -i :3000
lsof -i :3001

# Kill the process
kill -9 <PID>
```

### Permission Issues
If you encounter permission issues:

```bash
# Fix ownership
sudo chown -R $USER:$USER /path/to/finalysis_2.0
```

### Node Modules Issues
If dependencies fail to install:

```bash
# Clear cache and reinstall
pnpm store prune
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## Development Workflow

### Making Changes
1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Test locally: `pnpm run build`
4. Lint your code: `pnpm run lint`
5. Commit: `git commit -m "feat: your feature"`
6. Push: `git push origin feature/your-feature`

### Keeping Container Updated
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js packages
pnpm update
```

## Best Practices

1. **Use Distrobox for Isolation**: Keep your development environment separate from your host system
2. **Regular Backups**: Commit and push your code regularly
3. **Clean Builds**: Occasionally run `pnpm run build` to ensure everything compiles
4. **Resource Monitoring**: Monitor memory usage with `htop` or `free -h`
5. **Container Snapshots**: Before major changes, consider creating a new container

## Additional Resources

- [Distrobox Documentation](https://github.com/89luca89/distrobox)
- [Node.js Documentation](https://nodejs.org/docs/)
- [pnpm Documentation](https://pnpm.io/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Fastify Documentation](https://www.fastify.io/)

## Container Specifications

**Recommended Specs:**
- RAM: 4GB minimum, 8GB recommended
- CPU: 2 cores minimum, 4 cores recommended
- Disk: 10GB free space

**Installed Software:**
- Ubuntu 22.04 LTS
- Node.js 20.x (LTS)
- pnpm 10.x
- Git latest
- Build essentials

## Next Steps

After setup, refer to:
- [README.md](README.md) - Project overview
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) - Development progress

---

**Note**: This setup creates a reproducible development environment that matches production requirements.
