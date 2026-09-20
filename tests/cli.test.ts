import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { runCli } from '../packages/hcb-cli/src/cli.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const desktopManifest = join(root, 'examples/native-desktop.feature.yaml');
const desktopTarget = join(root, 'examples/desktop.target.yaml');
const directories: string[] = [];
async function temporary(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'hcb-cli-'));
  directories.push(directory);
  return directory;
}
async function invoke(args: string[], cwd = root): Promise<{ code: number; out: string; err: string }> {
  let out = '';
  let err = '';
  const code = await runCli(args, { cwd, stdout: text => { out += text; }, stderr: text => { err += text; } });
  return { code, out, err };
}
afterEach(async () => { await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))); });

describe('manual-first CLI', () => {
  it('initializes an empty manifest with explicit target API and refuses overwrites', async () => {
    const cwd = await temporary();
    const result = await invoke(['init', '--api', '24', '--platform', 'linux', '--source-arch', 'c86', '--device', 'pc'], cwd);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.out)).toMatchObject({ status: 'initialized', features: 0 });
    expect((await invoke(['manifest', 'validate'], cwd)).code).toBe(0);
    expect((await invoke(['plan'], cwd)).out).toContain('"items": []');
    const validation = await invoke(['validate'], cwd);
    expect(validation.code).toBe(0);
    expect(JSON.parse(validation.out)).toMatchObject({ status: 'pass_with_warnings', checks: { compile_check: 'skipped' } });
    const before = await readFile(join(cwd, 'hcb.feature.yaml'), 'utf8');
    const retry = await invoke(['init', '--api', '24'], cwd);
    expect(retry.code).toBe(2);
    expect(retry.err).toContain('HCB-CLI-002');
    expect(await readFile(join(cwd, 'hcb.feature.yaml'), 'utf8')).toBe(before);
  });

  it.each([
    ['init'], ['init', '--api', 'invalid'], ['init', '--api', '0'],
    ['init', '--api', '24', '--platform', 'invalid'],
    ['init', '--api', '24', '--device', 'c86']
  ])('rejects invalid initialization without writing: %j', async (...args) => {
    const cwd = await temporary();
    expect((await invoke(args, cwd)).code).toBe(2);
    expect(await readdir(cwd)).toEqual([]);
  });

  it('refuses an existing target without creating a manifest', async () => {
    const cwd = await temporary();
    await writeFile(join(cwd, 'hcb.target.yaml'), 'existing');
    expect((await invoke(['init', '--api', '24'], cwd)).code).toBe(2);
    expect(await readdir(cwd)).toEqual(['hcb.target.yaml']);
  });

  it('validates examples and reports malformed or missing manifests', async () => {
    expect((await invoke(['manifest', 'validate', desktopManifest])).code).toBe(0);
    const cwd = await temporary();
    expect((await invoke(['manifest', 'validate'], cwd)).code).toBe(1);
    await writeFile(join(cwd, 'invalid.yaml'), 'features: [');
    expect((await invoke(['manifest', 'validate', 'invalid.yaml'], cwd)).code).toBe(1);
    expect((await invoke(['plan'], cwd)).code).toBe(2);
  });

  it('produces plans and repeatable previews without modifying host UI', async () => {
    const cwd = await temporary();
    const inputs = ['--manifest', desktopManifest, '--target', desktopTarget];
    const plan = await invoke(['plan', ...inputs], cwd);
    expect(plan.code).toBe(0);
    const parsed = JSON.parse(plan.out) as { items: { decision: string }[] };
    expect(parsed.items.every(item => item.decision === 'conditional')).toBe(true);
    const first = await invoke(['apply', '--dry-run', ...inputs], cwd);
    expect(first.code).toBe(0);
    expect(first).toEqual(await invoke(['apply', '--dry-run', ...inputs], cwd));
    expect(JSON.parse(first.out)).toMatchObject({ mode: 'dry-run', platformArtifactsGenerated: false });
    expect(await readdir(cwd)).toEqual([]);
    const denied = await invoke(['apply', ...inputs], cwd);
    expect(denied.code).toBe(2);
    expect(denied.err).toContain('HCB-GN-007');
  });

  it('validates the supplied Stage host without claiming compilation', async () => {
    const report = await invoke(['validate', '--manifest', desktopManifest, '--target', desktopTarget, '--project', root]);
    expect(report.code).toBe(0);
    expect(JSON.parse(report.out)).toMatchObject({ status: 'pass_with_warnings', checks: { compile_check: 'skipped' } });
  });

  it('uses failure exits for device rejections and missing host metadata', async () => {
    const cwd = await temporary();
    await writeFile(join(cwd, 'target.yaml'), 'devices: [pc]\napiVersion: 24\nstageModel: true\n');
    const inputs = ['--manifest', join(root, 'examples/appointment.feature.yaml'), '--target', 'target.yaml'];
    expect((await invoke(['plan', ...inputs], cwd)).code).toBe(1);
    expect((await invoke(['apply', '--dry-run', ...inputs], cwd)).code).toBe(1);
    expect((await invoke(['validate', ...inputs, '--project', '.'], cwd)).code).toBe(1);
  });

  it.each(['missing', 'devices: [', 'devices: [pc]\ndevices: [phone]', 'devices: [c86]\napiVersion: 24\nstageModel: true'])(
  'rejects malformed target profiles: %s', async content => {
    const cwd = await temporary();
    if (content !== 'missing') await writeFile(join(cwd, 'target.yaml'), content);
    const result = await invoke(['plan', '--manifest', desktopManifest, '--target', 'target.yaml'], cwd);
    expect(result.code).toBe(2);
    expect(result.err).toContain('"status": "fail"');
  });

  it('rejects a missing custom registry', async () => {
    const cwd = await temporary();
    const result = await invoke(['plan', '--manifest', desktopManifest, '--target', desktopTarget, '--registry', 'missing'], cwd);
    expect(result.code).toBe(2);
    expect(result.err).toContain('HCB-PL-003');
  });

  it('shows version/help and rejects unknown commands', async () => {
    expect((await invoke(['--version'])).out).toContain('0.1.0');
    expect((await invoke(['--help'])).code).toBe(0);
    expect((await invoke(['unknown-command'])).code).toBe(2);
  });

  it('runs the built command from a path containing spaces', async () => {
    const cwd = await temporary();
    const output = execFileSync(process.execPath, [join(root, 'packages/hcb-cli/dist/index.js'), 'init', 'space directory', '--api', '24'], { cwd, encoding: 'utf8' });
    expect(JSON.parse(output)).toMatchObject({ status: 'initialized' });
    expect(await readdir(join(cwd, 'space directory'))).toEqual(['hcb.feature.yaml', 'hcb.target.yaml']);
  });
});
