# Shringarika E-Commerce - PM2 Configuration

module.exports = {
  apps: [{
    name: 'shringarika',
    cwd: './server',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    watch: false,
    max_memory_restart: '1G',
    exp_backoff_restart_delay: 100,
    restart_delay: 4000,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
