/**
 * Builds the web components into `admin/webcomponents/` - from the root of the adapter: `npm run build:wc`.
 *
 * 1. empties `admin/webcomponents/` and `src-webcomponents/build/`
 * 2. installs the packages of `src-webcomponents/package.json`
 * 3. `npm run build`: one `vite build` per component (see `vite.config.ts`), which also writes the manifests and
 *    fails if one does not pass `checkManifest()`
 * 4. copies the modules, manifests and icons to `admin/webcomponents/` (committed)
 * 5. writes the short form of the manifests into `common.webComponents` of `io-package.json`
 *    (`iob-web-components sync-io-package`), so a host can list the components from the repository alone
 */
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const build = join(here, 'build');
const target = join(root, 'admin', 'webcomponents');

function run(command, cwd) {
    execSync(command, { cwd, stdio: 'inherit' });
}

try {
    rmSync(target, { recursive: true, force: true });
    rmSync(build, { recursive: true, force: true });

    run('npm install --no-audit --no-fund', here);
    run('npm run build', here);

    mkdirSync(target, { recursive: true });
    const files = readdirSync(build).filter(file => /\.(js|json|svg)$/.test(file));
    for (const file of files) {
        copyFileSync(join(build, file), join(target, file));
    }
    console.log(`admin/webcomponents: ${files.join(', ')}`);

    const cli = join(here, 'node_modules', '@iobroker', 'web-components', 'build', 'bin.js');
    run(`node "${cli}" sync-io-package "${root}"`, here);
} catch (e) {
    console.error(`Cannot build the web components: ${e.message}`);
    process.exit(2);
}
