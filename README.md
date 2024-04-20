# slp-to-video
A tool for converting Slippi SLP replay files into video files using Dolphi's frame dumping feature and FFMPEG (no OBS Studio required).  

## Requirements
At this moment, this project has only been tested on Linux, though it should also work on Windows and Mac.  

This project requires the following tools to build and install:
* [NodeJS v20+](https://nodejs.org/)
* NPM 1.5.0+ (Usually included with NodeJS) (pnpm should work too, though it is untested)
* [Git](https://git-scm.com/)
* [FFMPEG](https://ffmpeg.org/) (See [Installation](#installation) for more details)
* A [Slippi Playback Dolphin](https://github.com/project-slippi/Ishiiruka-Playback) binary (See [Installation](#installation) for more details) 

## Installation
For the moment, this project is only available by cloning the repository (a standalone binary release and an NPM library are planned for the future):
```bash
git clone https://github.com/MiguelTornero/slp-to-video.git
```
To install the NPM dependencies (which include the FFMPEG binary), run the following command (see instructions below if you don't wish to install the FFMPEG binary):
```bash
npm install
```
Due to this being a Typescript project, an extra build step is required. This is done automatically after installing the dependencies for the first time. Further builds require the following command:
```bash
npm run build
```
To make the `slp-to-video` command accesible from the command line, run this command to link the package globally:
```bash
npm link
```
Note that you might need sudo privileges to run this command on Linux. To avoid this you can simply add a prefix (this assumes `~/.local/bin` is in your `PATH`):
```bash
npm link . --prefix ~/.local # needs further testing
```

### FFMPEG
This project includes [node-ffmpeg-installer](https://github.com/kribblo/node-ffmpeg-installer) as an optional dependency to install the FFMPEG binary. If you wish to not install this binary and instead use your local FFMPEG installation, install only the non-optional dependencies like this:
```bash
npm install --no-optional
```
If the FFMPEG binary is not installed by NPM, this tool will fallback to a local FFMPEG installation. Specifying the path to the FFMPEG binary using the `--ffmpeg-path` option overrides this behaviour.

### Playback Dolphin
If you want to use the custom Dolphin Playback binary developed for this project that removes the frame limiter (resulting in faster conversions), you can initiate the Git submodule using the following command:
```bash
git submodule update --init --recursive
```
After that, follow the build instructions in the `Readme.md` file inside the `Ishiiruka` directory to build the binary. This tool will look for the built binary in the default build output directory.  

If you already have a pre-built binary that you got externally, you can just drop it in the `assets` directory or use the `--dolphin-path` option while running the command.  

If a Playback Dolphin binary is not found using the previous methods, this tool will automatically look for a local [Slippi Launcher](https://slippi.gg/) installation as a fallback.

## How to use
This tool exposes the following `slp-to-video` command:
```
slp-to-video <slp_file>
```
Where `slp_file` is the path to the SLP file to convert. By default, the output witll be an AVI video file with the name `output.avi` (though both the name and the format of the output file can be specified with the `-o` option). Also, unless the path to the Melee ISO is specified using the `-i` option, the command will look for an ISO file with the name `SSMB.iso` in the same directory where the command is being run. All the options and flags for the command are as follows:
```
Options:
      --version              Show version number                       [boolean]
  -h, --help                 Show help                                 [boolean]
  -i, --iso                  Path to the Melee ISO[string] [default: "SSBM.iso"]
  -m, --timeout              Maximum amount of miliseconds the overall process
                             is allowed to run                          [number]
  -o, --output               Name of the output file
                                                [string] [default: "output.avi"]
  -v, --verbose              Enable extra output                       [boolean]
  -w, --widescreen           Enable widescreen resolution (16:9)       [boolean]
  -f, --from                 The frame you would like to start the replay on.
                             Can also be provided as a timestamp with the format
                             MM:SS                                      [string]
  -t, --to                   The frame you would like to end the replay on. Can
                             also be provided as a timestamp with the format
                             MM:SS                                      [string]
  -V, --volume               Volume multipier for the output file
                                                        [number] [default: 0.25]
  -d, --dolphin-path         Path to the Playback Dolphin binary        [string]
  -p, --ffmpeg-path          Path to the ffmpeg binary                  [string]
      --dolphin-timeout      Maximum amount of miliseconds the Dolphin process
                             is allowed to run                          [number]
      --ffmpeg-timeout       Maximum amount of miliseconds the ffmpeg process is
                             allowed to run                             [number]
  -b, --bitrate              Bitrate used by Dolphin for the dumped frames
                                                       [number] [default: 25000]
  -I, --internal-resolution  Internal resolution option (auto, 1x, 1.5x, 2x,
                             720p, 2.5x, 3x, 1080p, 4x, WQHD, 5x, 6x, 4K, 7x,
                             8x)                      [string] [default: "720p"]
```
As specified in the [installation section](#installation), this package can be installed globally using the `npm link` command. However, if don't wish to install the command globally, you can just run the command using `npx` (while on the directory with the cloned repository), or you can run the `run.js` file in the `bin` directory directly, like so:
```bash
npx slp-to-video input.slp # Using npx

./bin/run.js input.slp # Running file directly
```
Keep in mind that this runs only the lastest JS build, and will not reflect any changes made to the Typescript files until `npm run build` is run.

### Development
To facilitate development, a script file that runs the Typescript directly with `ts-node` has been included, which also outputs more verbose errors and keeps the temporary files in the `tnp` directory for further debugging:
```bash
./bin/dev.ts input.slp
```
Be sure to empty the `tmp` directory after running this to avoid unnecessarily wasting disk space.

### Usage examples
```bash
slp-to-video input.slp --from 0:25 --to 0:50 # Convert only from second 25 until second 50

slp-to-video input.slp --iso ~/SSBM.iso -o output.mp4 # Convert file to an MP4 video using the ISO at ~/SSMB.iso

slp-to-video input.slp --widescreen -I 4K # Convert file to a widescreen file with (approx.) 4K resolution. (Be sure your machine is powerful enough)

slp-to-video input.slp --timeout 5000 -v # Run command in verbose mode, with a timeout of 5000 (5 seconds)
```

## Special thanks
Thanks to [@kevinsung](https://github.com/kevinsung), whose [repo](https://github.com/kevinsung/slp-to-video) served as an inspiration for this one.  

Also, a very special thanks to the [Slippi Discord](https://discord.com/invite/pPfEaW5), which was a valuable resource in helping me figure stuff out. I especially want to shout out [nikki](https://github.com/NikhilNarayana) and [xpilot](https://github.com/vladfi1).