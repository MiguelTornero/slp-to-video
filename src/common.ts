import { mkdtempSync, existsSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { isAbsolute, join } from "node:path"
import { EventEmitter } from "node:events"

export type ProgressCallback = (progress: number, start: number, end?: number) => void

export interface ExternalProcess {
    onExit(callback: (code: number|null) => void): void
    onProgress(callback: ProgressCallback): void
}

export interface ProcessEventEmmiter {
    on(event: "progress", listener: ProgressCallback): this
    once(event: "progress", listener: ProgressCallback): this
    emit(event: "progress", ...args: Parameters<ProgressCallback>): boolean

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