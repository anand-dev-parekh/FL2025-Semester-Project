# FL2025: Group 4 - Magic Journal;

## Team Members
- **&lt;Andrew Cai&gt;**: &lt;andrew.cai@wustl.edu&gt; ; &lt;acai6304&gt;
- **&lt;Prayag Vemulapalli&gt;**: &lt;p.c.vemulapalli@wustl.edu&gt; ; &lt;prayvem&gt;
- **&lt;Anand Parekh&gt;**: &lt;a.d.parekh@wustl.edu&gt; ; &lt;anand-dev-parekh&gt;

## TA
&lt;Aman Verma&gt;

## Objectives
&lt;Description of what your project is about, your key functionalities, tech stacks used, etc. &gt;

## How to Run
&lt;Instructions for how to run your project. Include the URI to your project at the top if applicable.&gt;


### Frontend
First you must create a .env.local file in your frontend folder with these variables set:
```
VITE_GOOGLE_CLIENT_ID=<your_google_client_id>
VITE_BACKEND_API_URL=<your_backend_api_URL>
```

Next run these commands to set up our frontend:

```
cd frontend
npm install
npm run dev
```

### Backend
First you must create a .env file in your backend folder wit these variables set:

```
# Required — used by Flask to sign session cookies
export SECRET_KEY="<>"

export GOOGLE_OAUTH_CLIENT_ID="<your_google_client_id>"

# Optional — the origin of your frontend app for CORS
export FRONTEND_ORIGIN="<>"

# Optional — in dev allow insecure cookies over HTTP
# Set to 1 for local dev (http://localhost), 0 for HTTPS production
export DEV_HTTP=<>
```

Next we must set up a virtual environment
```
python3 -m venv venv

# Activate on Windows
venv\Scripts\activate.bat

# Activate on Mac
source ./venv/bin/activate
```

Next we can install our packages and run our backend server.
```
pip3 install -r requirements.txt
python3 src/app.py
```

### Database



### Kubernetes

kind create cluster --config cluster.yaml

docker build -t magic-backend:release-v1 -f backend/Dockerfile.release backend

docker build -t magic-frontend:release-v1 -f frontend/Dockerfile.release frontend

kind load docker-image magic-backend:release-v1

kind load docker-image magic-frontend:release-v1

kubectl apply -f https://kind.sigs.k8s.io/examples/ingress/deploy-ingress-nginx.yaml

kubectl apply -f k8s/deployment.yaml

kubectl exec deploy/magic-journal-backend -c ollama -- ollama pull phi3:mini

kubectl exec deploy/magic-journal-backend -c ollama -- ollama ps


THEN we do the seeding

kubectl port-forward service/magic-journal-db 5433:5432

export PGPASSWORD="s"

psql -h localhost -p 5433 -U anandparekh -d magic_journal -f database/create_schema.sql

psql -h localhost -p 5433 -U anandparekh -d magic_journal -f database/seed_habits.sql
