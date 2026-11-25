# Deployment (Render + MongoDB Atlas, free tiers)

The API serves the built React app, so you deploy **one web service**.

## 1. MongoDB Atlas
1. Create a free M0 cluster at https://cloud.mongodb.com.
2. **Database Access** → add a database user with a password.
3. **Network Access** → allow `0.0.0.0/0` (Render's IPs are dynamic).
4. **Connect → Drivers** → copy the URI and add a database name:
   `mongodb+srv://<user>:<pass>@cluster0.xxxx.mongodb.net/helpdesk?retryWrites=true&w=majority`

## 2. Push to GitHub
```bash
git init
git add .
git commit -m "Support ticket management system"
git branch -M main
git remote add origin https://github.com/<you>/support-ticket-system.git
git push -u origin main
```

## 3. Render web service
New → **Web Service** → connect the repo, then:

| Setting | Value |
|---|---|
| Runtime | Node |
| Root directory | *(leave empty)* |
| Build command | `npm --prefix client ci --include=dev && npm --prefix client run build && npm --prefix server ci --omit=dev` |
| Start command | `npm --prefix server start` |
| Health check path | `/api/health` |

Environment variables:
| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | your Atlas URI |
| `JWT_SECRET` | a long random string (e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `CLIENT_ORIGIN` | your Render URL, e.g. `https://helpdesk-xxxx.onrender.com` |

After the first deploy, open the Render **Shell** tab and run:
```bash
npm --prefix server run seed
```
This creates the demo accounts. Set `SEED_ADMIN_PASSWORD` first if you don't want the default admin password on a public URL.

## Alternative: Docker anywhere
```bash
docker build -t helpdesk .
docker run -p 5000:5000 -e NODE_ENV=production -e MONGODB_URI=... -e JWT_SECRET=... helpdesk
```

## Optional: email
Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` (e.g. Brevo, Mailtrap, or Gmail with an app password). Without them, emails are only logged.
