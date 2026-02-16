# Skinnova
## Inspiration

Skinnova was inspired by a simple but serious problem: **people increasingly rely on AI for skincare advice**, yet skincare guidance directly affects real human bodies. Unlike casual chatbots, incorrect or hallucinated skincare recommendations can lead to irritation, long-term skin damage, or loss of trust.

While building AI-driven skincare experiences, we realized that **traditional LLM observability treats hallucinations as a binary correctness issue**, often evaluating every prompt uniformly. This approach is expensive, noisy, and fails to answer a more important question:

> *If a hallucination occurs, how many users does it actually affect, and who are they?*

This insight led us to design Skinnova not just as an AI skincare assistant, but as a **production-grade system where AI reliability, risk, and impact are observable**.

## What We Built

Skinnova is an AI-powered skincare assistant that:
- Provides **personalized skincare routines**
- Explains **ingredients and formulations**
- Answers **skin concern–specific questions**
- Tailors responses using **user attributes** such as age group, skin type, and skin concern

On top of this user-facing functionality, we built a **novel LLM observability layer** focused on **selective hallucination evaluation and blast radius measurement**.

## How We Built It
### System architecture
<img width="6580" height="3698" alt="Skinnova-datadog arch diagram" src="https://github.com/user-attachments/assets/d7365e5e-d2a9-47ba-8934-3b0ea24fae49" />

- **Google Cloud**  
  Used for LLM inference and backend infrastructure to ensure scalability and reliability.
- **Python + FastAPI**  
  Handles request orchestration, persona enrichment, and metric emission.
- **Datadog**  
  Used as the central observability platform for metrics, dashboards, alerts, and runbooks.

### Selective Hallucination Evaluation

Instead of evaluating hallucinations for every prompt, Skinnova introduces a **risk-based prefilter** that classifies prompts into low, medium, or high risk.

Only high-risk prompts are evaluated for hallucination. Importantly, **the decision to evaluate is itself observable**.

This allows us to track:
- How often evaluation is triggered
- Why it was triggered
- How selective evaluation reduces cost and noise


### Hallucination Blast Radius

Detecting a hallucination alone is not enough. We wanted to understand **real-world impact**.

We introduced the **Hallucination Blast Radius Index (HBRS)**, derived inside Datadog using observable signals:

\[
\text{HBRS}(t) =
\text{HallucinationScore}(t)
\times
\text{ChatVolume}(t)
\times
\text{PersonaRiskWeight}
\]

Where:
- Hallucination Score measures semantic deviation
- Chat Volume represents real user exposure
- Persona Risk Weight reflects sensitivity based on age group and skin concern

By emitting **atomic metrics** and deriving impact dynamically, we keep the system transparent, tunable, and production-realistic.
### Skinnova is built with:

- FastAPI backend
- React frontend
- Nginx reverse proxy
- Datadog observability
- Docker Compose orchestration

## Project structure:

```
├── api/ # Backend API (FastAPI)
├── frontend/ # React frontend app
├── nginx/ # Nginx configuration
├── scripts/ # Utility scripts
├── .github/workflows/ # CI/CD workflows
│
├── docker-compose.yml # Main Docker Compose file
├── docker-compose-local.yml # Local development compose file
├── env/ # Environment variable files
├── README.md
└── LICENSE

```


## Environment Configuration

Create a directory named `env/` in the project root and add the following files. Look into the sample env to understand the structure

[docker*compose.yml*](docker_compose.yml)

```
services:
  frontend:
    build:
      context: .
    container_name: skinnova-frontend
    ports:
      - "80:80"
```

The compose file defines an application with an services `frontend` and `api`.

## Deploy with docker compose

```
$ docker compose up -d
Building frontend
Sending build context to Docker daemon   1.49MB

Step 1/17 : FROM node:lts AS development
 ---> 9153ee3e2ced
Step 2/17 : WORKDIR /app
 ---> Using cache
 ---> a7909d92148a
Step 3/17 : COPY package.json /app/package.json
 ---> 2e690dfe99b2
Step 4/17 : COPY package-lock.json /app/package-lock.json
 ---> dd0132803f43
 .....
Step 16/17 : COPY --from=build /app/build .
 ---> Using cache
 ---> 447488bdf601
Step 17/17 : ENTRYPOINT ["nginx", "-g", "daemon off;"]
 ---> Using cache
 ---> 6372a67cf86f
Successfully built 6372a67cf86f
Successfully tagged react-nginx_frontend:latest
```

## To run locally

```
$ docker compose -f docker-compose-local.yml up

```

## Expected result

Listing containers must show containers running and the port mapping as below:

```
$ docker ps

CONTAINER ID   IMAGE                  COMMAND                  CREATED              STATUS              PORTS                               NAMES
b6d00a4974ce   react-nginx_frontend   "nginx -g 'daemon of…"   About a minute ago   Up About a minute   0.0.0.0:80->80/tcp, :::80->80/tcp   skinnova-frontend
```

After the application start, navigate to http://localhost in your browser

Stop and remove the containers

```
$ docker compose down
```

## What Happens Behind the Scenes

```
User
 ↓
Nginx
 ↓
Frontend (React)
 ↓
API (FastAPI)
 ↓
Datadog
```

Nginx serves the React frontend and proxies /api requests to the backend
FastAPI handles API traffic with Datadog APM tracing enabled
Datadog runs as a sidecar monitoring agent collecting logs, metrics, and traces
