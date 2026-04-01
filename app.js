import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import AreaBin from "./areabin";
import GaugeView from "./GaugeView";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AreaBin />} />
        <Route path="/gauges/:binId" element={<GaugeView />} />
      </Routes>
    </Router>
  );
}

export default App;
