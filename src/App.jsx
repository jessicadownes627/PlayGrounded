import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import TeddySplash from "./components/TeddySplash";
import Welcome from "./pages/Welcome";
import MapPage from "./pages/MapPage"; // your existing map page

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TeddySplash />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/map" element={<MapPage />} />
      </Routes>
    </Router>
  );
}

