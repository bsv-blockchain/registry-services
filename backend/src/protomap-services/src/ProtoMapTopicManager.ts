import { AdmittanceInstructions, TopicManager } from '@bsv/overlay'
import { KeyDeriver, PushDrop, Signature, Transaction } from '@bsv/sdk'
import docs from './docs/ProtoMapTopicManagerDocs.md.js'

/**
 * Implements a topic manager for ProtoMap name registry
 * @public
 */
export default class ProtoMapTopicManager implements TopicManager {
  /**
   * Returns the outputs from the ProtoMap transaction that are admissible.
   * @param beef - The transaction data in BEEF format
   * @param previousCoins - The previous coins to consider
   * @returns A promise that resolves with the admittance instructions
   */
  async identifyAdmissibleOutputs(beef: number[], previousCoins: number[]): Promise<AdmittanceInstructions> {
    const outputsToAdmit: number[] = []
    try {
      const parsedTransaction = Transaction.fromBEEF(beef)

      // Validate params
      if (!Array.isArray(parsedTransaction.inputs) || parsedTransaction.inputs.length < 1) {
        throw new Error('Transaction inputs must be valid')
      }
      if (!Array.isArray(parsedTransaction.outputs) || parsedTransaction.outputs.length < 1) {
        throw new Error('Transaction outputs must be valid')
      }

      // Try to decode and validate transaction outputs
      for (const [i, output] of parsedTransaction.outputs.entries()) {
        // Decode the ProtoMap registration data
        try {
          const { fields, lockingPublicKey } = PushDrop.decode(output.lockingScript)

          // Parse and validate protocol registration data
          const securityLevel = fields[0].toString()
          const protocolID = fields[1].toString()
          const name = fields[2].toString()
          const iconURL = fields[3].toString()
          const description = fields[4].toString()
          const documentationURL = fields[5].toString()
          const registryOperator = fields[6].toString()

          if (securityLevel !== '0' && securityLevel !== '1' && securityLevel !== '2') {
            throw new Error('Invalid security level')
          }
          if (protocolID === undefined || typeof protocolID !== 'string') {
            throw new Error('Invalid protocol ID')
          }
          if (name === undefined || typeof name !== 'string') {
            throw new Error('Invalid name')
          }
          if (iconURL === undefined || typeof iconURL !== 'string') {
            throw new Error('Invalid iconURL')
          }
          if (description === undefined || typeof description !== 'string') {
            throw new Error('Invalid description')
          }
          if (documentationURL === undefined || typeof documentationURL !== 'string') {
            throw new Error('Invalid documentationURL')
          }
          if (registryOperator === undefined || typeof registryOperator !== 'string') {
            throw new Error('Invalid registryOperator')
          }

          // Ensure lockingPublicKey came from fields[0]
          const keyDeriver = new KeyDeriver('anyone')
          const expected = keyDeriver.derivePublicKey(
            [1, 'protomap'],
            '1',
            registryOperator
          )

          // Make sure keys match
          if (expected !== lockingPublicKey) throw new Error('ProtMap token not linked to registry operator!')

          // Verify the signature
          const hasValidSignature = lockingPublicKey.verify(
            fields.flatMap(field => Array.from(field)),
            Signature.fromDER(fields[-1], 'hex')
          )
          if (!hasValidSignature) throw new Error('Invalid signature!')

          outputsToAdmit.push(i)
        } catch (error) {
          // It's common for other outputs to be invalid; no need to log an error here
          continue
        }
      }
      if (outputsToAdmit.length === 0) {
        throw new Error('No outputs admitted!')
      }

      // Returns an array of outputs admitted
      // And previousOutputsRetained (none by default)
      return {
        outputsToAdmit,
        coinsToRetain: []
      }
    } catch (error) {
      // Only log an error if no outputs were admitted and no previous coins consumed
      if (outputsToAdmit.length === 0 && (previousCoins === undefined || previousCoins.length === 0)) {
        console.error('Error identifying admissible outputs:', error)
      }
    }
    return {
      outputsToAdmit,
      coinsToRetain: []
    }
  }

  /**
   * Returns the documentation for the ProtoMap topic
   * @public
   * @returns {Promise<string>} - the documentation given as a string
   */
  async getDocumentation(): Promise<string> {
    return docs
  }

  /**
   * Get metadata about the topic manager
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
      name: 'ProtoMap Topic Manager',
      shortDescription: 'Protocol information registration'
    }
  }
}
