"use client"
import * as React from 'react';
import { useState } from "react"
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import Scanner from "../Scanner/Scanner"
import CircularProgress from '@mui/material/CircularProgress';
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

  const onScan = async (text: string) => {
    try {
      const result = raptor.processScan(text, packets)
      if (result.config){
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
            toast("Life finds a way.")
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
        {scanning ? <> {!config ? <>
          <Box sx={{ display: 'flex' }}>
            <CircularProgress />
            <Typography sx={{ p: 2 }} >Searching for transmission...</Typography>
          </Box>
        </> : <>
          <Box sx={{ display: 'flex' }}>
            <CircularProgress />
            <Typography sx={{ p: 2 }} >Gathering packets...</Typography>
          </Box>
        </>}
          <Scanner onScan={onScan} />
        </> :
          <Box>
            <Typography sx={{ pb: 2 }} >Transmission recieved.</Typography>
            <Button variant="contained" endIcon={<CloudDownloadIcon />} onClick={() => {
              if (dataURL) {
                downloader(dataURL, 'message.txt')
              }
            }}>
              Download
            </Button>
          </Box>}
        <ToastContainer />
      </AppDrawer>
    </Theme>
  )
}
