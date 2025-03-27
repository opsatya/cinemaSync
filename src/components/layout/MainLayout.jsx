import { Outlet } from 'react-router-dom';
import { Box, useTheme } from '@mui/material';
import Navbar from './Navbar';
import Footer from './Footer';
import { motion } from 'framer-motion';

const MainLayout = () => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${theme.palette.background.alt} 100%)`,
      }}
    >
      <Navbar />
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5 }}
        style={{
          flexGrow: 1,
          padding: '24px',
          paddingTop: '84px', // Account for fixed navbar
        }}
      >
        <Outlet />
      </motion.main>
      <Footer />
    </Box>
  );
};

export default MainLayout;
