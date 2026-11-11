// Picks an iPhone simulator on the newest installed iOS runtime, boots it and writes udid/name/version to $GITHUB_OUTPUT.
import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const { devices } = JSON.parse(execSync('xcrun simctl list devices available -j', { encoding: 'utf8' }));
const runtime = Object.keys(devices).filter((k) => /iOS-\d/.test(k) && devices[k].length).sort((a, b) => {
  const v = (k) => k.replace(/.*iOS-/, '').split('-').map(Number);
  const [x, y] = [v(a), v(b)]; return x[0] - y[0] || (x[1] ?? 0) - (y[1] ?? 0);
}).pop();
const list = devices[runtime];
const dev = list.find((d) => d.name === 'iPhone 16') || list.find((d) => /^iPhone \d+$/.test(d.name)) || list.find((d) => /^iPhone/.test(d.name));
const version = runtime.replace(/.*iOS-/, '').replace(/-/g, '.');
console.log(`booting ${dev.name}, iOS ${version}, ${dev.udid}`);
try { execSync(`xcrun simctl boot ${dev.udid}`, { stdio: 'inherit' }); } catch { /* already booted */ }
execSync(`xcrun simctl bootstatus ${dev.udid} -b`, { stdio: 'inherit' });
appendFileSync(process.env.GITHUB_OUTPUT, `udid=${dev.udid}\nname=${dev.name}\nversion=${version}\n`);
