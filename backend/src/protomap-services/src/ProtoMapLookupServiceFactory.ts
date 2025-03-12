import { ProtoMapStorageManager } from './ProtoMapStorageManager.js'
import { LookupAnswer, LookupFormula, LookupQuestion, LookupService } from '@bsv/overlay'
import { PushDrop, Script } from '@bsv/sdk'
import { ProtoMapRegistration } from './interfaces/ProtoMapTypes.js'
import docs from './docs/ProtoMapLookupServiceDocs.md.js'
import { Db } from 'mongodb'

interface ProtoMapQuery {
  name?: string
  registryOperators?: string[]
  protocolID?: string
  securityLevel?: number
}

/**
 * Implements a lookup service for ProtoMap name registry
 * @public
 */
class ProtoMapLookupService implements LookupService {
  /**
   * Constructs a new ProtoMap Lookup Service instance
   * @public
   * @param storageManager
   */
  constructor(public storageManager: ProtoMapStorageManager) { }

  /**
   * Notifies the lookup service of a new output added.
   *
   * @param {string} txid - The transaction ID containing the output.
   * @param {number} outputIndex - The index of the output in the transaction.
   * @param {Script} outputScript - The script of the output to be processed.
   * @param {string} topic - The topic associated with the output.
   *
   * @returns {Promise<void>} A promise that resolves when the processing is complete.
   * @throws Will throw an error if there is an issue with storing the record in the storage engine.
   */
  async outputAdded(txid: string, outputIndex: number, outputScript: Script, topic: string): Promise<void> {
    if (topic !== 'tm_protomap') return

    // Decode the ProtoMap token fields from the Bitcoin outputScript
    const { fields } = PushDrop.decode(outputScript)

    // Parse record data correctly from field and validate it
    const securityLevel = fields[0].toString()
    const protocolID = fields[1].toString()
    const name = fields[2].toString()
    const registryOperator = fields[6].toString()

    const registration: ProtoMapRegistration = {
      registryOperator,
      securityLevel: Number(securityLevel), // Note: consider WalletProtocol compatibility
      protocolID, // Should this just be a stringified WalletProtocol?
      name
    }

    // Store protocol registration
    await this.storageManager.storeRecord(
      txid,
      outputIndex,
      registration
    )
  }

  /**
   * Deletes the output record once the UTXO has been spent
   *
   * @param {string} txid - The transaction ID of the spent output.
   * @param {number} outputIndex - The index of the spent output.
   * @param {string} topic - The topic associated with the spent output.
   *
   * @returns {Promise<void>} A promise that resolves when the processing is complete.
   * @throws Will throw an error if there is an issue with deleting the record from the storage engine.
   */
  async outputSpent(txid: string, outputIndex: number, topic: string): Promise<void> {
    if (topic !== 'tm_protomap') return
    await this.storageManager.deleteRecord(txid, outputIndex)
  }

  /**
   * Answers a lookup query
   * @param question - The lookup question to be answered
   * @returns A promise that resolves to a lookup answer or formula
   */
  async lookup(question: LookupQuestion): Promise<LookupAnswer | LookupFormula> {
    // Validate Params
    if (question.query === undefined || question.query === null) {
      throw new Error('A valid query must be provided!')
    }

    if (question.service !== 'ls_protomap') {
      throw new Error('Lookup service not supported!')
    }

    const questionToAnswer = (question.query as ProtoMapQuery)

    let results
    if (questionToAnswer.name !== undefined && questionToAnswer.registryOperators !== undefined) {
      results = await this.storageManager.findByName(
        questionToAnswer.name,
        questionToAnswer.registryOperators
      )
      return results
    } else if (questionToAnswer.protocolID !== undefined && questionToAnswer.securityLevel !== undefined && questionToAnswer.registryOperators !== undefined) {
      results = await this.storageManager.findByProtocolIDAndSecurityLevel(
        questionToAnswer.protocolID,
        questionToAnswer.securityLevel,
        questionToAnswer.registryOperators
      )
      return results
    } else {
      throw new Error('name, registryOperators, protocolID, or securityLevel must be valid params')
    }
  }

  // Optional method
  // /**
  //  *
  //  * @param output
  //  * @param currentDepth
  //  * @param historyRequested
  //  * @returns
  //  */
  // private async historySelector(output, currentDepth, historyRequested) {
  //   try {
  //     if (historyRequested === false && currentDepth > 0) return false
  //   } catch (error) {
  //     // Probably not a PushDrop token so do nothing
  //   }
  //   return true
  // }

  /**
   * Returns documentation specific to this overlay lookup service
   * @returns A promise that resolves to the documentation string
   */
  async getDocumentation(): Promise<string> {
    return docs
  }

  /**
   * Returns metadata associated with this lookup service
   * @returns A promise that resolves to an object containing metadata
   * @throws An error indicating the method is not implemented
   */
  async getMetaData(): Promise<{
    name: string
    shortDescription: string
    iconURL?: string
    version?: string
    informationURL?: string
  }> {
    return {
      name: 'ls_protomap',
      shortDescription: 'Protocol name resolution'
    }
  }
}

// Factory function
export default (db: Db): ProtoMapLookupService => {
  return new ProtoMapLookupService(new ProtoMapStorageManager(db))
}
