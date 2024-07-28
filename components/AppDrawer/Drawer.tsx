"use client"
import * as React from 'react';
import { styled } from '@mui/material/styles';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import CelebrationIcon from '@mui/icons-material/Celebration';
import HomeIcon from '@mui/icons-material/Home';
import { useRouter } from 'next/navigation'

export const drawerWidth = 240;
const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
  justifyContent: 'flex-start',
}));

export default function CustomDrawer({theme, open, handleDrawerClose}:any) {
  const router = useRouter()
  return (
    <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
          },
        }}
        variant="persistent"
        anchor="right"
        open={open}
      >
        <DrawerHeader>
          <IconButton onClick={handleDrawerClose}>
            {theme.direction === 'rtl' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
        </DrawerHeader>
        <Divider />
        <List>
          <ListItem disablePadding>
            <ListItemButton onClick={() => router.push('/')}>
              <ListItemIcon>
                <HomeIcon />
              </ListItemIcon>
              <ListItemText primary={"Home"} />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton onClick={() => router.push('/scan')}>
              <ListItemIcon>
                <QrCodeScannerIcon />
              </ListItemIcon>
              <ListItemText primary={"Scan"} />
            </ListItemButton>
          </ListItem>
                    
          <ListItem disablePadding>
            <ListItemButton onClick={() => router.push('/credits')}>
              <ListItemIcon>
                <CelebrationIcon />
              </ListItemIcon>
              <ListItemText primary={"Credits"} />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>
  );
}
