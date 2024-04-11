import { rm } from "fs/promises";
import { FRAMES_PER_SECOND, createLoadingMessagePrinter, getDolphinPath, getFfmpegPath, getWorkDir, msToTimestamp, parseTimeStamp, toAbsolutePath } from "./common";
import yargs = require("yargs");

import { hideBin } from 'yargs/helpers'
import { DEFAULT_ARGUMENTS, createSlptoVideoProcess } from "./slp-to-video";

interface Arguments {
    [x: string]: unknown,
    h?: boolean,
    slp_file: string,
    i: string,
    m: number,
    o: string,
    v?: boolean,
    w?: boolean,
    f?: string,
    t?: string,
    V: number,
    d?: string,
    p?: string,
}

async function parseArgv(argv : string[]) : Promise<Arguments> {
    return await yargs().command("$0 <slp_file>", "Converts SLP files to video files").options({
        h: {type: "boolean", alias: "help"},
        slp_file: {type: "string", demandOption: true, hidden: true}, // same as first positional arg, needed for proper typescript type inference, hidden
        i: {type: "string", alias: "iso", describe: "Path to the Melee ISO", default: DEFAULT_ARGUMENTS.meleeIso},
        m: {type: "number", alias: "timeout", describe: "Maximum amount of miliseconds the process is allowed to run", default: DEFAULT_ARGUMENTS.timeout},
        o: {type: "string", alias: "output", describe: "Name of the output file", default: DEFAULT_ARGUMENTS.outputFilename},
        v: {type: "boolean", alias: "verbose", describe: "Enable extra output"},
        w: {type: "boolean", alias: "widescreen", describe: "Enable widescreen resolution (16:9)"},
        f: {type: "string", alias: "from", describe: "The frame you would like to start the replay on. Can also be provided as a timestamp with the format MM:SS"},
        t: {type: "string", alias: "to", describe: "The frame you would like to end the replay on. Can also be provided as a timestamp with the format MM:SS"},
        V: {type: "number", alias: "volume", describe: "Volume multipier for the output file", default: DEFAULT_ARGUMENTS.volume},
        d: {type: "string", alias: "dolphin-path", describe: "Path of the Playback Dolphin binary"},
        p: {type: "string", alias: "ffmpeg-path", describe: "Path to the ffmpeg binary"}
    })
    .strict()
    .parse(argv)
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

    try {

        workDir = getWorkDir(development)

        const slp_file = args.slp_file

        let dolphinPath
        if (args.d !== undefined) {
            dolphinPath =  toAbsolutePath(args.d)
        }
        else {
            dolphinPath = getDolphinPath(development)
            if (dolphinPath === null) {
                dolphinPath = undefined
            }
        }

        let ffmpegPath
        if (args.p !== undefined) {
            ffmpegPath = toAbsolutePath(args.p)
        }
        else {
            ffmpegPath = getFfmpegPath()
            if (ffmpegPath === null) {
                ffmpegPath = undefined
            }
        }


        const inputFile = toAbsolutePath(slp_file)
        const meleeIso = toAbsolutePath(args.i)
        const outputPath = toAbsolutePath(args.o)

        const startFrame = args.f !== undefined ? parseFrameInput(args.f) : undefined
        const endFrame = args.t !== undefined ? parseFrameInput(args.t) : undefined

        const dolphinLoadingPrinter = createLoadingMessagePrinter("opening playback dolphin", process.stdout, 500)
        let dolphinRunning = false

        let stdout = undefined, stderr = undefined
        if (args.v) {
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

        const {onDolphinProgress, onDolphinExit, onDone, onFfmpegDone, onFfmpegProgress} = createSlptoVideoProcess({dolphinPath: dolphinPath, ffmpegPath: ffmpegPath ,inputFile: inputFile, workDir: workDir, meleeIso: meleeIso, timeout: args.m, outputFilename: outputPath, enableWidescreen: args.w, stdout, stderr, startFrame, endFrame, volume: args.V})
        
        if (!args.v) {
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
            if (!args.v) {
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
            if (!args.v) {
                process.stdout.write("\n")
            }
            if (code !== 0) {
                console.error("ffmpeg exited abnormally")
            }
            else {
                console.log("done!")
            }
        })

        await new Promise<void>((res, rej) => {
            const timer = setTimeout(() => {
                rej(new Error("reached timeout timer"))
            }, args.m)
            onDone(() => {
                clearTimeout(timer)
                res()
            })
        })
    }
    finally {
        console.log("\ncleaning up...")
        if (!development && workDir) {
            await rm(workDir, {recursive: true, force: true})
       }
       // add orphaned child process handling here, if necessary
    }
}