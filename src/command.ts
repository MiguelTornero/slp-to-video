/**
 * This module contains the logic used for running the program in the command line.
 * This is the only file that should be able to exit the program or print stuff on the terminal.
 */
import { access, constants, rm } from "fs/promises";
import { FRAMES_PER_SECOND, createLoadingMessagePrinter, getDolphinPath, getFfmpegPath, getWorkDir, msToTimestamp, parseTimeStamp, toAbsolutePath } from "./common";
import yargs = require("yargs");

import { hideBin } from 'yargs/helpers'
import { DEFAULT_ARGUMENTS, createSlptoVideoProcess, isValidInternalResolution } from "./slp-to-video";
import { DolphinProcessFactory } from "./dolphin";

interface Arguments {
    [x: string]: unknown,
    h?: boolean,
    slp_file: string,
    iso: string,
    timeout?: number,
    output: string,
    verbose?: boolean,
    widescreen?: boolean,
    from?: string,
    to?: string,
    volume: number,
    bitrate: number,
    "dolphin-path"?: string,
    "ffmpeg-path"?: string,
    "dolphin-timeout"?: number,
    "ffmpeg-timeout"?: number,
    "internal-resolution": string
}

/**
 * Parses a trimmed argv (without the binary)
 * @param argv The process.argv without the node binary or script file name
 * @returns 
 */
async function parseArgv(argv : string[]) : Promise<Arguments> {
    return await yargs().command("$0 <slp_file>", "Converts SLP files to video files").options({
        h: {type: "boolean", alias: "help"},
        slp_file: {type: "string", demandOption: true, hidden: true}, // same as first positional arg, needed for proper typescript type inference, hidden
        iso: {type: "string", alias: "i", describe: "Path to the Melee ISO", default: DEFAULT_ARGUMENTS.meleeIso},
        timeout: {type: "number", alias: "m", describe: "Maximum amount of miliseconds the overall process is allowed to run"},
        output: {type: "string", alias: "o", describe: "Name of the output file", default: DEFAULT_ARGUMENTS.outputFilename},
        verbose: {type: "boolean", alias: "v", describe: "Enable extra output"},
        widescreen: {type: "boolean", alias: "w", describe: "Enable widescreen resolution (16:9)"},
        from: {type: "string", alias: "f", describe: "The frame you would like to start the replay on. Can also be provided as a timestamp with the format MM:SS"},
        to: {type: "string", alias: "t", describe: "The frame you would like to end the replay on. Can also be provided as a timestamp with the format MM:SS"},
        volume: {type: "number", alias: "V", describe: "Volume multipier for the output file", default: DEFAULT_ARGUMENTS.volume},
        "dolphin-path": {type: "string", alias: "d", describe: "Path of the Playback Dolphin binary"},
        "ffmpeg-path": {type: "string", alias: "p", describe: "Path to the ffmpeg binary"},
        "dolphin-timeout": {type: "number", describe: "Maximum amount of miliseconds the Dolphin process is allowed to run"},
        "ffmpeg-timeout": {type: "number", describe: "Maximum amount of miliseconds the ffmpeg process is allowed to run"},
        bitrate: {type: "number", alias:"b" , describe: "Bitrate used by Dolphin for the dumped frames", default: DEFAULT_ARGUMENTS.bitrate},
        "internal-resolution": {type: "string", alias: "I", describe: `Internal resolution option (${DolphinProcessFactory.validInteralResolutionList.join(", ")})`, default: DEFAULT_ARGUMENTS.internalResolution}
    })
    .strict()
    .parse(argv)
}

async function cleanup(development: boolean, workDir: string | null, processKill: (() => void) | null) {
    console.log("\ncleaning up...")

    // handling possible orphaned processes
    if (processKill) {
        processKill()
    }

    if (!development && workDir) {
        await rm(workDir, {recursive: true, force: true})
    }
}

/**
 * Function to parse the user input for the starting or last frame of the replay
 * @param input Input string, which can be either the frame number itself, or a timestamp with format HH:MM:SS
 * @param startFrame The starting frame corresponding to timestanp 00:00, defaults to -123
 * @param framerate The number of frames in a second, defaults to 60
 * @returns If the input sting wasn't a valid input, it returns null. Otherwise it returns the frame number
 */
function parseFrameInput(input: string, startFrame = -123, framerate = FRAMES_PER_SECOND) {
    if (input.match(/^-?\d+$/)) {
        // input is numeric, so it's a frame input
        return parseInt(input)
    }

    const time = parseTimeStamp(input)
    if (time === null) {
        // input wasn't a timestamp, so no valid input was given
        return null
    }

    return Math.round(time.hours * 3600 + time.minutes * 60 + time.seconds) * framerate + startFrame
}

