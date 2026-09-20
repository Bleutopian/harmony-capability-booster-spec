import { mkdir, lstat, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Command, CommanderError } from 'commander';
import { parseDocument, stringify } from 'yaml';
import { loadManifest, validateManifest } from '@hcb/manifest';
import type { Diagnostic, FeatureManifest } from '@hcb/manifest';
import { loadRegistry, validateTargetProfile } from '@hcb/registry';
import type { CapabilityRegistry, TargetProfile } from '@hcb/registry';
import { createPlan } from '@hcb/planner';
import { generateArtifacts, previewArtifacts } from '@hcb/generator';
import { validateProject } from '@hcb/validator';

export interface CliEnvironment {
  cwd?: string;
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
}

interface InputOptions {
  manifest: string;
  target: string;
  registry?: string;
  project?: string;
  dryRun?: boolean;
}

interface InitOptions {
  appId: string;
  platform: string;
  sourceArch: string;
  sourceAvailability: string;
  device: string;
  api: string;
}

class CliFailure extends Error {
  constructor(readonly diagnostics: Diagnostic[]) {
    super('HCB input validation failed.');
  }
}

function fail(code: string, path: string, message: string): never {
  throw new CliFailure([{ code, path, message }]);
}

async function readTarget(filePath: string): Promise<TargetProfile> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch {
    fail('HCB-PL-001', 'target', 'Cannot read the target profile.');
  }
  let input: unknown;
  try {
    const document = parseDocument(content, { uniqueKeys: true });
    if (document.errors.length) fail('HCB-PL-002', 'target', 'Target profile is not valid YAML or JSON.');
    input = document.toJS({ maxAliasCount: 20 });
  } catch {
    fail('HCB-PL-002', 'target', 'Target profile is not valid YAML or JSON.');
  }
  const result = validateTargetProfile(input);
  if (!result.valid) throw new CliFailure(result.diagnostics);
  return result.value;
}

async function readInputs(options: InputOptions, cwd: string): Promise<{
  manifest: FeatureManifest; target: TargetProfile; registry: CapabilityRegistry;
}> {
  const manifest = await loadManifest(resolve(cwd, options.manifest));
  if (!manifest.valid) throw new CliFailure(manifest.diagnostics);
  const target = await readTarget(resolve(cwd, options.target));
  let registry: CapabilityRegistry;
  try {
    registry = await loadRegistry(options.registry ? resolve(cwd, options.registry) : undefined);
  } catch {
    fail('HCB-PL-003', 'registry', 'Capability registry is missing or invalid.');
  }
  return { manifest: manifest.value, target, registry };
}

async function assertAbsent(path: string): Promise<void> {
  try {
    await lstat(path);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
    fail('HCB-CLI-001', 'init', 'Cannot inspect the initialization destination.');
  }
  fail('HCB-CLI-002', 'init', 'Initialization refuses to overwrite an existing manifest or target profile.');
}

