import { fillUndefinedFields } from "./common"
import { join } from "path"
import { ChildProcessWithoutNullStreams, spawn } from "child_process"
import { accessSync, copyFileSync, mkdirSync, writeFileSync } from "fs"
import { EventEmitter } from "stream"
import { SlippiGame } from "@slippi/slippi-js"
import { mergeVideoAndAudio } from "./ffmpeg"

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
    queue?: QueueItem[]
}

type JSONInputFileNormal = JSONInputFileCommon & {
    replay: string,
    mode?: "normal"
}

type JSONInputFileQueue = JSONInputFileCommon & {
    mode: "queue",
    queue: QueueItem[]
}

type JSONInputFile = JSONInputFileNormal | JSONInputFileQueue

type QueueItem = {
    path: string,
    startFrame?: number,
    endFrame?: number,
    gameStartAt?: string,
    gameStation?: string
}

type ValidInternalResultionMultiplier = 1 | 1.5 | 2 | 2.5 | 3 | 4 | 5 | 6 | 7 | 8
type ValidInternalResolution = `${ValidInternalResultionMultiplier}x` | "720p" | "1080p"  | "WQHD" | "4K" | "auto"

type SlpToVideoArguments = {
    inputFile: string,
    workDir: string,
    meleeIso: string,
    dolphinPath: string,
    internalResolution: ValidInternalResolution,
    outputFilename: string,
    outputFormat: "avi" | "mp4",
    enableWidescreen: boolean,
    timeout: number
}

const TEN_MINUTES_TO_MS = 10 * 60 * 1000

export const DEFAULT_ARGUMENTS : Readonly<SlpToVideoArguments> = {
    inputFile: "input.slp",
    workDir: "tmp",
    meleeIso: "SSBM.iso",
    dolphinPath: "playback-slippi",
    internalResolution: "720p",
    outputFilename: "output.avi",
    outputFormat: "avi",
    enableWidescreen: false,
    timeout: TEN_MINUTES_TO_MS
}

declare interface ProcessEventEmmiter {
    on(event: "progress", listener: (progress: number) => void): this
    once(event: "progress", listener: (progress: number) => void): this
    emit(event: "progress", progress: number): boolean

    on(event: "done", listener: (code: number|null) => void): this
    once(event: "done", listener: (code: number|null) => void): this
    emit(event: "done", code: number|null): boolean
}

class ProcessEventEmmiter extends EventEmitter {
    constructor() {
        super()
    }
}

class SlpToVideoProcess {
    static dolphinIniFilename = "Dolphin.ini"
    static gfxIniFilename = "GFX.ini"
    static geckoFilename = "GALE01.ini"

    static audioDumpFilename = "dspdump.wav"
    static videoDumpFilename = "framedump0.avi"
    static outputAviFilename = "output.avi"
    
    static defaultSlpStartFrame = -123

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

    slippiGame : SlippiGame

    dolphinProcess: ChildProcessWithoutNullStreams
    dolphinEventEmitter: ProcessEventEmmiter

    constructor({ workDir, inputFile, dolphinPath, meleeIso, timeout, enableWidescreen, outputFilename }: SlpToVideoArguments) {

        this.slippiGame = new SlippiGame(inputFile)
        this.dolphinEventEmitter = new ProcessEventEmmiter()

        const userDir = join(workDir, "User")
        const userConfigDir = join(userDir, "Config")
        
        const assetDir = join(__dirname, "..", "assets")

        mkdirSync(workDir, {recursive: true}) // "recursive: true" makes it so it doesn't throw an error if the dir exists

        mkdirSync(userConfigDir, {recursive: true})
        copyFileSync(join(assetDir, SlpToVideoProcess.dolphinIniFilename), join(userConfigDir, SlpToVideoProcess.dolphinIniFilename))
        copyFileSync(join(assetDir, SlpToVideoProcess.gfxIniFilename), join(userConfigDir, SlpToVideoProcess.gfxIniFilename))

        if (enableWidescreen) {
            const userGameSettingsDir = join(userDir, "GameSettings")
    
            mkdirSync(userGameSettingsDir, {recursive: true})
            copyFileSync(join(assetDir, SlpToVideoProcess.geckoFilename), join(userGameSettingsDir, SlpToVideoProcess.geckoFilename))
        }

        const inputJsonData : JSONInputFile = {
            mode: "queue",
            queue: [
                {
                    path: inputFile
                }
            ]
        }
    
        const inputJsonFile = join(workDir, "input.json")
        writeFileSync(inputJsonFile, JSON.stringify(inputJsonData))

        this.dolphinProcess = spawn(dolphinPath, [
            "-u", userDir,
            "--output-directory", workDir,
            "-i", inputJsonFile,
            "-e", meleeIso,
            "-b",
            "--cout",
            "--hide-seekbar"
        ], {timeout: timeout})
        this.dolphinProcess.stdout.on("data", (msg: Buffer) => {
            const msgStr = msg.toString()
            if (msgStr.startsWith("[NO_GAME]")) {
                this.dolphinProcess.kill()
                return
            }

            const match = msgStr.match(/\[CURRENT_FRAME\]\s+(-?\d+)/)
            if (match) {
                const frame =  parseInt(match[1])
                this.dolphinEventEmitter.emit("progress", frame)
            }
        })
        this.dolphinProcess.on("exit", (code) => {
            this.dolphinEventEmitter.emit("done", code)
            
            if (code !== 0) {return}

            const dumpAvi = join(workDir, SlpToVideoProcess.videoDumpFilename)
            const dumpWav = join(workDir, SlpToVideoProcess.audioDumpFilename)
            const outputAvi = join(workDir, SlpToVideoProcess.outputAviFilename)

            accessSync(dumpAvi)
            accessSync(dumpWav)

            mergeVideoAndAudio(dumpAvi, dumpWav, outputAvi)

            let outputFile = outputFilename
            if (!outputFile.toLowerCase().endsWith(".avi")) {
                outputFile += ".avi"
            }

            copyFileSync(outputAvi, outputFile)
        })
    }

    getLastFrame() {
        const frame = this.slippiGame.getMetadata()?.lastFrame
        if (frame !== undefined && frame !== null) {
            return frame
        }

        return SlpToVideoProcess.defaultSlpStartFrame
    }

    getFirstFrame() {
        return SlpToVideoProcess.defaultSlpStartFrame
    }
}

export function createSlptoVideoProcess(opts: Partial<SlpToVideoArguments> = {}) {
    const args = fillUndefinedFields(opts, DEFAULT_ARGUMENTS)
    
    return new SlpToVideoProcess(args)
}