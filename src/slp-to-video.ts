import { ProcessEventEmmiter, fillUndefinedFields, ProgressCallback, FRAMES_PER_SECOND, getDolphinPath } from "./common"
import { EventEmitter, Writable } from "stream"
import { DolphinProcessFactory, ValidInternalResolution } from "./dolphin"
import { AudioVideoMergeProcessFactory } from "./ffmpeg"
import { Frames } from "@slippi/slippi-js"

type SlpToVideoArguments = {
    inputFile: string,
    workDir: string,
    meleeIso: string,
    dolphinPath: string,
    internalResolution: ValidInternalResolution,
    outputFilename: string,
    enableWidescreen: boolean,
    ffmpegPath: string,
    timeout: number,
    stdout?: Writable,
    stderr?: Writable,
    startFrame?: number,
    endFrame?: number,
    startPaddingFrames: number,
    volume: number
}

const FIFTEEN_MINUTES_TO_MS = 15 * 60 * 1000

export const DEFAULT_ARGUMENTS : Readonly<SlpToVideoArguments> = {
    inputFile: "input.slp",
    workDir: "tmp",
    meleeIso: "SSBM.iso",
    dolphinPath: "slippi-playback",
    ffmpegPath: "ffmpeg",
    internalResolution: "720p",
    outputFilename: "output.avi",
    enableWidescreen: false,
    timeout: FIFTEEN_MINUTES_TO_MS,
    stderr: undefined,
    stdout: undefined,
    startFrame: undefined,
    endFrame: undefined,
    startPaddingFrames: 120,
    volume: 0.25
}

export function createSlptoVideoProcess(opts: Partial<SlpToVideoArguments> = {}) {
    if (opts.dolphinPath === undefined) {
        const dolphinPath = getDolphinPath(false)
        if (dolphinPath !== null) {
            opts.dolphinPath = dolphinPath
        }
    }
    if (opts.ffmpegPath === undefined) {
        const ffmpegPath = getDolphinPath(false)
        if (ffmpegPath !== null) {
            opts.ffmpegPath = ffmpegPath
        }
    }

    const { ffmpegPath, workDir, inputFile, dolphinPath, meleeIso, timeout, enableWidescreen, outputFilename, stdout, stderr, startFrame, endFrame, startPaddingFrames, volume } = fillUndefinedFields(opts, DEFAULT_ARGUMENTS)

    let _startFrame : number | undefined = undefined, startCutoffSeconds : number | undefined = undefined
    if (startFrame !== undefined) {
        _startFrame = Math.max(Frames.FIRST, startFrame - startPaddingFrames)
        startCutoffSeconds = (startFrame - _startFrame) / FRAMES_PER_SECOND
    }

    const overallEventEmitter : ProcessEventEmmiter = new EventEmitter() // used for the overall process
    const ffmpegEventEmitter : ProcessEventEmmiter = new EventEmitter()

    const dolphinFactory = new DolphinProcessFactory({dolphinPath, slpInputFile: inputFile, workDir, meleeIso, timeout, enableWidescreen, stdout, stderr, startFrame: _startFrame, endFrame})
    const dolphinProcess = dolphinFactory.spawnProcess()

    const ffmpegFactory = new AudioVideoMergeProcessFactory({ffmpegPath, videoFile: dolphinFactory.dumpVideoFile, audioFile: dolphinFactory.dumpAudioFile, outputFile: outputFilename, stdout, stderr, startCutoffSeconds, volume})

    dolphinProcess.onExit((code) => {
        if (code !== 0) {
            overallEventEmitter.emit("done", null)
            return
        }

        const ffmpegProcess = ffmpegFactory.spawnProcess()
        ffmpegProcess.onProgress((progress, start, end) => ffmpegEventEmitter.emit("progress", progress, start, end))
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