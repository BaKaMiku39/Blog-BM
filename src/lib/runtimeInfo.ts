import { execSync } from 'node:child_process';
import lock from '../../package-lock.json';

export const astroVersion = lock.packages['node_modules/astro']?.version || '—';
export const nodeVersion = process.version;
export const platformNames: Record<string, string> = { win32: 'Windows', linux: 'Linux', darwin: 'macOS' };
export const system = `${platformNames[process.platform] || process.platform} / ${process.arch}`;

let detectedNpmVersion = '—';
try { detectedNpmVersion = execSync('npm --version', { encoding: 'utf8', timeout: 2000 }).trim(); } catch { /* npm may be absent from a minimal runtime image. */ }
export const npmVersion = detectedNpmVersion;
