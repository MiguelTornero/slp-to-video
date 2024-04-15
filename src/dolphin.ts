import { EventEmitter } from "node:events";
import { ExternalProcess, ProcessEventEmmiter, ProcessFactory, ASSET_DIR } from "./common";
import { join } from "node:path";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { Writable } from "node:stream";
import { SlippiGame, Frames } from "@slippi/slippi-js";
import { parse, stringify } from "ini";

type ValidInternalResultionMultiplier = 1 | 1.5 | 2 | 2.5 | 3 | 4 | 5 | 6 | 7 | 8
export type ValidInternalResolution = `${ValidInternalResultionMultiplier}x` | "720p" | "1080p"  | "WQHD" | "4K" | "auto"

type JSONInputFileCommon = {
    replay?: string,
    mode?: "normal" | "queue" | "mirror"
    startFrame?: number,
    endFrame?: number,
    commandId?: string,
    outputOverlayFiles?: boolean,
    isRealTimeMode?: boolean,
    shouldResync?: boolean,
    rollbackDisplayMethod?: "off" | "normal" | "visible",
    gameStation?: string,
    queue?: JSONQueueItem[]
}

type JSONInputFileNormal = JSONInputFileCommon & {
    replay: string,
    mode?: "normal"
}

type JSONInputFileQueue = JSONInputFileCommon & {
    mode: "queue",
    queue: JSONQueueItem[]
}

type JSONInputFile = JSONInputFileNormal | JSONInputFileQueue

type JSONQueueItem = {
    path: string,
    startFrame?: number,
    endFrame?: number,
    gameStartAt?: string,
    gameStation?: string
}

/**
 * Utility class for creating dolphin processes
 */
export class DolphinProcessFactory implements ProcessFactory {
    static dolphinIniFilename = "Dolphin.ini"
    static gfxIniFilename = "GFX.ini"
    static geckoFilename = "GALE01.ini"

    static audioDumpFilename = "dspdump.wav"
    static videoDumpFilename = "framedump0.avi"
    static outputAviFilename = "output.avi"
    
    // used to get the EFBScale option for the INI file, might break in the future
    static internalResToEfbScale : Record<ValidInternalResolution, number> = {
        "auto": 0,
        "1x": 2,
        "1.5x": 3,
        "2x": 4,
        "720p": 4,
        "2.5x": 5,
        "3x": 6,
        "1080p": 6,
        "4x": 7,
        "WQHD": 7,
        "5x": 8,
        "6x": 9,
        "4K": 9,
        "7x": 10,
        "8x": 11
    }

    static defaultEfbScale = 4

    static isValidInternalResolution(key: string) : key is keyof typeof DolphinProcessFactory.internalResToEfbScale {
        return Object.keys(DolphinProcessFactory.internalResToEfbScale).includes(key)
    }

    dolphinPath: string
    enableWidescreen : boolean
    workDir: string
    userDir: string
    slpInputFile: string
    meleeIso: string
    timeout?: number
    inputJsonPath: string
    bitrate: number
    efbScale: number
    stdout?: Writable
    stderr?: Writable

    dumpAudioFile: string
    dumpVideoFile: string

    endFrame?: number
    startFrame?: number

    // used for reporting progress
    progressStart: number
    progressEnd?: number

    constructor({dolphinPath, slpInputFile, workDir, meleeIso, timeout, enableWidescreen, stdout, stderr, startFrame, endFrame, bitrate, internalResolution}: {dolphinPath: string, slpInputFile: string, workDir: string, meleeIso: string, timeout?: number, enableWidescreen: boolean, stdout?: Writable, stderr?: Writable, startFrame?: number, endFrame?: number, bitrate: number, internalResolution: ValidInternalResolution}) {
        this.dolphinPath = dolphinPath
        this.enableWidescreen = enableWidescreen
        this.workDir = workDir
        this.slpInputFile = slpInputFile
        this.meleeIso = meleeIso
        this.timeout = timeout
        this.bitrate = bitrate
        this.stdout = stdout
        this.stderr = stderr

        const efbScale = DolphinProcessFactory.internalResToEfbScale[internalResolution] as number | undefined // this is for handling arbritary strings, which could happen when used by a third party program
        if (efbScale !== undefined) {
            this.efbScale = efbScale
        }   
        else {
            this.efbScale = DolphinProcessFactory.defaultEfbScale
        }

        this.userDir = join(workDir, "User")
        this.inputJsonPath = join(workDir, "input.json")
        this.dumpAudioFile = join(workDir, DolphinProcessFactory.audioDumpFilename)
        this.dumpVideoFile = join(workDir, DolphinProcessFactory.videoDumpFilename)

        this.startFrame = startFrame
        this.endFrame = endFrame

        if (startFrame !== undefined) {
            this.progressStart = startFrame
        }
        else {
            this.progressStart = Frames.FIRST
        }

        if (endFrame !== undefined) {
            this.progressEnd = endFrame + 1
        }
        else {
            const lastFrame = (new SlippiGame(slpInputFile)).getMetadata()?.lastFrame
            if (lastFrame !== null) {
                this.progressEnd = lastFrame
            }
        }

    }

