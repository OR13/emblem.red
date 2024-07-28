


import pako from 'pako'
import { QRCode } from '@ali1416/qrcode-encoder'

import b45 from 'base45-web'

import type { Raptor, RaptorEncodingResult } from '../wraptor'

/**
 * 二维码boolean[][]转SVG路径
 * @param bytes boolean[][]
 * @param pixelSize 像素尺寸
 * @return string SVG
 */
function QrMatrix2SvgPath(bytes: Array<boolean[]>, pixelSize: number) {
  let length = bytes.length;
  let size = (length + 2) * pixelSize;
  let svg = "<svg width=\"" + size + "\" height=\"" + size + "\" viewBox=\"0 0 " + size + " " + size + "\" xmlns=\"http://www.w3.org/2000/svg\">\n";
  svg += "<path d=\"\n";
  for (let x = 0; x < length; x++) {
    for (let y = 0; y < length; y++) {
      if (bytes[x][y]) {
        let xx = (x + 1) * pixelSize;
        let yy = (y + 1) * pixelSize;
        svg += "M" + xx + " " + yy + "H" + (xx + pixelSize) + "V" + (yy + pixelSize) + "H" + xx + "z\n"
      }
    }
  }
  svg += "\"/>";
  svg += "</svg>\n";
  return svg;
}

const binaryToQrCode = (data: Uint8Array) => {
  const base45Encoded = b45.encode(data)
  const content = base45Encoded;
  const qr = new QRCode(content);
  const img = `data:image/svg+xml,${encodeURIComponent(QrMatrix2SvgPath(qr.Matrix, 10))}`
  return img
}


const encode = async (dataURL: string): Promise<string[]> =>{
  const message = new TextEncoder().encode(dataURL);
  const raptor: Raptor = await import('../wraptor/pkg');
  const encoded = raptor.encode({
    message,
    maximum_transmission_unit: 1024,
    repair_packets_per_block: 5
  })
  const config = binaryToQrCode(encoded.config)
  const packets = encoded.packets.map((p) => {
    let packet = new Uint8Array(p);
    packet = pako.deflate(packet);
    return binaryToQrCode(packet)
  })
  return [config, ...packets]
}

const decode = async ({ config, packets }: RaptorEncodingResult) => {
  const raptor: Raptor = await import('../wraptor/pkg');
  const decoded = raptor.decode({
    config,
    packets
  })
  const content = new Uint8Array(decoded.message);
  const dataURL = new TextDecoder().decode(content)
  return dataURL
}

// qr code reader will read base45 text
// this function decompresses that text into
// RaptorEncodingResult which is required to 
// decode the original message
const processScan = (text: string, packets: Array<Uint8Array> = []) => {
  const data = new Uint8Array(b45.decode(text))
  let config;
  if (data.byteLength === 12) {
    config = data;
  } else {
    let packet = data;
    packet = pako.inflate(data);
    packets.push(packet);
  }
  return { config, packets }
}

export const raptor = {
  encode,
  processScan,
  decode
}