# Health Tracker

Daily health check-in app built with Next.js 14, Prisma, and PostgreSQL.

## Deploy on Amazon Linux 2023

### 1. Install Node.js 20

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
node --version  # should be v20.x
```

### 2. Install PostgreSQL

```bash
sudo dnf install -y postgresql15 postgresql15-server
sudo postgresql-setup --initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 3. Create the database and user

```bash
sudo -u postgres psql <<EOF
CREATE USER healthuser WITH PASSWORD 'your_secure_password';
CREATE DATABASE healthtracker OWNER healthuser;
GRANT ALL PRIVILEGES ON DATABASE healthtracker TO healthuser;
EOF
```

### 4. Clone the repo

```bash
cd /home/ec2-user/projects
git clone <your-repo-url> health-tracker
cd health-tracker
```

### 5. Configure environment

```bash
cp .env.example .env
nano .env
# Set DATABASE_URL=postgresql://healthuser:your_secure_password@localhost:5432/healthtracker
```

### 6. Install dependencies

```bash
npm install
```

### 7. Generate Prisma client and push schema

```bash
npx prisma generate
npx prisma db push
```

### 8. Build the app

```bash
npm run build
```

### 9. Install and configure PM2

```bash
sudo npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # follow the printed command to enable auto-start on reboot
```

### 10. Install Nginx and place the Cloudflare Origin Certificate

The app is served at `https://ft.keithpelchat.com` behind Cloudflare. Use a Cloudflare Origin Certificate so Cloudflare can verify the connection to the origin.

**Generate the cert:**
1. Cloudflare dashboard → your domain → SSL/TLS → Origin Server → Create Certificate
2. Add `ft.keithpelchat.com` as a hostname (wildcard `*.keithpelchat.com` also works)
3. Choose 15-year validity, RSA key
4. Copy the **Origin Certificate** and **Private Key** shown on screen (you only see the key once)

**Place the files on the server:**
```bash
sudo mkdir -p /etc/nginx/ssl
sudo nano /etc/nginx/ssl/ft.keithpelchat.com.crt   # paste Origin Certificate
sudo nano /etc/nginx/ssl/ft.keithpelchat.com.key   # paste Private Key
sudo chmod 600 /etc/nginx/ssl/ft.keithpelchat.com.key
```

**Install and start Nginx:**
```bash
sudo dnf install -y nginx
sudo cp nginx.conf /etc/nginx/conf.d/health-tracker.conf
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl start nginx
```

**Cloudflare SSL/TLS mode:** set to **Full (strict)** in the Cloudflare dashboard so traffic is encrypted end-to-end and the origin cert is verified.

### 11. Open firewall

EC2 Security Group — add inbound rules for ports **80** and **443**.

```bash
# If also using firewalld:
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Port for Next.js (default 3000) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:push` | Push Prisma schema to DB |
| `npm run db:generate` | Regenerate Prisma client |

## PM2 Commands

```bash
pm2 status              # check app status
pm2 logs health-tracker # view logs
pm2 restart health-tracker
pm2 stop health-tracker
```

## Updating

```bash
git pull
npm install
npx prisma generate
npx prisma db push   # if schema changed
npm run build
pm2 restart health-tracker
```
