import { fillUndefinedFields } from "./common"

type ValidInternalResultionMultiplier = 1 | 1.5 | 2 | 2.5 | 3 | 4 | 5 | 6 | 7 | 8
type ValidInternalResolution = `${ValidInternalResultionMultiplier}x` | "720p" | "1080p"  | "WQHD" | "4K" | "auto"

type SlpToVideoArguments = {
    inputFile: string,
    workDir: string,
    meleeIso: string,
    playbackBin: string,
    internalResolution: ValidInternalResolution,
    outputFilename: string,
    outputFormat: "avi" | "mp4",
    enableWidescreen: boolean,
}

const DEFAULT_ARGUMENTS : SlpToVideoArguments = {
    inputFile: "input.slp",
    workDir: "tmp",
    meleeIso: "SSBM.iso",
    playbackBin: "playback",
    internalResolution: "720p",
    outputFilename: "output.avi",
    outputFormat: "avi",
    enableWidescreen: false
}

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

export function SlpToVideo(opts: Partial<SlpToVideoArguments> = {}) {
    const filledOpts = fillUndefinedFields(opts, DEFAULT_ARGUMENTS)
}