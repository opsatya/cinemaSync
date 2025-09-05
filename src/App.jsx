import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';

// Page imports
import Home from './pages/Home';
import Theater from './pages/Theater';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import CreateRoom from './pages/CreateRoom';
import MyRooms from './pages/MyRooms';

// Layout components
import MainLayout from './components/layout/MainLayout';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* Normalize CSS */}
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/theater/:roomId" element={<Theater />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/create-room" element={<CreateRoom />} />
            <Route path="/my-rooms" element={<MyRooms />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
