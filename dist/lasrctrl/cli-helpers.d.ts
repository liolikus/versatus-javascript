import { NETWORK } from '@/lib/types';
export declare const isInstalledPackage: boolean;
export declare const isTypeScriptProject: () => boolean;
export declare const installedPackagePath: string;
export declare function copyDirectory(src: string, dest: string): void;
export declare function runBuildProcess(programFilePath: string): Promise<void>;
export declare function buildNode(buildPath: string): Promise<void>;
export declare function getSecretKeyFromKeyPairFile(keypairFilePath: string): Promise<string>;
export declare function getAddressFromKeyPairFile(keypairFilePath: string): Promise<string>;
export declare function registerProgram(cid: string, secretKey: string, network: 'stable' | 'test'): Promise<string>;
export declare const getSecretKey: (secretKeyPath?: string, secretKey?: string) => Promise<string>;
export declare function callCreate(programAddress: string, symbol: string, name: string, initializedSupply: string, totalSupply: string, recipientAddress: string, network: NETWORK, secretKey: string, inputs?: string): Promise<string>;
export declare function sendTokens(programAddress: string, recipientAddress: string, amount: string, secretKey: string, network: 'stable' | 'test'): Promise<string>;
export declare function callProgram(programAddress: string, op: string, inputs: string, network: NETWORK, secretKey: string): Promise<string>;
export declare function runTestProcess(inputJsonPath: string, target?: string, showOutput?: boolean): Promise<unknown>;
export declare function initializeWallet(): Promise<void>;
export declare function checkWallet(address: string): Promise<void>;
