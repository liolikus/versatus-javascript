import { Program } from './Program'
import { ComputeInputs } from '../../types'
import { Outputs } from '../Outputs'

import {
  buildCreateInstruction,
  buildTransferInstruction,
  buildProgramUpdateField,
  buildUpdateInstruction,
  buildTokenUpdateField,
  buildTokenDistributionInstruction,
} from '../../builders'
import { THIS } from '../../consts'
import { AddressOrNamespace, TokenOrProgramUpdate } from '../utils'
import { ProgramUpdate } from '../Program'
import { formatVerse, parseVerse } from '../../utils'

/**
 * Class representing a faucet program, extending the base `Program` class.
 * It encapsulates the core functionality and properties of the write
 * functionality of a fungible token.
 */
export class FaucetProgram extends Program {
  /**
   * Constructs a new instance of the FungibleTokenProgram class.
   */
  constructor() {
    super()
    Object.assign(this.methodStrategies, {
      addProgram: this.addProgram.bind(this),
      create: this.create.bind(this),
      faucet: this.faucet.bind(this),
    })
  }

  addProgram(computeInputs: ComputeInputs) {
    const { transaction, accountInfo } = computeInputs
    const { transactionInputs: txInputsStr, from } = transaction
    const txInputs = JSON.parse(txInputsStr)
    const programToAdd = txInputs?.programAddress
    const flowAmountStr = txInputs?.flowAmount ?? '1'
    const flowAmount = formatVerse(flowAmountStr)
    const cycleTimeMin = txInputs?.cycleTimeMin ?? '1'

    const amountToAdd = parseVerse(txInputs?.amountToAdd)
    if (!amountToAdd) {
      throw new Error('Please specify how much your adding to the faucet pool')
    }

    const transferToFaucetInstruction = buildTransferInstruction({
      from: from,
      to: 'this',
      tokenAddress: programToAdd,
      amount: amountToAdd,
    })
    const faucetAccountData = accountInfo?.programAccountData
    const faucetProgramsStr = faucetAccountData?.programs
    if (!faucetProgramsStr) {
      throw new Error('Please create the program first.')
    }

    const faucetPrograms = JSON.parse(faucetProgramsStr)
    if (faucetPrograms[programToAdd]) {
      return new Outputs(computeInputs, [transferToFaucetInstruction]).toJson()
    }

    const faucetUpdate = buildProgramUpdateField({
      field: 'data',
      value: JSON.stringify({
        programs: JSON.stringify({
          ...faucetPrograms,
          [programToAdd]: JSON.stringify({
            pipeData: JSON.stringify({
              flowAmount,
              cycleTimeMin,
            }),
            recipients: JSON.stringify({}),
          }),
        }),
      }),
      action: 'extend',
    })
    if (faucetUpdate instanceof Error) {
      throw faucetUpdate
    }

    const faucetDataUpdateInstruction = buildUpdateInstruction({
      update: new TokenOrProgramUpdate(
        'programUpdate',
        new ProgramUpdate(new AddressOrNamespace(THIS), [faucetUpdate])
      ),
    })

    return new Outputs(computeInputs, [
      transferToFaucetInstruction,
      faucetDataUpdateInstruction,
    ]).toJson()
  }

  create(computeInputs: ComputeInputs) {
    const { transaction } = computeInputs
    const { transactionInputs } = transaction

    const faucetInitInstruction = buildTokenDistributionInstruction({
      programId: THIS,
      to: transaction.from,
      initializedSupply: formatVerse('1'),
    })

    const createInstruction = buildCreateInstruction({
      from: transaction.from,
      programId: THIS,
      programOwner: transaction.from,
      totalSupply: formatVerse('1'),
      initializedSupply: formatVerse('1'),
      programNamespace: THIS,
      distributionInstruction: faucetInitInstruction,
    })

    const faucetRecipientsInit = buildProgramUpdateField({
      field: 'data',
      value: JSON.stringify({
        programs: JSON.stringify({}),
      }),
      action: 'extend',
    })

    if (faucetRecipientsInit instanceof Error) {
      throw faucetRecipientsInit
    }

    const createSupportedProgramsAndRecipientsUpdateInstruction =
      buildUpdateInstruction({
        update: new TokenOrProgramUpdate(
          'programUpdate',
          new ProgramUpdate(new AddressOrNamespace(THIS), [
            faucetRecipientsInit,
          ])
        ),
      })

    const programUpdateField = buildProgramUpdateField({
      field: 'metadata',
      value: transactionInputs,
      action: 'extend',
    })

    if (programUpdateField instanceof Error) {
      throw programUpdateField
    }

    const programUpdates = [programUpdateField]

    const programMetadataUpdateInstruction = buildUpdateInstruction({
      update: new TokenOrProgramUpdate(
        'programUpdate',
        new ProgramUpdate(new AddressOrNamespace(THIS), programUpdates)
      ),
    })

    return new Outputs(computeInputs, [
      createInstruction,
      programMetadataUpdateInstruction,
      createSupportedProgramsAndRecipientsUpdateInstruction,
    ]).toJson()
  }

