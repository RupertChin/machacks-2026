import { Viewport } from "./components/Viewport";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/toolbar/Toolbar";

function App() {
  return (
    <div className="flex flex-col h-screen w-screen bg-gray-950 text-white">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <Viewport />
        <Sidebar />
      </div>
    </div>
  );
}

export default App;
