"use client"

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

import { Paper, Typography } from '@mui/material';

import { theme } from '../Theme'

const FileUploader = ({ onFilesAccepted, sx, dragText,dropText }:any) => {
  const onDrop = useCallback(
    (acceptedFiles:any) => {
      onFilesAccepted(acceptedFiles);
    },
    [onFilesAccepted]
  );
  const { getRootProps, getInputProps, isDragActive }:any = useDropzone({ onDrop });

  return (
    <Paper
      {...getRootProps()}
      align="center"
      style={{
        background: !isDragActive
          ? theme.palette.background.paper
          : theme.palette.background.paper,
        border: !isDragActive
          ? '1px ' + theme.palette.primary.main + ' dashed'
          : '1px ' + theme.palette.secondary.main + ' dashed',
        boxShadow: 'none',
        textAlign: 'center',
        cursor: 'pointer'
      }}
      sx={{
        height: 96,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        ...sx
      }}
    >
      <input {...getInputProps()} />
      {isDragActive ? (
        <Typography color={theme.palette.secondary.main}>
          {dropText || 'Drop the file here.'}
        </Typography>
      ) : (
        <Typography color={theme.palette.primary.main}>
          {dragText || 'Drag a small file (Test Asset) here, or click to upload.'}
        </Typography>
      )}
    </Paper>
  );
};

export default FileUploader;