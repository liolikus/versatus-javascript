#!/usr/bin/env node

import yargs from 'yargs'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const argv = yargs(process.argv.slice(2))
    .command(
        'init [example]',
        'Initialize a project with an example contract',
        (yargs) => {
            return yargs.positional('example', {
                describe: 'The example contract to initialize',
                type: 'string',
                choices: ['basic', 'erc-20'], // Add more example types if you have them
                demandOption: true,
                demand: 'You must specify an example contract to initialize'
            })
        },
        (argv) => {
            console.log("\x1b[0;33mInitializing example contract...\x1b[0m");

            // Check if the package is installed in the current project's node_modules
            const isInstalledPackage = fs.existsSync(path.resolve(process.cwd(), 'node_modules', '@versatus', 'versatus-javascript'));

            // Path to the examples directory
            const exampleDir = isInstalledPackage
                ? path.resolve(process.cwd(), 'node_modules', '@versatus', 'versatus-javascript', 'dist', 'examples', argv.example || 'basic')
                : path.resolve(__dirname, 'examples', argv.example || 'basic');

            const targetDir = process.cwd();
            const targetFilePath = path.join(targetDir, 'example-contract.js');

            // Copy the example file to the target directory
            fs.copyFileSync(
                path.join(exampleDir, 'example-contract.js'),
                targetFilePath
            );

            // Read the content of the example file
            let exampleContractContent = fs.readFileSync(targetFilePath, 'utf8');

            // Update the import path for any contract class based on the environment
            const regex = /^import \{ (.*) \} from '.*'$/gm;
            exampleContractContent = exampleContractContent.replace(regex, (match, className) => {
                const importPath = isInstalledPackage
                    ? `@versatus/versatus-javascript`
                    : `./lib/contracts/index.js`;
                return `import { ${className} } from '${importPath}';`;
            });

            // Write the updated content back to the example file
            fs.writeFileSync(targetFilePath, exampleContractContent, 'utf8');


            const inputsDir = path.join(process.cwd(), 'examples', argv.example || 'basic', 'inputs');
            const targetInputsDir = path.join(targetDir, 'inputs');

            console.log({inputsDir})

            if (fs.existsSync(inputsDir)) {
                if (!fs.existsSync(targetInputsDir)) {
                    fs.mkdirSync(targetInputsDir);
                }
                fs.readdirSync(inputsDir).forEach(file => {
                    const srcFile = path.join(inputsDir, file);
                    const destFile = path.join(targetInputsDir, file);
                    try {
                        fs.copyFileSync(srcFile, destFile);
                    } catch (error) {
                        console.error(`Error copying file ${srcFile} to ${destFile}:`, error);
                    }
                });
            }

            console.log("\x1b[0;32mExample contract and inputs initialized successfully.\x1b[0m");
        }
    )
    .usage('Usage: $0 build [options]')
    .command(
        'build [file]',
        'Build the project with the specified contract',
        (yargs) => {
            return yargs.positional('file', {
                describe: 'Contract file to include in the build',
                type: 'string',
            });
        },
        (argv) => {
            const isInstalledPackage = fs.existsSync(path.resolve(process.cwd(), 'node_modules', '@versatus', 'versatus-javascript'));

            let scriptDir, sysCheckScriptPath;
            if (isInstalledPackage) {
                // In an installed package environment
                scriptDir = path.resolve(process.cwd(), 'node_modules', '@versatus', 'versatus-javascript');
                sysCheckScriptPath = path.resolve(scriptDir, 'lib', 'scripts', 'sys_check.sh');
            } else {
                // In the development environment
                scriptDir = path.resolve(__dirname, '../');
                sysCheckScriptPath = path.resolve(scriptDir, 'lib', 'scripts', 'sys_check.sh');
            }
            
            console.log("Build command executed."); // Debug log

            // const sysCheckScriptPath = path.resolve(__dirname, 'lib', 'scripts', 'sys_check.sh');
            console.log(`Running system check script: ${sysCheckScriptPath}`); // Debug log

            exec(`bash "${sysCheckScriptPath}"`, (sysCheckError, sysCheckStdout, sysCheckStderr) => {
                if (sysCheckError) {
                    console.error(`Error during system check: ${sysCheckError}`);
                    return;
                }

                console.log(sysCheckStdout); // Output from sys_check.sh
                if (sysCheckError) {
                    console.error(`Error during system check: ${sysCheckError}`);
                    return;
                }
                console.log("System check passed. Proceeding with build...");

                // Proceed with build process if system check is successful
                if (argv.file) {
                    console.log("\x1b[0;33mStarting build...\x1b[0m");
                    const filePath = path.resolve(process.cwd(), argv.file);
                    injectFileInWrapper(filePath).then(() => {
                        runBuildProcess();
                    }).catch((error) => {
                        console.error('Error during the build process:', error);
                    });
                } else {
                    console.error('You must specify a contract file to build.');
                    process.exit(1);
                }
            });
        }
    )
    .command(
        'test [inputJson]',
        'Run the test suite for the project',
        (yargs) => {
            return yargs.positional('inputJson', {
                describe: 'Path to the JSON input file for testing',
                type: 'string',
                demandOption: true, // Make this argument required
                demand: 'You must specify a JSON input file for testing'
            })
        },
        (argv) => {
            if (argv.inputJson) {
                console.log("\x1b[0;33mChecking and preparing WASM file...\x1b[0m");
                let scriptDir;
                if (fs.existsSync(path.resolve(__dirname, '../../../node_modules'))) {
                    // In an installed package environment
                    scriptDir = path.resolve(__dirname, '../');
                } else {
                    // In the development environment
                    scriptDir = process.cwd();
                }

                console.log({scriptDir})

                const checkWasmScriptPath = path.resolve(scriptDir, "lib", 'scripts', 'check_wasm.sh');

                console.log({checkWasmScriptPath})

                const execOptions = { maxBuffer: 1024 * 1024 }; // Increase buffer size to 1MB

                exec(`bash "${checkWasmScriptPath}"`, execOptions, (checkWasmError, checkWasmStdout, checkWasmStderr) => {
                    if (checkWasmError) {
                        console.error(`Error during WASM check: ${checkWasmError}`);
                        return;
                    }
                    if (checkWasmStderr) {
                        console.error(`WASM check stderr: ${checkWasmStderr}`);
                        return;
                    }
                    console.log("\x1b[0;33mStarting test...\x1b[0m");
                    const filePath = path.resolve(process.cwd(), argv.inputJson);
                    runTestProcess(filePath);
                });
            } else {
                console.error('You must specify an inputJson file to test with.')
                process.exit(1)
            }
        }
    )
    .help().argv

