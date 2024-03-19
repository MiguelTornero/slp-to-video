import { fancy } from "fancy-test"
import { ok } from "node:assert"

import { run } from "../src"

describe("run cmd", () => {
    fancy.stdout()
    .do(() => run())
    .it("no args", (ctx) => {
        ok(ctx.stdout.includes("hello"))
    })
    
})