    prepareWorkDir() {
        const userConfigDir = join(this.userDir, "Config")

        mkdirSync(this.workDir, {recursive: true}) // "recursive: true" makes it so it doesn't throw an error if the dir exists

        mkdirSync(userConfigDir, {recursive: true})
        const dolphinIniPath = join(userConfigDir, DolphinProcessFactory.dolphinIniFilename)
        const assetDolphinPath = join(ASSET_DIR, DolphinProcessFactory.dolphinIniFilename)
        const gfxIniPath = join(userConfigDir, DolphinProcessFactory.gfxIniFilename)
        const assetGfxIniPath = join(ASSET_DIR, DolphinProcessFactory.gfxIniFilename)

        copyFileSync(assetDolphinPath, dolphinIniPath)

        const gfxIniStr = readFileSync(assetGfxIniPath).toString()
        const gfxIniObj = parse(gfxIniStr)
        
        gfxIniObj["Settings"]["BitrateKbps"] = this.bitrate.toFixed(0)
        gfxIniObj["Settings"]["EFBScale"] = this.efbScale.toFixed(0)

        writeFileSync(gfxIniPath, stringify(gfxIniObj, {platform: "win32"}))
        
        if (this.enableWidescreen) {
            const userGameSettingsDir = join(this.userDir, "GameSettings")
    
            mkdirSync(userGameSettingsDir, {recursive: true})
            copyFileSync(join(ASSET_DIR, DolphinProcessFactory.geckoFilename), join(userGameSettingsDir, DolphinProcessFactory.geckoFilename))
        }

        const inputJsonData : JSONInputFile = {
            mode: "queue",
            queue: [
                {
                    path: this.slpInputFile
                }
            ]
        }
        if (this.startFrame !== undefined) {
            inputJsonData.queue[0].startFrame = this.startFrame
        }
        if (this.endFrame !== undefined) {
            inputJsonData.queue[0].endFrame = this.endFrame
        }
    
        writeFileSync(this.inputJsonPath, JSON.stringify(inputJsonData))
    }

    spawnProcess(): ExternalProcess {
        this.prepareWorkDir()

        const eventEmitter: ProcessEventEmmiter = new EventEmitter()

        const dolphinProcess = spawn(this.dolphinPath, [
            "-u", this.userDir,
            "--output-directory", this.workDir,
            "-i", this.inputJsonPath,
            "-e", this.meleeIso,
            "-b",
            "--cout",
            "--hide-seekbar"
        ], {timeout: this.timeout, cwd: this.workDir})
        
        if (this.stdout) {
            dolphinProcess.stdout.pipe(this.stdout)
        }
        if (this.stderr) {
            dolphinProcess.stderr.pipe(this.stderr)
        }

        dolphinProcess.stdout.on("data", (msg) => {
            if (!(msg instanceof Buffer)) { return }

            const msgStr = msg.toString()

            // Kill dolphin process after the game finishes
            if (msgStr.startsWith("[NO_GAME]")) {
                dolphinProcess.kill()
                return
            }

            const match = msgStr.match(/\[CURRENT_FRAME\]\s+(-?\d+)/)
            if (match) {
                const frame = parseInt(match[1])
                eventEmitter.emit("progress", frame, this.progressStart, this.progressEnd)
            }
        })

        return {
            onExit(callback) {
                dolphinProcess.on("exit", callback)
            },
            onProgress(callback) {
                eventEmitter.on("progress", callback)
            },
            kill(signal) {
                dolphinProcess.kill(signal)
            }
        }
    }
}