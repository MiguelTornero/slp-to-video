import { ProcessEventEmmiter, fillUndefinedFields, ProgressCallback } from "./common"
import { EventEmitter, Writable } from "stream"
import { DolphinProcessFactory, ValidInternalResolution } from "./dolphin"
import { AudioVideoMergeProcessFactory } from "./ffmpeg"

type SlpToVideoArguments = {
    inputFile: string,
    workDir: string,
    meleeIso: string,
    dolphinPath: string,
    internalResolution: ValidInternalResolution,
    outputFilename: string,
    outputFormat: "avi" | "mp4",
    enableWidescreen: boolean,
    timeout: number,
    stdout?: Writable,
    stderr?: Writable
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
    timeout: TEN_MINUTES_TO_MS,
    stderr: undefined,
    stdout: undefined
}

export function createSlptoVideoProcess(opts: Partial<SlpToVideoArguments> = {}) {
    const { workDir, inputFile, dolphinPath, meleeIso, timeout, enableWidescreen, outputFilename, stdout, stderr } = fillUndefinedFields(opts, DEFAULT_ARGUMENTS)

    const overallEventEmitter : ProcessEventEmmiter = new EventEmitter() // used for the overall process
    const ffmpegEventEmitter : ProcessEventEmmiter = new EventEmitter()

    const dolphinFactory = new DolphinProcessFactory({dolphinPath, slpInputFile: inputFile, workDir, meleeIso, timeout, enableWidescreen, stdout, stderr})
    const dolphinProcess = dolphinFactory.spawnProcess()

    const ffmpegFactory = new AudioVideoMergeProcessFactory({videoFile: dolphinFactory.dumpVideoFile, audioFile: dolphinFactory.dumpAudioFile, outputFile: outputFilename, stdout, stderr})

    dolphinProcess.onExit((code) => {
        if (code !== 0) {
            overallEventEmitter.emit("done", null)
            return
        }

        const ffmpegProcess = ffmpegFactory.spawnProcess()
        ffmpegProcess.onExit((code) => {
            ffmpegEventEmitter.emit("done", code)
            overallEventEmitter.emit("done", code)
        }) 
    })

    return {
        onDolphinProgress(callback: ProgressCallback) {
            dolphinProcess.onProgress(callback)
        },
        onDolphinExit(callback: (code: number | null) => void) {
            dolphinProcess.onExit(callback)
        },
        onFfmpegProgress(callback: ProgressCallback) {
            ffmpegEventEmitter.on("progress", callback)
        },
        onFfmpegDone(callback: (code: number | null) => void) {
            ffmpegEventEmitter.on("done", callback)
        },
        onDone(callback: (code: number|null) => void) {
            overallEventEmitter.on("done", callback)
        },
        startFrame: dolphinFactory.startFrame,
        endFrame: dolphinFactory.endFrame
    }
}