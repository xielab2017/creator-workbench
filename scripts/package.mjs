import { execFileSync } from 'node:child_process';
execFileSync('python3', ['scripts/package.py'], { stdio: 'inherit' });
