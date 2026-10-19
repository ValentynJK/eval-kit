import 'dotenv/config';
import { runCommand } from './run';
import { startUi } from '../ui/server';

const USAGE =
  'Usage: eval-kit <command>\n' +
  '  run <track> [--case id]   run and grade a track, write a run file\n' +
  '  ui                        serve the run viewer';

// the kit's single entry -- becomes the package bin, so hosts call eval-kit, not a path into the kit
async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);

  if (command === 'run') return runCommand(args);
  if (command === 'ui') {
    startUi();
    return 0;
  }
  throw new Error(USAGE);
}

main()
  .then(code => {
    process.exitCode = code;
  })
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
