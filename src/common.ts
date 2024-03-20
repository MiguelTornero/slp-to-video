import { mkdtempSync, existsSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

export function getWorkDir(development = false, prefix = "slp-to-video-") {
    let _tempDir = ""
    if (development) {
        _tempDir = join(__dirname, "..", "tmp")
        if (!existsSync(_tempDir)) {
            mkdirSync(_tempDir)
        }
    }
    else {
        _tempDir = tmpdir()
    }

    return mkdtempSync(join(_tempDir, prefix))
}