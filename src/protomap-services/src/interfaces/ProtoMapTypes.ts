export interface ProtoMapLookupQuery {
  registryOperators: string[]
  securityLevel: number
  protocolID: string
  name: string
}

export interface UTXOReference {
  txid: string
  outputIndex: number
}

export interface ProtoMapRegistration {
  registryOperator: string
  securityLevel: number
  protocolID: string
  name: string
}

export interface ProtoMapRecord {
  txid: string
  outputIndex: number
  registration: ProtoMapRegistration
  createdAt: Date
}