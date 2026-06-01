/** PM2 on VPS: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: 'helion-report-portal',
      cwd: __dirname + '/server',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
    },
  ],
};
