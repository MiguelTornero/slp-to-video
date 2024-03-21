#!/usr/bin/env -S node_modules/.bin/ts-node --swc

(async function () {
    const { run } = await import("../src/index")
    await run(process.argv, true)
})().catch((e) => {
    console.log(e)
    process.exit(1)
})