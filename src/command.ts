import { rm } from "fs/promises";
import { getWorkDir } from "./common";
import yargs = require("yargs");

import { hideBin } from 'yargs/helpers'

interface Arguments {
    [x: string]: unknown,
    h: boolean,
    slp_file: string,
    _: (string|number)[]
}

async function parseArgv(argv : string[]) : Promise<Arguments> {
    return await yargs().command("$0 <slp_file>", "Converts SLP files to video files").options({
        h: {type: "boolean", default: false, alias: "help"},
        slp_file: {type: "string", demandOption: true, hidden: true} // needed for proper typescript type inference, hidden
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

        workDir = getWorkDir(development)

        console.log("workdir:", workDir)
        console.log("args:", args)
        console.log("slp file:", slp_file)
    }
    finally {
        console.log("cleaning up...")
        if (workDir !== null) {
            await rm(workDir, {recursive: true, force: true})
       }
    }
}