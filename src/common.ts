import { mkdtempSync, existsSync, mkdirSync, accessSync, constants } from "node:fs"
import { homedir, tmpdir, userInfo } from "node:os"
import { isAbsolute, join } from "node:path"
import { Writable } from "node:stream"
import { APPDATA, DOLPHIN_PATH, FFMPEG_PATH } from "./env"
import which = require("which")

const CWD = process.cwd()
const HOME = homedir()
const PLATFORM = process.platform

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

export function toAbsolutePath(path: string, base: string = CWD) {
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
            outputStream.write(message + loopingChar.repeat(loopingCharMax) + "\n")
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

export function checkFileExists(filepath: string, checkReadable = false, checkWritable = false, checkExecutable = false) {
    let permissions = constants.F_OK
    if (checkReadable) {
        permissions = permissions | constants.R_OK
    }
    if (checkWritable) {
        permissions = permissions | constants.W_OK
    }
    if (checkExecutable) {
        permissions = permissions | constants.X_OK
    }
    try {
        accessSync(filepath, permissions)
        return true
    }
    catch {
        return false
    }
}

export const FRAMES_PER_SECOND = 60 as const

export const ASSET_DIR = join(__dirname, "..", "assets")

export const ISHIIRUKA_DIR = join(__dirname, "..", "Ishiiruka")

export const ISHIIRUKA_BINARY_DIR = join(ISHIIRUKA_DIR, "build", "Binaries")

const DEFAULT_APPIMAGE_NAME = "Slippi_Playback-x86_64.AppImage"
const DEFAULT_LINUX_BIN_NAME = "dolphin-emu"
const DEFAULT_WIN_BIN_NAME = "Slippi Dolphin.exe"
const DEFAULT_MAC_BIN_NAME = "Slippi Dolphin.app"

const DEV_WIN_DOLPHIN_PATH = join(ISHIIRUKA_BINARY_DIR, DEFAULT_WIN_BIN_NAME)
const DEV_MAC_DOLPHIN_PATH = join(ISHIIRUKA_BINARY_DIR, DEFAULT_MAC_BIN_NAME)
const DEV_LINUX_DOLPHIN_PATH = join(ISHIIRUKA_BINARY_DIR, DEFAULT_LINUX_BIN_NAME)
const DEV_APPIMAGE_DOLPHIN_PATH = join(ISHIIRUKA_DIR, DEFAULT_APPIMAGE_NAME)

export function getDevDolphinBinary(platform: NodeJS.Platform) {
    switch (platform) {
        case "win32":
            if (checkFileExists(DEV_WIN_DOLPHIN_PATH, true, true)) {
                return DEV_WIN_DOLPHIN_PATH
            }
            return null
        case "darwin":
            if (checkFileExists(DEV_MAC_DOLPHIN_PATH, true, true)) {
                return DEV_MAC_DOLPHIN_PATH
            }
            return null
        default:
            if (checkFileExists(DEV_APPIMAGE_DOLPHIN_PATH, true, true)) {
                // checking for appimage first
                return DEV_APPIMAGE_DOLPHIN_PATH
            }
            if (checkFileExists(DEV_LINUX_DOLPHIN_PATH, true, true)) {
                return DEV_LINUX_DOLPHIN_PATH
            }
            return null
    }
}

const SLIPPI_APP_NAME = "Slippi Launcher"
const PLAYBACK_SUBDIR = "playback"
const WIN_SLIPPI_BASE = APPDATA ? join(APPDATA, SLIPPI_APP_NAME, PLAYBACK_SUBDIR) : join("C:\\", "Users", userInfo().username, "AppData", "Roaming", SLIPPI_APP_NAME, PLAYBACK_SUBDIR)
const MAC_SLIPPI_BASE = join(HOME, "Library", "Application Support", SLIPPI_APP_NAME, PLAYBACK_SUBDIR)
const LINUX_SLIPPI_BASE = join(HOME, ".config", SLIPPI_APP_NAME, PLAYBACK_SUBDIR)

const WIN_SLIPPI_PLAYBACK_PATH = join(WIN_SLIPPI_BASE, DEFAULT_WIN_BIN_NAME)
const MAC_SLIPPI_PLAYBACK_PATH = join(MAC_SLIPPI_BASE, DEFAULT_MAC_BIN_NAME)
const LINUX_SLIPPI_PLAYBACK_PATH = join(LINUX_SLIPPI_BASE, DEFAULT_APPIMAGE_NAME)
export function getLocalSlippiBinary(platform: NodeJS.Platform) {
    switch (platform) {
        case "win32":
            if (checkFileExists(WIN_SLIPPI_PLAYBACK_PATH, true, true)) {
                return WIN_SLIPPI_PLAYBACK_PATH
            }
            return null
        case "darwin":
            if (checkFileExists(MAC_SLIPPI_PLAYBACK_PATH, true, true)) {
                return MAC_SLIPPI_PLAYBACK_PATH     
            }
            return null
        default:
            if (checkFileExists(LINUX_SLIPPI_PLAYBACK_PATH, true, true)) {
                return LINUX_SLIPPI_PLAYBACK_PATH
            }
            return null
    }
}

const WIN_BUNDLED_BIN = join(ASSET_DIR, DEFAULT_WIN_BIN_NAME)
const MAC_BUNDLED_BIN = join(ASSET_DIR, DEFAULT_MAC_BIN_NAME)
const LINUX_BUNDLED_BIN = join(ASSET_DIR, DEFAULT_APPIMAGE_NAME)
export function getBundledDolphinBinary(platform: NodeJS.Platform) {
    switch (platform) {
        case "win32":
            if (checkFileExists(WIN_BUNDLED_BIN, true, true)) {
                return WIN_BUNDLED_BIN
            }
            return null
        case "darwin":
            if (checkFileExists(MAC_BUNDLED_BIN, true, true)) {
                return MAC_BUNDLED_BIN
            }
            return null
        default:
            if (checkFileExists(LINUX_BUNDLED_BIN, true, true)) {
                return LINUX_BUNDLED_BIN
            }
            return null
    }
}

export function getDolphinPath(development = false, platform: NodeJS.Platform = PLATFORM) {
    // checking env first
    if (DOLPHIN_PATH) {
        return DOLPHIN_PATH
    }
    
    let dolphinPath
    if (development) { // skip this check if not in development
        dolphinPath = getDevDolphinBinary(platform)
        if (dolphinPath) {
            return dolphinPath
        }
    }

    dolphinPath = getBundledDolphinBinary(platform)
    if (dolphinPath) {
        return dolphinPath
    }

    // fallback to local slippi
    dolphinPath = getLocalSlippiBinary(platform)
    if (dolphinPath) {
        return dolphinPath
    }

    // checking PATH as last resort
    return which.sync("slippi-playback", {nothrow: true})
}

export function getFfmpegPath(platform = PLATFORM) {
    // checking env first
    if (FFMPEG_PATH) {
        return FFMPEG_PATH
    }
    
    let ffmpeg = "ffmpeg"
    if (platform === "win32") {
        ffmpeg += ".exe"
    }

    // checking if bundled
    let ffmpegPath = join(ASSET_DIR, ffmpeg)
    if (checkFileExists(ffmpegPath, true, true)) {
        return ffmpegPath
    }

    // checking PATH
    return which.sync(ffmpeg, {nothrow: true})
}