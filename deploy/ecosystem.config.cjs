const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

module.exports = {
  apps: [
    {
      name: "superappsBCI",
      cwd: "/var/www/superappsBCI",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000 -H 127.0.0.1",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        TZ: "Asia/Jakarta",
        NODE_ENV: "production",
        PORT: "3000",
        JWT_SECRET: process.env.JWT_SECRET,
        DATABASE_URL: process.env.DATABASE_URL,
        POS_WEBHOOK_API_KEY: process.env.POS_WEBHOOK_API_KEY,
        GOOGLE_SYNC_WEBHOOK_URL: process.env.GOOGLE_SYNC_WEBHOOK_URL,
        COOKIE_SECURE: process.env.COOKIE_SECURE ?? "false",
        APP_URL: process.env.APP_URL ?? "",
      },
    },
  ],
};
