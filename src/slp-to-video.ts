import { ProcessEventEmmiter, fillUndefinedFields, ProgressCallback } from "./common"
import { EventEmitter, Writable } from "stream"
import { DolphinProcessFactory, ValidInternalResolution } from "./dolphin"
import { mergeAviVideoAndAudio } from "./ffmpeg"

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

    const eventEmitter : ProcessEventEmmiter = new EventEmitter() // used for the overall process

    const dolphinFactory = new DolphinProcessFactory({dolphinPath, slpInputFile: inputFile, workDir, meleeIso, timeout, enableWidescreen, stdout, stderr})
    const dolphinProcess = dolphinFactory.spawnProcess()

    dolphinProcess.onExit((code) => {
        if (code !== 0) {
            eventEmitter.emit("done", null)
            return
        }

        try { 
            mergeAviVideoAndAudio(dolphinFactory.dumpVideoFile, dolphinFactory.dumpAudioFile, outputFilename)
            eventEmitter.emit("done", 0)
        }
        catch (e) {
            eventEmitter.emit("done", null)
        }
    })

    return {
        onDolphinProgress(callback: ProgressCallback) {
            dolphinProcess.onProgress(callback)
        },
        onDolphinExit(callback: (code: number | null) => void) {
            dolphinProcess.onExit(callback)
        },
        onDone(callback: (code: number|null) => void) {
            eventEmitter.on("done", callback)
        },
        startFrame: dolphinFactory.startFrame,
        endFrame: dolphinFactory.endFrame
    }
}