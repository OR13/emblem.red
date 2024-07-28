"use client"
import * as React from 'react';
import { useState } from "react"
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import Scanner from "../Scanner/Scanner"
import LinearProgress from '@mui/material/LinearProgress';
import TextField from '@mui/material/TextField';


import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Theme from "@/components/Theme"
import AppDrawer from "@/components/AppDrawer"

import { raptor, downloader } from "@/utils";

export default function Scan() {

  const [scanning, setScanning] = useState(true)
  const [config, setConfig] = useState<Uint8Array>()
  const [packets, setPackets] = useState<Array<Uint8Array>>([])
  const [dataURL, setDataURL] = useState<string>()
  const [ednText, setEdnText] = useState<string>('')

  const onScan = async (text: string) => {
    try {
      const result = raptor.processScan(text, packets)
      if (result.config) {
        setConfig(result.config)
      } else {
        setPackets(result.packets)
        if (config) {
          try {
            const dataURL = await raptor.decode({
              config,
              packets: result.packets
            })
            setDataURL(dataURL)
            toast.success("Emblem verified.")
            const ednText = new TextDecoder().decode(Buffer.from(dataURL.replace('data:application/cbor-diagnostic;base64,', ''), 'base64'))
            setEdnText(ednText)
            setScanning(false)
          } catch (e2) {
            console.log(e2)
          }
        }
      }
    } catch (e) {
      console.log(e)
    }
  }

  return (
    <Theme>
      <AppDrawer>
        {scanning ? <Box
          justifyContent="center"
          alignItems="center">
          <LinearProgress /> {
            !config ? <Box >
              <Typography sx={{ p: 2, textAlign: 'center' }} >Searching for emblem...</Typography>
            </Box> :
              <Box >
                <Typography sx={{ p: 2, textAlign: 'center' }} >Decoding emblem...</Typography>
              </Box>
          }
          <Box
            display={'flex'}
            justifyContent="center"
            alignItems="center">
            <Scanner onScan={onScan} />
          </Box>
        </Box> :
          <Box justifyContent="center"
            alignItems="center"
            sx={{ p: 2 }}>
            <Typography sx={{ p: 2, textAlign: 'center' }} >✅ Emblem verified.</Typography>
            <TextField
              label="Extended Diagnostic Notation (EDN)"
              fullWidth
              multiline
              disabled
              value={ednText}
              sx={{ mb: 4 }}
            />
            <Button variant="contained" endIcon={<CloudDownloadIcon />} onClick={() => {
              if (dataURL) {
                downloader(dataURL, 'emblem.diag')
              }
            }}>
              Download
            </Button>
          </Box>}
        <ToastContainer theme='dark'/>
      </AppDrawer>
    </Theme>
  )
}
