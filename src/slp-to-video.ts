/**
 * This file contains the logic that coordinates the Dolphin and FFMPEG processes.
 * It exports functions that are meant to be used by third party programs, and therefore shouldn't aassume it's being run at the command line.
 */
import { ProcessEventEmmiter, fillUndefinedFields, ProgressCallback, FRAMES_PER_SECOND, getDolphinPath, getFfmpegPath, ExternalProcess, ExitCallback, PLACKBACK_CMD } from "./common"
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
    timeout?: number,
    ffmpegTimeout?: number,
    dolphinTimeout?: number,
    stdout?: Writable,
    stderr?: Writable,
    startFrame?: number,
    endFrame?: number,
    startPaddingFrames: number,
    volume: number,
    bitrate: number
}

export const DEFAULT_ARGUMENTS : Readonly<SlpToVideoArguments> = {
    inputFile: "input.slp",
    workDir: "tmp",
    meleeIso: "SSBM.iso",
    dolphinPath: PLACKBACK_CMD,
    ffmpegPath: "ffmpeg",
    internalResolution: "720p",
    outputFilename: "output.avi",
    enableWidescreen: false,
    timeout: undefined,
    ffmpegTimeout: undefined,
    dolphinTimeout: undefined,
    stderr: undefined,
    stdout: undefined,
    startFrame: undefined,
    endFrame: undefined,
    startPaddingFrames: 120,
    volume: 0.25,
    bitrate: 25000
}

export const isValidInternalResolution = DolphinProcessFactory.isValidInternalResolution

export const validInternalResolutionList = DolphinProcessFactory.validInteralResolutionList

/**
 * Spawns the process that converts the SLP file to a video file.
 * @param opts Options for the process. Undefined values will be filled by default values.
 * @returns
 */
export function createSlptoVideoProcess(opts: Partial<SlpToVideoArguments> = {}) : {
    onDolphinDone: (callback: ExitCallback) => void,
    onFfmpegDone: (callback: ExitCallback) => void,
    onDolphinProgress: (callback: ProgressCallback) => void,
    onFfmpegProgress: (callback: ProgressCallback) => void,
    onDone: (callback: ExitCallback) => void,
    kill: () => void
} {
    if (opts.dolphinPath === undefined) {
        const dolphinPath = getDolphinPath(false)
        if (dolphinPath === null) {
            throw new Error("no valid playback dolphin path was found")
        }
        opts.dolphinPath = dolphinPath
    }
    if (opts.ffmpegPath === undefined) {
        const ffmpegPath = getFfmpegPath()
        if (ffmpegPath === null) {
            throw new Error("no valid ffmpeg path was found")
        }
        opts.ffmpegPath = ffmpegPath
    }

    const { ffmpegPath, workDir, inputFile, dolphinPath, meleeIso, timeout, enableWidescreen, outputFilename, stdout, stderr, startFrame, endFrame, startPaddingFrames, volume, ffmpegTimeout, dolphinTimeout, bitrate, internalResolution } = fillUndefinedFields(opts, DEFAULT_ARGUMENTS)
    
    let killed = false
    let done = false // used to avoid sending multiple "done" events
    let timer : NodeJS.Timeout | undefined = undefined
    const overallEventEmitter : ProcessEventEmmiter = new EventEmitter() // used to emit "done" event
    const ffmpegEventEmitter : ProcessEventEmmiter = new EventEmitter()
    let ffmpegProcess : ExternalProcess | null = null
    function kill(signal?: NodeJS.Signals | number) {
        if (done) { return }

        killed = true
        done = true
        overallEventEmitter.emit("done", null)
        clearTimeout(timer)


        dolphinProcess.kill(signal)
        if (ffmpegProcess) {
            ffmpegProcess.kill(signal)
        }

    }



    let _startFrame : number | undefined = undefined, startCutoffSeconds : number | undefined = undefined
    if (startFrame !== undefined) {
        _startFrame = Math.max(Frames.FIRST, startFrame - startPaddingFrames)
        startCutoffSeconds = (startFrame - _startFrame) / FRAMES_PER_SECOND
    }

    const dolphinFactory = new DolphinProcessFactory({dolphinPath, slpInputFile: inputFile, workDir, meleeIso, timeout: dolphinTimeout, enableWidescreen, stdout, stderr, startFrame: _startFrame, endFrame, bitrate, internalResolution})
    const dolphinProcess = dolphinFactory.spawnProcess()

    const ffmpegFactory = new AudioVideoMergeProcessFactory({ffmpegPath, videoFile: dolphinFactory.dumpVideoFile, audioFile: dolphinFactory.dumpAudioFile, outputFile: outputFilename, stdout, stderr, startCutoffSeconds, volume, timeout: ffmpegTimeout})

    dolphinProcess.onExit((code) => {
        if (code !== 0) {
            if (!done) {
                done = true
                overallEventEmitter.emit("done", code)
                clearTimeout(timer)
            }
            return
        }

        if (killed) {
            return // the process was killed manually and shouldn't spawn the ffmpeg process
        }

        ffmpegProcess = ffmpegFactory.spawnProcess()
        ffmpegProcess.onProgress((progress, start, end) => ffmpegEventEmitter.emit("progress", progress, start, end))
        ffmpegProcess.onExit((code) => {
            ffmpegEventEmitter.emit("done", code)

            if (!done) {
                done = true
                overallEventEmitter.emit("done", code)
                clearTimeout(timer)
            }
        }) 
    })

    if (timeout) {
        timer = setTimeout(kill, timeout)
    }

    return {
        onDolphinProgress(callback: ProgressCallback) {
            dolphinProcess.onProgress(callback)
        },
        onDolphinDone(callback: ExitCallback) {
            dolphinProcess.onExit(callback)
        },
        onFfmpegProgress(callback: ProgressCallback) {
            ffmpegEventEmitter.on("progress", callback)
        },
        onFfmpegDone(callback: ExitCallback) {
            ffmpegEventEmitter.on("done", callback)
        },
        onDone(callback: ExitCallback) {
            overallEventEmitter.on("done", callback)
        },
        kill
    }
}