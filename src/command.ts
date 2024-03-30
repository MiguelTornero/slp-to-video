import { access, constants, rm } from "fs/promises";
import { createLoadingMessagePrinter, getWorkDir, toAbsolutePath } from "./common";
import yargs = require("yargs");

import { hideBin } from 'yargs/helpers'
import { DEFAULT_ARGUMENTS, createSlptoVideoProcess } from "./slp-to-video";
import { join } from "path";
import { cwd } from "process";

interface Arguments {
    [x: string]: unknown,
    h?: boolean,
    slp_file: string,
    i: string,
    m: number,
    o: string,
    v?: boolean,
    w?: boolean,
    _: (string|number)[]
}

async function parseArgv(argv : string[]) : Promise<Arguments> {
    return await yargs().command("$0 <slp_file>", "Converts SLP files to video files").options({
        h: {type: "boolean", alias: "help"},
        slp_file: {type: "string", demandOption: true, hidden: true}, // same as first positional arg, needed for proper typescript type inference, hidden
        i: {type: "string", alias: "iso", describe: "Path to the Melee ISO", default: DEFAULT_ARGUMENTS.meleeIso},
        m: {type: "number", alias: "timeout", describe: "Maximum amount of miliseconds the Dolphin process is allowed to run", default: DEFAULT_ARGUMENTS.timeout},
        o: {type: "string", alias: "output", describe: "Name of the output file", default: DEFAULT_ARGUMENTS.outputFilename},
        v: {type: "boolean", alias: "verbose", describe: "Enable extra outpug"},
        w: {type: "boolean", alias: "widescreen", describe: "Enable widescreen resolution (16:9}"}
    })
    .strict()
    .parse(argv)
}

export async function run(argv : string[] = [], development = false) : Promise<void> {
    argv = hideBin(argv)
    const args : Arguments = await parseArgv(argv) // can exit the program

    const workDir = getWorkDir(development)

    const slp_file = args.slp_file
    const dolphinPath = join(__dirname, "..", "assets", "playback.appimage") // TODO: change to adapt to different platforms (Win, Mac)

    await access(dolphinPath, constants.R_OK | constants.X_OK)

    const inputFile = toAbsolutePath(slp_file, cwd())
    const meleeIso = toAbsolutePath(args.i, cwd())
    const outputPath = toAbsolutePath(args.o, cwd())

    const fmmpegLoadingPrinter = createLoadingMessagePrinter("converting dump files")

    let stdout = undefined, stderr = undefined
    if (args.v) {
        console.log("workdir:", workDir)
        console.log("slp file:", inputFile)
        console.log("dolphin:", dolphinPath)
        console.log("iso:", meleeIso)
        stdout = process.stdout
        stderr = process.stderr
    }

    try {
        console.log("launching playback dolphin...")
        const {onDolphinProgress, onDolphinExit, onDone, onFfmpegDone} = createSlptoVideoProcess({dolphinPath: dolphinPath, inputFile: inputFile, workDir: workDir, meleeIso: meleeIso, timeout: args.m, outputFilename: outputPath, enableWidescreen: args.w, stdout, stderr})
        
        if (!args.v) {            
            onDolphinProgress((frame, startFrame, endFrame) => {
                const normalizedCurrent = frame - startFrame

                if (endFrame == undefined) {
                    process.stdout.write(`\rrendering frames: ???% (${normalizedCurrent}/???`)
                    return
                }

                const normalizedLast = endFrame - startFrame
                const percent = normalizedCurrent / normalizedLast * 100

                process.stdout.write(`\rrendering frames: ${percent.toFixed(1)}% (${normalizedCurrent}/${normalizedLast})`)
            })
        }

        onDolphinExit((exitCode) => {
            process.stdout.write("\n")
            if (exitCode !== 0) {
                console.error("dolphin exited abnormally. This may be due to an invalid SLP or ISO file")
                return
            }
            
            console.log("dolphin process finished")
            if (!args.v) {
                fmmpegLoadingPrinter.start()
            }
        })

        onFfmpegDone((code) => {
            if (!args.v) {
                fmmpegLoadingPrinter.stop()
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
        if (!development) {
            await rm(workDir, {recursive: true, force: true})
       }
       // add orphaned child process handling here, if necessary
    }
}