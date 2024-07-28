import * as React from 'react';
import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import { useRouter } from 'next/navigation'
import AirplaneTicketIcon from '@mui/icons-material/AirplaneTicket';
import { downloader } from '@/utils';

import asset from '@/data/asset';

export default function SimpleBottomNavigation() {
  const [value, setValue] = React.useState(0);
  const router = useRouter()
  return (
    <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
      <BottomNavigation
        showLabels
        value={value}
        onChange={(_event, newValue) => {
          setValue(newValue);
          if (newValue === 0){
            downloader(asset, 'emblem.diag')
          }
          if (newValue === 1){
            router.push('/d999ac786ac4e00ad8da8d5be69de997f0c429e4abd8c3f158012c078467c20c')
          }
          if (newValue === 2){
            router.push('/scan')
          }
        }}
      >
        <BottomNavigationAction label="Test Asset" icon={<AirplaneTicketIcon />} />
        <BottomNavigationAction label="Display Emblem" icon={<HealthAndSafetyIcon />} />
        <BottomNavigationAction label="Inspect Emblem" icon={<QrCodeScannerIcon />} />
      </BottomNavigation>
    </Paper>
  );
}
