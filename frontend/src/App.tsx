import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Reserve from './pages/Reserve';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Reserve />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