  faucet(computeInputs: ComputeInputs) {
    const { transaction, accountInfo } = computeInputs
    const { transactionInputs, from } = transaction
    const parsedInputMetadata = JSON.parse(transactionInputs)
    const to = parsedInputMetadata?.to
    const programToSend = parsedInputMetadata?.programAddress

    const faucetAccountData = accountInfo?.programAccountData

    if (!faucetAccountData) {
      throw new Error('Faucet not initialized')
    }

    const supportedProgramsStr = faucetAccountData.programs
    if (!supportedProgramsStr) {
      throw new Error('No programs found. Faucet is not initialized.')
    }

    const programsMap = JSON.parse(supportedProgramsStr)
    if (!programsMap) {
      throw new Error('Requested program not found')
    }

    const programMap = programsMap[programToSend]
    if (!programMap) {
      throw new Error('Desired program not found')
    }

    const faucetProgramDetails = JSON.parse(programsMap[programToSend])
    if (!faucetProgramDetails) {
      throw new Error('No program details found. Faucet is not initialized.')
    }

    const faucetProgramData = faucetProgramDetails.pipeData
    if (!faucetProgramData) {
      throw new Error('Faucet pipeData not found')
    }

    const amountToFaucet = parseVerse(faucetProgramData.flowAmount ?? '1')
    const cycleTimeMin = faucetProgramData.cycleTimeMin ?? '1'
    const recipients = faucetProgramDetails.recipients

    if (!recipients) {
      throw new Error('No recipients object found.  Faucet is not initialized.')
    }

    const faucetRecipientCanClaim = canClaimTokens(to, recipients, cycleTimeMin)
    if (!faucetRecipientCanClaim) {
      throw new Error('Too soon to claim tokens.')
    }

    const currentTime = new Date().getTime()
    const faucetRecipientsUpdate = buildProgramUpdateField({
      field: 'data',
      value: JSON.stringify({
        programs: JSON.stringify({
          [programToSend]: JSON.stringify({
            recipients: JSON.stringify({ [to]: currentTime }),
          }),
        }),
      }),
      action: 'extend',
    })

    if (faucetRecipientsUpdate instanceof Error) {
      throw faucetRecipientsUpdate
    }

    const programUpdates = [faucetRecipientsUpdate]

    const faucetDataUpdateInstruction = buildUpdateInstruction({
      update: new TokenOrProgramUpdate(
        'programUpdate',
        new ProgramUpdate(new AddressOrNamespace(THIS), programUpdates)
      ),
    })

    const transferToCaller = buildTransferInstruction({
      from: 'this',
      to: to,
      tokenAddress: programToSend,
      amount: amountToFaucet,
    })

    return new Outputs(computeInputs, [
      transferToCaller,
      faucetDataUpdateInstruction,
    ]).toJson()
  }
}

function canClaimTokens(
  recipientAddress: string,
  recipients: any,
  cycleTimeMin: string = '1'
) {
  const currentTime = new Date().getTime()
  const lastClaimTime = recipients[recipientAddress]
  if (lastClaimTime === undefined) {
    return true
  }

  const parsedCycleTimeMin = parseInt(cycleTimeMin)
  const oneHour = 60 * 1000 * parsedCycleTimeMin
  const timeSinceLastClaim = currentTime - lastClaimTime
  // console.log(
  //   'timeSinceLastClaim',
  //   timeSinceLastClaim,
  //   oneHour,
  //   currentTime,
  //   lastClaimTime
  // )
  return timeSinceLastClaim >= oneHour
}
