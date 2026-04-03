# TaskFlow — AWS Free Tier Deployment Guide

## Architecture (100% Free Tier)

| Service | AWS Resource | Free Tier Limit |
|---|---|---|
| **Database** | RDS PostgreSQL `db.t3.micro` | 750 hrs/month, 20 GB storage (12 months) |
| **Backend** | Elastic Beanstalk → EC2 `t2.micro` | 750 hrs/month (12 months) |
| **Frontend** | Amplify Hosting | 1000 build mins, 15 GB/month |

> ⚠️ All free tier benefits apply for **12 months** from account creation.

---

## Step 1 — RDS PostgreSQL (Free Tier Database)

1. **AWS Console → RDS → Create database**
2. Choose: **Standard Create → PostgreSQL**
3. Template: ✅ **Free tier** (auto-selects `db.t3.micro`)
4. Settings:
   - DB instance identifier: `taskflow-db`
   - Master username: `postgres`
   - Master password: *(pick a strong one, save it)*
5. Storage: `20 GiB` (free tier max)
6. Connectivity:
   - Public access: **Yes**
   - VPC Security Group: create new → name it `taskflow-rds-sg`
7. **Create database** (takes ~5 mins)
8. After creation, go to its **Security Group → Inbound rules → Edit**
   - Add rule: `PostgreSQL | TCP | 5432 | 0.0.0.0/0`
9. Copy the **Endpoint** (e.g. `taskflow-db.xxxx.us-east-1.rds.amazonaws.com`)

**Initialize the schema from your local machine:**
```bash
DATABASE_URL="postgresql://postgres:<password>@<rds-endpoint>:5432/postgres" \
  node backend/db/init.js
```
> Note: connect to the default `postgres` database — `init.js` creates the `taskflow` tables there.

---

## Step 2 — Elastic Beanstalk (Free Tier Backend)

1. **AWS Console → Elastic Beanstalk → Create application**
2. Application name: `taskflow-backend`
3. Platform: **Node.js** | Platform branch: **Node.js 18**
4. Application code: **Upload your code**
   - Zip the repo: `git archive --format=zip HEAD > taskflow.zip`
   - Upload `taskflow.zip`
5. Preset: **Single instance (Free Tier eligible)** ✅
6. Click **Configure more options** → Software → Environment properties, add:
   ```
   DATABASE_URL   = postgresql://postgres:<password>@<rds-endpoint>:5432/postgres
   DATABASE_SSL   = true
   JWT_SECRET     = <any long random string>
   JWT_EXPIRES_IN = 7d
   NODE_ENV       = production
   PORT           = 4000
   ```
7. **Create environment** (takes ~3 mins)
8. Copy the EB URL (e.g. `http://taskflow-backend.us-east-1.elasticbeanstalk.com`)

---

## Step 3 — Amplify (Free Tier Frontend)

1. **AWS Console → Amplify → New app → Host web app**
2. Connect **GitHub** → authorize → select `cx-code-11/taskflow` → branch `main`
3. Build settings: Amplify auto-detects `amplify.yml` ✅ already in repo
4. Add environment variable:
   ```
   VITE_API_URL = http://taskflow-backend.us-east-1.elasticbeanstalk.com
   ```
   *(paste your EB URL from Step 2)*
5. **Save and deploy** — Amplify gives a free `*.amplifyapp.com` URL

---

## Local Development

```bash
# 1. Copy and fill in your local .env
cp backend/.env.example backend/.env
# Set DATABASE_URL=postgresql://arung@localhost:5432/taskflow

# 2. Initialize DB schema + seed admin
cd backend && npm run db:init

# 3. Run backend
npm run dev

# 4. Run frontend (new terminal)
cd frontend && npm run dev
```

**Default admin:** `admin@taskflow.com` / `admin123`

---

## Environment Variables Reference

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:pass@host:5432/postgres` |
| `DATABASE_SSL` | Enable SSL for RDS | `true` |
| `JWT_SECRET` | JWT signing secret | `super_secret_key_here` |
| `JWT_EXPIRES_IN` | Token expiry | `7d` |
| `PORT` | Backend port | `4000` |
| `VITE_API_URL` | Backend URL (frontend build) | `http://your-eb-url.com` |
