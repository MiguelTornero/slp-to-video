import { access, constants, rm } from "fs/promises";
import { getWorkDir, toAbsolutePath } from "./common";
import yargs = require("yargs");

import { hideBin } from 'yargs/helpers'
import { createSlptoVideoProcess } from "./slp-to-video";
import { join } from "path";
import { cwd } from "process";

interface Arguments {
    [x: string]: unknown,
    h?: boolean,
    slp_file: string,
    i: string,
    m?: number
    _: (string|number)[]
}

async function parseArgv(argv : string[]) : Promise<Arguments> {
    return await yargs().command("$0 <slp_file>", "Converts SLP files to video files").options({
        h: {type: "boolean", alias: "help"},
        slp_file: {type: "string", demandOption: true, hidden: true}, // same as first positional arg, needed for proper typescript type inference, hidden
        i: {type: "string", alias: "iso", describe: "Path to the Melee ISO", default: "SSBM.iso"},
        m: {type: "number", alias: "timeout", describe: "Maximum amount of miliseconds the Dolphin process is allowed to run"}
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

        const slpProcess = createSlptoVideoProcess({dolphinPath: dolphinPath, inputFile: inputFile, workDir: workDir, meleeIso: meleeIso, timeout: args.m})
        slpProcess.stdout.pipe(process.stdout)
        slpProcess.stderr.pipe(process.stderr)


        await new Promise((res) => {
            slpProcess.on("exit", (code) => {
                res(code)
            })
        })
    }
    finally {
        console.log("cleaning up...")
        if (workDir !== null) {
            await rm(workDir, {recursive: true, force: true})
       }
    }
}