import { CertMapStorageManager } from './CertMapStorageManager.js'
import { LookupAnswer, LookupFormula, LookupQuestion, LookupService } from '@bsv/overlay'
import { PushDrop, Script } from '@bsv/sdk'
import { CertMapRegistration } from './interfaces/CertMapTypes.js'
import docs from './docs/CertMapLookupServiceDocs.md.js'
import { Db } from 'mongodb'

interface CertMapQuery {
  type?: string
  name?: string
  registryOperators?: string[]
}

/**
 * Implements a lookup service for CertMap name registry
 * @public
 */
class CertMapLookupService implements LookupService {
  /**
   * Constructs a new CertMap Lookup Service instance
   * @public
   * @param storageEngine
   */
  constructor(public storageEngine: CertMapStorageManager) { }

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
    if (topic !== 'tm_certmap') return

    // Decode the CertMap token fields from the Bitcoin outputScript
    const { fields } = PushDrop.decode(outputScript)

    // Parse record data correctly from field and validate it
    const type = fields[0].toString()
    const name = fields[1].toString()
    const registryOperator = fields[6].toString()

    const registration: CertMapRegistration = {
      type,
      name,
      registryOperator
    }

    // Store certificate type registration in the StorageEngine
    await this.storageEngine.storeRecord(
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
    if (topic !== 'tm_certmap') return
    await this.storageEngine.deleteRecord(txid, outputIndex)
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

    if (question.service !== 'ls_certmap') {
      throw new Error('Lookup service not supported!')
    }

    const questionToAnswer = (question.query as CertMapQuery)

    let results
    if (questionToAnswer.type !== undefined && questionToAnswer.registryOperators !== undefined) {
      results = await this.storageEngine.findByType(
        questionToAnswer.type,
        questionToAnswer.registryOperators
      )
      return results
    } else if (questionToAnswer.name !== undefined && questionToAnswer.registryOperators !== undefined) {
      results = await this.storageEngine.findByName(
        questionToAnswer.name,
        questionToAnswer.registryOperators
      )
      return results
    } else {
      throw new Error('type, name, and registryOperator must be valid params')
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
      name: 'CertMap Lookup Service',
      shortDescription: 'Certificate information registration'
    }
  }
}

// Factory function
export default (db: Db): CertMapLookupService => {
  return new CertMapLookupService(new CertMapStorageManager(db))
}
