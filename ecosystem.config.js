module.exports = {
  apps: [{
    name: 'edenfood',
    script: './server.js',
    cwd: '/var/eden',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: '/var/eden/logs/err.log',
    out_file: '/var/eden/logs/out.log',
    merge_logs: true,
  }]
};
