// PM2 process definitions for running BridgeCodes' web app and background
// worker always-on on a VPS -- an alternative to the systemd units in
// deploy/systemd/ for anyone who'd rather manage processes with PM2 (the
// same tool the SSH deployment adapter uses to supervise a *customer's*
// deployed application; this file is for the platform itself).
//
// Usage, from the repo root, after `npm ci && npm run build`:
//   pm2 start deploy/pm2/ecosystem.config.cjs
//   pm2 save              # persist the process list across reboots
//   pm2 startup           # prints the OS-specific command to run once so
//                         # PM2 itself comes back up on boot
// Logs: `pm2 logs bridgecodes-worker` / `pm2 logs bridgecodes-web`

const repoRoot = `${__dirname}/../..`;

module.exports = {
  apps: [
    {
      name: "bridgecodes-web",
      script: "npm",
      args: "run start",
      cwd: repoRoot,
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: "bridgecodes-worker",
      script: "npm",
      args: "run worker",
      cwd: repoRoot,
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 10,
      // scripts/worker.ts only handles SIGTERM/SIGINT -- give it real time
      // to close BullMQ connections and let an in-flight step finish before
      // PM2 escalates to SIGKILL on a restart/reload.
      kill_timeout: 30000,
    },
  ],
};
