import { Box, Container, Typography, Link, useTheme } from '@mui/material';
import { motion } from 'framer-motion';

const Footer = () => {
  const theme = useTheme();
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: 'auto',
        backgroundColor: theme.palette.background.paper,
      }}
    >
      <Container maxWidth="lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Typography variant="body2" color="text.secondary" align="center">
            {'© '}
            <Link color="inherit" href="/">
              CinemaSync
            </Link>{' '}
            {currentYear}
            {' - Bringing friends together through movies'}
          </Typography>
        </motion.div>
      </Container>
    </Box>
  );
};

export default Footer;
