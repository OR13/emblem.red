"use client"
import { useState } from "react"
import Theme from "@/components/Theme"
import AppDrawer from "@/components/AppDrawer"
import FileUploader from "@/components/FileUploader"
import RaptorCodes from "../RaptorCodes/RaptorCodes"
import {Box} from '@mui/material'
const readAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = () => resolve(fileReader.result as string);
      fileReader.readAsDataURL(file);
  });
}

export default function Create({asset}: {asset?: string}) {
  const [dataURL, setDataURL] = useState<string | undefined>(asset)
  const onFilesAccepted = async (files: File[]) => {
    const [file] = files
    const dataURL = await readAsDataURL(file)
    setDataURL(dataURL)
  }
  return (
    <Theme>
      <AppDrawer>
        <Box sx={{p: 2}}>
        {
          !dataURL ? <>
            <FileUploader onFilesAccepted={onFilesAccepted} />
          </> : <>
            <RaptorCodes dataURL={dataURL} />
          </>
        }
        </Box>
        
      </AppDrawer>
    </Theme>

  )
}
