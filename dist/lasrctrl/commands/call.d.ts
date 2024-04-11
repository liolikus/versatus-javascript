import { Arguments, CommandBuilder } from 'yargs';
export interface CallCommandArgs {
    programAddress: string;
    op: string;
    txInputs: string;
    network: string;
    keypairPath?: string;
    secretKey?: string;
}
export declare const callCommandFlags: CommandBuilder<{}, CallCommandArgs>;
declare const call: (argv: Arguments<CallCommandArgs>) => Promise<void>;
export default call;