export async function runCli(argv: string[], environment: CliEnvironment = {}): Promise<number> {
  const cwd = environment.cwd ?? process.cwd();
  const stdout = environment.stdout ?? (text => process.stdout.write(text));
  const stderr = environment.stderr ?? (text => process.stderr.write(text));
  const emit = (value: unknown): void => { stdout(`${JSON.stringify(value, null, 2)}\n`); };
  let exitCode = 0;
  const program = new Command()
    .name('hcb')
    .description('Plan HarmonyOS enhancements for existing business features.')
    .version('0.1.0')
    .exitOverride()
    .configureOutput({ writeOut: stdout, writeErr: stderr });

  program.command('init')
    .argument('[directory]', 'Destination directory', '.')
    .option('--app-id <id>', 'Existing application identifier', 'com.example.application')
    .option('--platform <platform>', 'Source platform', 'android')
    .option('--source-arch <architecture>', 'Source CPU architecture', 'unknown')
    .option('--source-availability <availability>', 'source or binary_only', 'source')
    .option('--device <device>', 'HarmonyOS target device: phone, tablet or pc', 'phone')
    .requiredOption('--api <level>', 'Explicit HarmonyOS target API level')
    .action(async (directory: string, options: InitOptions) => {
      const manifest = validateManifest({
        schemaVersion: '0.1',
        application: {
          id: options.appId, sourcePlatforms: [options.platform],
          sourceArchitectures: [options.sourceArch], sourceAvailability: options.sourceAvailability
        },
        features: []
      });
      const target = validateTargetProfile({ devices: [options.device], apiVersion: Number(options.api), stageModel: true });
      if (!manifest.valid) throw new CliFailure(manifest.diagnostics);
      if (!target.valid) throw new CliFailure(target.diagnostics);
      const destination = resolve(cwd, directory);
      const manifestPath = resolve(destination, 'hcb.feature.yaml');
      const targetPath = resolve(destination, 'hcb.target.yaml');
      await assertAbsent(manifestPath);
      await assertAbsent(targetPath);
      await mkdir(destination, { recursive: true });
      await writeFile(manifestPath, stringify(manifest.value), { flag: 'wx' });
      try {
        await writeFile(targetPath, stringify(target.value), { flag: 'wx' });
      } catch (error) {
        await unlink(manifestPath);
        throw error;
      }
      emit({ status: 'initialized', files: ['hcb.feature.yaml', 'hcb.target.yaml'], features: 0 });
    });

  program.command('manifest').description('Validate existing feature contracts')
    .command('validate')
    .argument('[file]', 'YAML or JSON manifest', 'hcb.feature.yaml')
    .action(async (file: string) => {
      const result = await loadManifest(resolve(cwd, file));
      emit({ status: result.valid ? 'pass' : 'fail', diagnostics: result.diagnostics,
        ...(result.valid ? { applicationId: result.value.application.id, features: result.value.features.length } : {}) });
      exitCode = result.valid ? 0 : 1;
    });

  const withInputs = (command: Command): Command => command
    .option('--manifest <file>', 'Feature manifest', 'hcb.feature.yaml')
    .option('--target <file>', 'Target profile', 'hcb.target.yaml')
    .option('--registry <directory>', 'Capability registry directory');

  withInputs(program.command('plan').description('Explain enhancement decisions'))
    .action(async (options: InputOptions) => {
      const { manifest, target, registry } = await readInputs(options, cwd);
      const plan = createPlan(manifest, target, registry);
      emit(plan);
      exitCode = plan.items.some(item => item.decision === 'reject') ? 1 : 0;
    });

  withInputs(program.command('apply').description('Preview HCB-owned review artifacts'))
    .option('--dry-run', 'Show changes without writing files')
    .option('--project <directory>', 'Existing project destination', '.')
    .action(async (options: InputOptions) => {
      if (!options.dryRun) {
        fail('HCB-GN-007', 'apply', 'Only apply --dry-run is available. Platform adapters and host mutation are not implemented.');
      }
      const { manifest, target, registry } = await readInputs(options, cwd);
      const plan = createPlan(manifest, target, registry);
      const preview = await previewArtifacts(generateArtifacts(manifest, plan), resolve(cwd, options.project ?? '.'));
      emit(preview);
      exitCode = preview.diagnostics.length > 0 || plan.items.some(item => item.decision === 'reject') ? 1 : 0;
    });

  withInputs(program.command('validate').description('Check static integration readiness'))
    .option('--project <directory>', 'Inspect an existing HarmonyOS Stage host')
    .action(async (options: InputOptions) => {
      const { manifest, target, registry } = await readInputs(options, cwd);
      const report = await validateProject(manifest, target, registry, options.project ? resolve(cwd, options.project) : undefined);
      emit(report);
      exitCode = report.status === 'fail' ? 1 : 0;
    });

  try {
    await program.parseAsync(argv, { from: 'user' });
    return exitCode;
  } catch (error) {
    if (error instanceof CommanderError) return error.exitCode === 0 ? 0 : 2;
    const diagnostics = error instanceof CliFailure ? error.diagnostics : [{
      code: 'HCB-CLI-003', path: '', message: 'Operation failed. Check input files, directory permissions and workspace installation.'
    }];
    stderr(`${JSON.stringify({ status: 'fail', diagnostics }, null, 2)}\n`);
    return 2;
  }
}
