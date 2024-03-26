import { access, constants, rm } from "fs/promises";
import { getWorkDir, toAbsolutePath } from "./common";
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
    m?: number,
    o?: string,
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
    let workDir : string | null = null
    argv = hideBin(argv)

    try {
        const args : Arguments = await parseArgv(argv)
        const slp_file = args.slp_file
        const dolphinPath = join(__dirname, "..", "assets", "playback.appimage") // TODO: change to adapt to different platforms (Win, Mac)

        workDir = getWorkDir(development)

        await access(dolphinPath, constants.R_OK | constants.X_OK)

        const inputFile = toAbsolutePath(slp_file, cwd())
        const meleeIso = toAbsolutePath(args.i, cwd())
        
        console.log("workdir:", workDir)
        console.log("slp file:", inputFile)
        console.log("dolphin:", dolphinPath)
        console.log("iso:", meleeIso)

        const { dolphinProcess } = createSlptoVideoProcess({dolphinPath: dolphinPath, inputFile: inputFile, workDir: workDir, meleeIso: meleeIso, timeout: args.m, outputFilename: args.o, enableWidescreen: args.w})
        
        if (args.v) {
            dolphinProcess.stdout.pipe(process.stdout)
            dolphinProcess.stderr.pipe(process.stderr)
        }


        const exitCode = await new Promise<number|null>((res) => {
            dolphinProcess.on("exit", res)
        })

        if (exitCode !== 0) {
            console.error("Dolphin exited abnormally. This may be due to an invalid SLP or ISO file")
        }
    }
    finally {
        console.log("cleaning up...")
        if (workDir !== null && !development) {
            await rm(workDir, {recursive: true, force: true})
       }
    }
}