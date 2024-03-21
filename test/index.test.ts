import { ok } from "node:assert"

import { spawnSync } from "node:child_process"

describe("run cmd", () => {

    it("should show help on stderr", () => {
        const cmd = spawnSync("./bin/dev.ts")
        ok(!cmd.stdout.toString())
        ok(!!cmd.stderr.toString())
    })
    
    it("should show help on stdout", () => {
        const cmd = spawnSync("./bin/dev.ts", ["-h"])
        ok(!!cmd.stdout.toString())
        ok(!cmd.stderr.toString())
    })
})