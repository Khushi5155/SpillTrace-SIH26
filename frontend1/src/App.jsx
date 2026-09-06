import { BrowserRouter, Routes, Route } from "react-router-dom";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Footer from "./components/Footer";

import Home from "./pages/Home";
import Upload from "./pages/Upload";
import Investigation from "./pages/Investigation";

import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />

        <div className="app-body">
          <Sidebar />

          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />

              <Route path="/upload" element={<Upload />} />

              <Route
                path="/investigation/:id"
                element={<Investigation />}
              />
            </Routes>
          </main>
        </div>

        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
