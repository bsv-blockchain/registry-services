import { Collection, Db } from 'mongodb'
import { ProtoMapRegistration, ProtoMapRecord, UTXOReference } from './interfaces/ProtoMapTypes.js'

/**
 * Implements a Lookup StorageManager for ProtoMap name registry
 * @public
 */
export class ProtoMapStorageManager {
  private readonly records: Collection<ProtoMapRecord>

  /**
   * Constructs a new ProtoMapStorageManager instance
   * @public
   * @param db - connected mongo database instance
   */
  constructor(private readonly db: Db) {
    this.records = db.collection<ProtoMapRecord>('protomapRecords')
  }

  /**
   * @public
   * @param txid
   * @param outputIndex
   * @param certificate
   */
  async storeRecord(txid: string, outputIndex: number, registration: ProtoMapRegistration): Promise<void> {
    // Insert new record
    await this.records.insertOne({
      txid,
      outputIndex,
      registration,
      createdAt: new Date()
    })
  }

  /**
   * Delete a matching ProtoMap record
   * @public
   * @param txid
   * @param outputIndex
   */
  async deleteRecord(txid: string, outputIndex: number): Promise<void> {
    await this.records.deleteOne({ txid, outputIndex })
  }

  // Custom ProtoMap Lookup Functions --------------------------------------------------------------

  /**
   * Find protocol registration by name
   * @public
   * @param name
   * @param registryOperator
   * @returns
   */
  async findByName(name: string, registryOperators: string[]): Promise<object> {
    // Find matching results from the DB
    return await this.findRecordWithQuery({
      'registration.registryOperator': { $in: registryOperators },
      'registration.name': name
    })
  }

  /**
  * Find token by protocolID and securityLevel
  * @public
  * @param protocolID
  * @param securityLevel
  * @param registryOperators
  * @returns
  */
  async findByProtocolIDAndSecurityLevel(protocolID: string, securityLevel: number, registryOperators: string[]): Promise<object> {
    // Find matching results from the DB
    return await this.findRecordWithQuery({
      'registration.protocolID': protocolID,
      $or: [
        { 'registration.securityLevel': securityLevel },
        { 'registration.securityLevel': securityLevel.toString() }
      ],
      'registration.registryOperator': { $in: registryOperators },
    })
  }

  /**
   * Helper function for querying from the database
   * @param query
   * @returns
   */
  private async findRecordWithQuery(query: object): Promise<UTXOReference[]> {
    // Find matching results from the DB
    const results = await this.records.find(query).project({ txid: 1, outputIndex: 1 }).toArray()

    // Convert array of Documents to UTXOReferences
    const parsedResults: UTXOReference[] = results.map(record => ({
      txid: record.txid,
      outputIndex: record.outputIndex
    }))
    return parsedResults
  }
}
