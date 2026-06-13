module.exports = {
  apps: [
    {
      name: 'health-tracker',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/home/ec2-user/projects/health-tracker',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3100,
      },
    },
  ],
};
