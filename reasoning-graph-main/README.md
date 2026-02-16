# Reasoning Graph

Chain-of-thought visualization using Llama-3.3-Nemotron-Super-49B reasoning model with Neo4j knowledge graph.

## Features

- 🧠 **Nemotron Reasoning**: Advanced chain-of-thought with self-verification
- 🌳 **Branching Graph**: 55+ branch connections showing reasoning paths
- ✅ **Verification Loops**: See how AI checks its own work
- 🔗 **Evidence Chains**: Track how conclusions are supported
- 📊 **3D Visualization**: Interactive force-directed graph

## Quick Start

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/yhinai/reasoning-graph.git
cd reasoning-graph
```

2. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. **Run the application**
```bash
chmod +x run.sh
./run.sh
```

4. **Access the app**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## Deploy to Vercel

### Prerequisites
- Vercel account
- Neo4j AuraDB instance (free tier available)
- NVIDIA API key

### Deployment Steps

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Login to Vercel**
```bash
vercel login
```

3. **Deploy**
```bash
vercel --prod
```

4. **Set Environment Variables in Vercel Dashboard**
   - Go to your project settings
   - Add these environment variables:
     - `NVIDIA_API_KEY`: Your NVIDIA API key
     - `NEO4J_URI`: Your Neo4j connection URI
     - `NEO4J_USER`: Neo4j username (usually "neo4j")
     - `NEO4J_PASSWORD`: Your Neo4j password

### Alternative: Deploy via GitHub

1. Go to [Vercel Dashboard](https://vercel.com/new)
2. Import your GitHub repository: `yhinai/reasoning-graph`
3. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
4. Add environment variables (same as above)
5. Click "Deploy"

## Environment Variables

```env
# Required
NVIDIA_API_KEY=your_nvidia_api_key
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password

# Optional
BACKEND_PORT=8000
```

## API Endpoints

- `POST /api/chat` - Chat with Nemotron
- `GET /api/graph-data` - Get graph visualization data
- `GET /api/sessions` - List all sessions
- `GET /api/session/<id>` - Get specific session graph
- `GET /health` - Health check

## Graph Structure

The graph creates a true chain-of-thought with multiple relationship types:

- **LEADS_TO**: Main sequential reasoning flow
- **VERIFIES**: Verification loops checking previous work
- **BASED_ON**: Decisions referencing problem understanding
- **SUPPORTED_BY**: Conclusions linking to evidence

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, TailwindCSS
- **Backend**: Flask, Python
- **AI Model**: Llama-3.3-Nemotron-Super-49B (NVIDIA)
- **Database**: Neo4j
- **Deployment**: Vercel

## License

MIT
