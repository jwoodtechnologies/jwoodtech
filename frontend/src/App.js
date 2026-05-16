import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Vineyard from "@/pages/Vineyard";
import VineyardAdmin from "@/pages/VineyardAdmin";
import WoodChat from "@/pages/WoodChat";
import WoodChatAdmin from "@/pages/WoodChatAdmin";
import Eon from "@/pages/Eon";
import Research from "@/pages/Research";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/vineyard" element={<Vineyard />} />
          <Route path="/vineyard-admin" element={<VineyardAdmin />} />
          <Route path="/vineyard/admin" element={<VineyardAdmin />} />
          <Route path="/woodchat" element={<WoodChat />} />
          <Route path="/woodchat-admin" element={<WoodChatAdmin />} />
          <Route path="/eon" element={<Eon />} />
          <Route path="/research" element={<Research />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-center" theme="dark" />
    </div>
  );
}

export default App;
