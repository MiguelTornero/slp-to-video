import { fillUndefinedFields } from "./common"
import { join } from "path"
import { ChildProcessWithoutNullStreams, spawn } from "child_process"
import { mkdirSync, writeFileSync } from "fs"

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

const TEN_MINUTES_MS = 10 * 60 * 1000

const DEFAULT_ARGUMENTS : SlpToVideoArguments = {
    inputFile: "input.slp",
    workDir: ".",
    meleeIso: "SSBM.iso",
    dolphinPath: "playback-slippi",
    internalResolution: "720p",
    outputFilename: "output.avi",
    outputFormat: "avi",
    enableWidescreen: false,
    timeout: TEN_MINUTES_MS
}

class SlpToVideoProcess {
    dolphinProcess: ChildProcessWithoutNullStreams

    constructor(dolphinProcess: ChildProcessWithoutNullStreams) {
        this.dolphinProcess = dolphinProcess
    }
}

// used to get the EFBScale option for the INI file, might break in the future
const MAP_INTERNAL_RES_TO_EFB_SCALE : Record<ValidInternalResolution, number> = {
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


// TODO: refactor into a factory for a Process object
export function createSlptoVideoProcess(opts: Partial<SlpToVideoArguments> = {}) {
    const { workDir, inputFile, dolphinPath, meleeIso, timeout } = fillUndefinedFields(opts, DEFAULT_ARGUMENTS)

    const userDir = join(workDir, "User")
    const userConfigDir = join(userDir, "Config")
    const userGameSettingsDir = join(userDir, "GameSettings")
    
    mkdirSync(userConfigDir, {recursive: true}) 
    mkdirSync(userGameSettingsDir, {recursive: true}) // "recursive: true" makes it so it doesn't throw an error if dir already exists

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

    const playbackProcess = spawn(dolphinPath, [
        "-u", userDir,
        "-i", inputJsonFile,
        "-e", meleeIso,
        "-b",
        "--cout",
        "--hide-seekbar"
    ], {timeout: timeout})
    playbackProcess.stdout.on("data", (msg: Buffer) => {
        if (msg.toString().startsWith("[NO_GAME]")) {
            playbackProcess.kill("SIGINT")
        }
    })
    
    return new SlpToVideoProcess(playbackProcess)
}