export async function run(argv : string[] = [], development = false) : Promise<void> {
    argv = hideBin(argv)
    const args : Arguments = await parseArgv(argv) // can exit the program
    let workDir : string | null = null
    let processKill : (() => void) | null = null

    try {

        workDir = getWorkDir(development)

        const slp_file = args.slp_file

        let dolphinPath
        if (args["dolphin-path"] !== undefined) {
            dolphinPath =  toAbsolutePath(args["dolphin-path"])
        }
        else {
            dolphinPath = getDolphinPath(development)
            if (dolphinPath === null) {
                dolphinPath = undefined
            }
        }

        let ffmpegPath
        if (args["ffmpeg-path"] !== undefined) {
            ffmpegPath = toAbsolutePath(args["ffmpeg-path"])
        }
        else {
            ffmpegPath = getFfmpegPath()
            if (ffmpegPath === null) {
                ffmpegPath = undefined
            }
        }


        const inputFile = toAbsolutePath(slp_file)
        const meleeIso = toAbsolutePath(args.iso)
        const outputPath = toAbsolutePath(args.output)

        await access(inputFile, constants.R_OK)
        await access(meleeIso, constants.R_OK)

        const startFrame = args.from !== undefined ? parseFrameInput(args.from) : undefined
        const endFrame = args.to !== undefined ? parseFrameInput(args.to) : undefined

        const dolphinLoadingPrinter = createLoadingMessagePrinter("opening playback dolphin", process.stdout, 500)
        let dolphinRunning = false

        let stdout = undefined, stderr = undefined
        if (args.verbose) {
            console.log("workdir:", workDir)
            console.log("slp file:", inputFile)
            console.log("dolphin:", dolphinPath)
            console.log("iso:", meleeIso)
            console.log("start frame:", startFrame)
            console.log("end frame:", endFrame)
            console.log("ffmpeg:", ffmpegPath)
            stdout = process.stdout
            stderr = process.stderr
        }

        if (startFrame === null) {
            //there was an error parsing the frame input
            throw new Error("invalid start frame input")
        }
        if (endFrame === null) {
            // same for end frame
            throw new Error("invalid end frame input")
        }

        let internalResolution = undefined
        if (isValidInternalResolution(args["internal-resolution"])) {
            internalResolution = args["internal-resolution"]
        }

        const {onDolphinProgress, onDolphinExit, onDone, onFfmpegDone, onFfmpegProgress, kill} = createSlptoVideoProcess({dolphinPath: dolphinPath, ffmpegPath: ffmpegPath ,inputFile: inputFile, workDir: workDir, meleeIso: meleeIso, timeout: args.timeout, outputFilename: outputPath, enableWidescreen: args.widescreen, stdout, stderr, startFrame, endFrame, volume: args.volume, bitrate: args.bitrate ,ffmpegTimeout: args["ffmpeg-timeout"], dolphinTimeout: args["dolphin-timeout"], internalResolution})
        processKill = kill
        
        if (!args.verbose) {
            dolphinLoadingPrinter.start()
            onDolphinProgress((frame, startFrame, endFrame) => {
                if (!dolphinRunning) {
                    dolphinRunning = true
                    dolphinLoadingPrinter.stop()
                }
                const normalizedCurrent = frame - startFrame

                if (endFrame == undefined) {
                    process.stdout.write(`\rrendering frames: ??.?% (${normalizedCurrent}/?    `) // leaving space at the end in case we need to override a big number
                    return
                }

                const normalizedLast = endFrame - startFrame
                const percent = normalizedCurrent / normalizedLast * 100

                process.stdout.write(`\rrendering frames: ${percent.toFixed(1).padStart(4, "0")}% (${normalizedCurrent}/${normalizedLast})`)
            })
        }

        onDolphinExit((exitCode) => {
            if (!args.verbose) {
                process.stdout.write("\n")
            }
            if (!dolphinRunning) {
                dolphinRunning = true
                dolphinLoadingPrinter.stop()
            }
            if (exitCode !== 0) {
                console.error("dolphin exited abnormally. This may be due to an invalid SLP or ISO file")
                return
            }
            
            console.log("dolphin process finished")
        })
        
        onFfmpegProgress((progressMs, _, endMs) => {
            if (!args.verbose) {
                if (endMs === undefined) {
                    process.stdout.write(`\rrendering output file: ??.?% (${msToTimestamp(progressMs)})`)    
                }
                else {
                    const percent = progressMs / endMs * 100
                    process.stdout.write(`\rrendering output file: ${percent.toFixed(1).padStart(4, "0")}% (${msToTimestamp(progressMs)})`)
                }
            }
        })

        onFfmpegDone((code) => {
            if (!args.verbose) {
                process.stdout.write("\n")
            }
            if (code !== 0) {
                console.error("ffmpeg exited abnormally")
            }
            else {
                console.log("done!")
            }
        })

        await new Promise<any>((res) => {
            onDone(res)
        })
    }
    finally {
        cleanup(development, workDir, processKill)
    }
}