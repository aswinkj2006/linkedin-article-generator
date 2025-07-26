const { execSync } = require('child_process');
execSync('apt-get update && apt-get install -y chromium', { stdio: 'inherit' });
