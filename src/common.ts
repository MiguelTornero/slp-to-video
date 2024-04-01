import { mkdtempSync, existsSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { isAbsolute, join } from "node:path"
import { Writable } from "node:stream"

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

export interface ProcessFactory {
    spawnProcess() : ExternalProcess
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

export function createLoadingMessagePrinter(message: string, outputStream: Writable = process.stdout, intervalMs = 1000, loopingChar = ".", loopingCharMax = 3) {
    let timer  : NodeJS.Timeout | null = null
    let charCount = loopingCharMax
    
    return {
        start() {
            if (timer !== null) {
                return
            }
            outputStream.write(message + loopingChar.repeat(charCount))
            timer = setInterval(() => {
                charCount = (charCount % loopingCharMax) + 1
                outputStream.write("\r" + message + loopingChar.repeat(charCount) + " ".repeat(loopingCharMax - charCount))
            }, intervalMs)
        },
        stop() {
            if (timer === null) {
                return false
            }
            clearInterval(timer)
            timer = null
            outputStream.write("\n")
            return true
        }

    }
}

export function parseTimeStamp(timestamp: string) {
    const match = timestamp.match(/^(\d+:)?(\d+:)?\d+(\.\d+)?$/)
    if (match === null) {
        return null
    }

    const output = {
        hours: 0,
        minutes: 0,
        seconds: 0.0
    }

    const slices = timestamp.split(":")

    const secondsStr = slices.pop()
    const minutesStr = slices.pop()
    const hoursStr = slices.pop()

    if (secondsStr) {
        output.seconds = parseFloat(secondsStr)
    }
    if (minutesStr) {
        output.minutes = parseInt(minutesStr)
    }
    if (hoursStr) {
        output.hours = parseInt(hoursStr)
    }

    return output
}

export function msToTimestamp(ms: number, secondsPrecision = 3) {
    let seconds = ms / 1000
    
    const output : string[] = []
    
    const hours = Math.trunc(seconds / 3600)
    seconds %= 3600
    if (hours > 0) {
        output.push(hours.toFixed(0))
    }

    const minutes = Math.trunc(seconds / 60)
    seconds %= 60
    output.push(minutes.toFixed(0).padStart(2, "0"))

    output.push(seconds.toFixed(secondsPrecision).padStart(secondsPrecision + 3, "0"))

    return output.join(":")
}

export const FRAMES_PER_SECOND = 60 as const

export const ASSET_DIR = join(__dirname, "..", "assets")