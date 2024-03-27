import { mkdtempSync, existsSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { isAbsolute, join } from "node:path"
import { EventEmitter } from "node:events"

export interface ExternalProcess {
    onExit(callback: (code: number|null) => void): void
    onProgress(callback: (progress: number) => void): void
}

export interface ProcessEventEmmiter extends EventEmitter {
    on(event: "progress", listener: (progress: number) => void): this
    once(event: "progress", listener: (progress: number) => void): this
    emit(event: "progress", progress: number): boolean

    on(event: "done", listener: (code: number|null) => void): this
    once(event: "done", listener: (code: number|null) => void): this
    emit(event: "done", code: number|null): boolean
}

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
    const output : T = Object.assign({}, data)
    for (const key in output) {
        const val = partialData[key]
        if (val !== undefined && val !== null) {
            output[key] = val
        }
    }

    return output
}

export function toAbsolutePath(path: string, base: string) {
    if (isAbsolute(path)) {
        return path
    }
    return join(base, path)
}

export const assetDir = join(__dirname, "..", "assets")