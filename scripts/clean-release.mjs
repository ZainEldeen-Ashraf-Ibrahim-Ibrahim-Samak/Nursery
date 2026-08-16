/**
 * Removes the previous `release/` output before electron-builder writes a new one.
 *
 * electron-builder unlinks the old `app.asar` in place, so anything holding a handle on it fails
 * the whole build with `EBUSY: resource busy or locked`. On Windows the usual culprits are an
 * editor/IDE whose file indexer walked into `release/win-unpacked`, an antivirus real-time scan
 * of the freshly written archive, or a still-running instance of the packaged app.
 *
 * `fs.rmSync` retries internally on EBUSY/EPERM, which clears the short-lived scanner case. A
 * handle held by a long-running process (an IDE) survives the retries — so report which file is
 * stuck and exit non-zero rather than letting electron-builder fail later with a stack trace that
 * doesn't name the cause.
 */
import { rmSync, existsSync } from 'node:fs'

const target = new URL('../release/', import.meta.url)

if (!existsSync(target)) {
  console.log('clean-release: nothing to remove')
  process.exit(0)
}

try {
  rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  console.log('clean-release: removed previous release/ output')
} catch (error) {
  console.error(`\nclean-release: could not remove release/ — ${error.code ?? ''} ${error.message}`)
  console.error(
    '\nA process is holding a file in release/. Close the app if it is running, or exclude\n' +
    'release/ from your editor\'s file indexer and antivirus real-time scanning, then retry.\n' +
    'To find the holder:  Get-Process | Where-Object { $_.Modules.FileName -like "*release*" }\n'
  )
  process.exit(1)
}
