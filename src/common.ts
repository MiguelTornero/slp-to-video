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

export function fillUndefinedFields<T extends Record<string, any>>(partialData: Partial<T>, data: T) : T {
    const output = Object.assign({}, data)
    for (const key in output) {
        const val = partialData[key]
        if (val !== undefined) {
            output[key] = val
        }
    }

    return output
}