async function injectFileInWrapper(filePath: string) {
    const projectRoot = process.cwd();
    const buildPath = path.join(projectRoot, 'build');
    const buildLibPath = path.join(projectRoot, "build", "lib")

    // Ensure the dist directory exists
    if (!fs.existsSync(buildPath) || !fs.existsSync(buildLibPath)) {
        fs.mkdirSync(buildPath, { recursive: true });
        fs.mkdirSync(buildLibPath, { recursive: true });
    }

    let wrapperFilePath
    let versatusHelpersFilepath  = path.resolve(process.cwd(), "./lib/versatus")

    // Check if the script is running from within node_modules
    if (fs.existsSync(path.resolve(__dirname, '../../../../node_modules'))) {
        // In an installed package environment
        try {
            // @ts-ignore
            const wrapperModule = await import('@versatus/versatus-javascript/dist/lib/wrapper');
            // @ts-ignore
            const versatusHelpersModule = await import('@versatus/versatus-javascript/lib/versatus');
            wrapperFilePath = wrapperModule.default;
            versatusHelpersFilepath = versatusHelpersModule.default;

        } catch (error) {
            console.error('Error locating wrapper.js in node_modules:', error);
            throw error;
        }
    } else {
        console.log({__dirname})
        // In the development environment
        wrapperFilePath = path.resolve(__dirname, './lib/wrapper.js');
        versatusHelpersFilepath = path.resolve(__dirname, './lib/versatus');
    }

    // Copy the wrapper file to the build directory
    const distWrapperFilePath = path.join(buildPath, 'lib', 'wrapper.js');
    fs.copyFileSync(wrapperFilePath, distWrapperFilePath);

    try {
        let wrapperContent = fs.readFileSync(distWrapperFilePath, 'utf8');
        wrapperContent = wrapperContent.replace(
            /^import start from '.*';?$/m,
            `import start from '${filePath}';`
        );

        wrapperContent = wrapperContent.replace(
            /from '.*versatus';?$/m,
            `from '${versatusHelpersFilepath}.js'`
        );

        return fs.promises.writeFile(distWrapperFilePath, wrapperContent, 'utf8');
    } catch (error) {
        console.error('Error updating wrapper.js in dist:', error);
        throw error;
    }
}



