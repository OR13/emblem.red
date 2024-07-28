use wasm_bindgen::prelude::*;
use raptorq::{Decoder, Encoder, EncodingPacket, ObjectTransmissionInformation};

use std::str;
use serde::{Serialize, Deserialize};


#[derive(Serialize, Deserialize)]
pub struct EncodeCommand {
    pub message: Vec<u8>,
    pub maximum_transmission_unit: u16,
    pub repair_packets_per_block: u32
}

#[derive(Serialize, Deserialize)]
pub struct EncodeResult {
    pub config: [u8; 12],
    pub packets: Vec<Vec<u8>>
}

#[derive(Serialize, Deserialize)]
pub struct DecodeResult {
    pub message: Vec<u8>
}

#[wasm_bindgen]
pub fn encode(js_value: JsValue) -> JsValue {
    let EncodeCommand { message, maximum_transmission_unit, repair_packets_per_block }  = serde_wasm_bindgen::from_value(js_value).unwrap();
    let encoder = Encoder::with_defaults(&message, maximum_transmission_unit);
    let config = encoder.get_config().serialize();
    // Perform the encoding, and serialize to Vec<u8> for transmission
    let packets: Vec<Vec<u8>> = encoder
        .get_encoded_packets(repair_packets_per_block)
        .iter()
        .map(|packet| packet.serialize())
        .collect();
    let result = EncodeResult {
        config,
        packets
    };
    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[wasm_bindgen]
pub fn decode(js_value: JsValue) -> JsValue {
    let EncodeResult { config, mut packets }  = serde_wasm_bindgen::from_value(js_value).unwrap();
    let deserialized_config = ObjectTransmissionInformation::deserialize(&config);
    let mut decoder = Decoder::new(deserialized_config);
    let mut decoded = None;
    while !packets.is_empty() {
        decoded = decoder.decode(EncodingPacket::deserialize(&packets.pop().unwrap()));
        if decoded.is_some() {
            break;
        }
    }
    let result = DecodeResult {
        message: decoded.unwrap()
    };
    serde_wasm_bindgen::to_value(&result).unwrap()
}
