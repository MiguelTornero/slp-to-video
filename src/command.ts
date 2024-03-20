import { rm } from "fs/promises";
import { getWorkDir } from "./common";
import yargs = require("yargs");

interface Arguments {
    [x: string]: unknown;
    h: boolean
}

export async function run(argv : string[] = [], development = false) : Promise<void> {
    let workDir : string | null = null
    
    const parser = yargs(argv).options({
        h: {type: "boolean", default: false, alias: "help"}
    })

    try {
        workDir = getWorkDir(development)
        const args : Arguments = await parser.parse()
        console.log("workdir:", workDir)
        console.log("args:", args)
    }
    finally {
        console.log("cleaning up...")
        if (workDir !== null) {
            await rm(workDir, {recursive: true, force: true})
       }
    }
}