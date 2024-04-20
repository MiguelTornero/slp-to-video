#!/usr/bin/env node_modules/.bin/ts-node

(async function () {
    const { run } = await import("../src/index")
    await run(process.argv, true)
})().catch((e) => {
    console.log(e)
    process.exit(1)
})