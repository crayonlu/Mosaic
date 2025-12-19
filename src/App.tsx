// CSS Imports
import "./styles/App.css";
import './styles/globals.css';

// Component Imports
import { Badge } from "@/components/ui/badge";

function App() {

  return (
    <main className="container">
      <Badge variant="outline">Welcome to Mosaic</Badge>
    </main>
  );
}

export default App;
