

export interface  RaptorEncodeCommand {
  message: Uint8Array,
  maximum_transmission_unit: number
  repair_packets_per_block: numer
}
export interface RaptorEncodingResult {
  config: Uint8Array,
  packets: Uint8Array[]
}

export interface RaptorDecodingResult {
  message: Uint8Array,
}

export interface Raptor {
  encode: (command: RaptorEncodeCommand) => RaptorEncodingResult
  decode: (encoded: RaptorEncodingResult) => RaptorDecodingResult
}