function runBuildProcess() {
    const projectRoot = process.cwd();
    const distPath = path.join(projectRoot, 'dist');
    const buildPath = path.join(projectRoot, 'build');

    if (!fs.existsSync(distPath)) {
        console.log("Creating the 'dist' directory...");
        fs.mkdirSync(distPath, { recursive: true });
    }

    if (!fs.existsSync(buildPath)) {
        console.log("Creating the 'dist' directory...");
        fs.mkdirSync(buildPath, { recursive: true });
    }

    let webpackConfigPath;
    if (fs.existsSync(path.resolve(__dirname, '../../../../node_modules'))) {
        // In an installed package environment
        webpackConfigPath = path.resolve(projectRoot, 'node_modules', '@versatus', 'versatus-javascript', 'lib', 'webpack.config.cjs');
    } else {
        // In the development environment
        webpackConfigPath = path.resolve(__dirname, '../', 'lib', 'webpack.config.cjs');
    }
    const webpackCommand = `npx webpack --config ${webpackConfigPath}`;
    exec(webpackCommand, (webpackError, webpackStdout, webpackStderr) => {
        if (webpackError) {
            console.error(`Webpack exec error: ${webpackError}`);
            return;
        }
        console.log(`Webpack stdout: ${webpackStdout}`);
        if (webpackStderr) {
            console.error(`Webpack stderr: ${webpackStderr}`);
        }


        // Now run Javy
        const javyCommand = `javy compile ${path.join(buildPath, 'bundle.js')} -o ${path.join(buildPath, 'build.wasm')}`;
        exec(javyCommand, (javyError, javyStdout, javyStderr) => {
            if (javyError) {
                console.error(`Javy exec error: ${javyError}`);
                return;
            }
            if (javyStderr) {
                console.error(`Javy stderr: ${javyStderr}`);
            }
        });
    });
}


function runTestProcess(inputJsonPath: string) {
    let scriptDir: string;
    if (fs.existsSync(path.resolve(__dirname, '../../../node_modules'))) {
        // In an installed package environment
        scriptDir = path.resolve(__dirname, '../');
    } else {
        // In the development environment
        scriptDir = process.cwd();
    }
    const checkWasmScriptPath = path.resolve(scriptDir, "lib", 'scripts', 'check_wasm.sh');

    // Execute the check-wasm.sh script
    exec(`bash "${checkWasmScriptPath}"`, (checkWasmError, checkWasmStdout, checkWasmStderr) => {
        if (checkWasmError) {
            console.error(`check_wasm.sh exec error: ${checkWasmError}`);
            return;
        }
        console.log(`check-wasm.sh stdout: ${checkWasmStdout}`);
        console.log(`check-wasm.sh stderr: ${checkWasmStderr}`);

        console.log("check-wasm.sh script executed successfully. Proceeding with test...");


        // Continue with the rest of the test process after checking WASM
        // Define the path to the test.sh script
        const testScriptPath = path.resolve(scriptDir, "lib", 'scripts', 'test.sh');

        // Execute the test.sh script with the input JSON file path as an argument
        exec(`bash "${testScriptPath}" "${inputJsonPath}"`, (testError, testStdout, testStderr) => {
            if (testError) {
                console.error(`exec error: ${testError}`);
                return;
            }
            if (testStdout) {
                console.log(`stdout: ${testStdout}`);
            }
            if (testStderr) {
                console.error(`stderr: ${testStderr}`);
            }
        });
    });
}
