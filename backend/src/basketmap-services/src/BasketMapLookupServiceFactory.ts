import { BasketMapStorageManager } from './BasketMapStorageManager.js'
import { LookupAnswer, LookupFormula, LookupQuestion, LookupService } from '@bsv/overlay'
import { Script, PushDrop, Utils } from '@bsv/sdk'
import { BasketMapQuery, BasketMapRegistration } from './interfaces/BasketMapTypes.js'
import docs from './docs/BasketMapLookupDocs.md.js'
import { Db } from 'mongodb'

/**
 * Implements a lookup service for BasketMap name registry
 * @public
 */
class BasketMapLookupService implements LookupService {
  /**
   * Constructs a new BasketMap Lookup Service instance
   * @param storageManager
   */
  constructor(public storageManager: BasketMapStorageManager) { }

  /**
   * Notifies the lookup service of a new output added.
   * @param txid - The transaction ID containing the output.
   * @param outputIndex - The index of the output in the transaction.
   * @param outputScript - The script of the output to be processed.
   * @param topic - The topic associated with the output.
   * @returns A promise that resolves when the processing is complete.
   * @throws Will throw an error if there is an issue with storing the record in the storage engine.
   */
  async outputAdded(txid: string, outputIndex: number, outputScript: Script, topic: string): Promise<void> {
    if (topic !== 'tm_basketmap') return

    // Decode the BasketMap token fields from the Bitcoin outputScript
    const { fields } = PushDrop.decode(outputScript)

    // Parse record data correctly from field and validate it
    const basketID = Utils.toUTF8(fields[0])
    const name = Utils.toUTF8(fields[1])
    const registryOperator = Utils.toUTF8(fields[5])

    const registration: BasketMapRegistration = {
      basketID,
      name,
      registryOperator
    }

    // Store Basket type registration
    await this.storageManager.storeRecord(
      txid,
      outputIndex,
      registration
    )
  }

  /**
   * Deletes the output record once the UTXO has been spent
   * @param txid - The transaction ID of the spent output.
   * @param outputIndex - The index of the spent output.
   * @param topic - The topic associated with the spent output.
   * @returns A promise that resolves when the processing is complete.
   * @throws Will throw an error if there is an issue with deleting the record from the storage engine.
   */
  async outputSpent(txid: string, outputIndex: number, topic: string): Promise<void> {
    if (topic !== 'tm_basketmap') return
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

    if (question.service !== 'ls_basketmap') {
      throw new Error('Lookup service not supported!')
    }

    const questionToAnswer = (question.query as BasketMapQuery)

    let results
    if (questionToAnswer.basketID !== undefined && questionToAnswer.registryOperators !== undefined) {
      results = await this.storageManager.findById(
        questionToAnswer.basketID,
        questionToAnswer.registryOperators
      )
      return results
    } else if (questionToAnswer.name !== undefined && questionToAnswer.registryOperators !== undefined) {
      results = await this.storageManager.findByName(
        questionToAnswer.name,
        questionToAnswer.registryOperators
      )
      return results
    } else {
      throw new Error('basketID, name, or registryOperator is missing!')
    }
  }

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
      name: 'BasketMap Lookup Service',
      shortDescription: 'Basket name resolution'
    }
  }
}

// Factory function
export default (db: Db): BasketMapLookupService => {
  return new BasketMapLookupService(new BasketMapStorageManager(db))
}
