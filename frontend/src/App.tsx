import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useState, createContext, useContext } from "react";
import axios from "axios";
import Login from "./pages/Login";
import Home from "./pages/Home";

import Register from "./pages/Register";

// --- Auth Context ---
interface AuthContextType {
  isAuthenticated: boolean;
  login: (shopkeeper: any) => void;
  logout: () => void;
  shopkeeper: any;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
  shopkeeper: null,
});

export const useAuth = () => useContext(AuthContext);

function Router() {
  const { isAuthenticated } = useAuth();
  
  return (
    <Switch>
      <Route path="/">
        {isAuthenticated ? <Home /> : <Login />}
      </Route>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [shopkeeper, setShopkeeper] = useState(() => {
    const saved = JSON.parse(localStorage.getItem('shopkeeper') || 'null');
    if (saved?.email) {
      axios.defaults.headers.common['X-Shopkeeper-Email'] = saved.email;
    }
    return saved;
  });

  const login = (data: any) => {
    localStorage.setItem('token', 'fake-jwt-token'); // Simple token
    localStorage.setItem('shopkeeper', JSON.stringify(data));
    if (data?.email) {
      axios.defaults.headers.common['X-Shopkeeper-Email'] = data.email;
    }
    setShopkeeper(data);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('shopkeeper');
    delete axios.defaults.headers.common['X-Shopkeeper-Email'];
    setShopkeeper(null);
    setIsAuthenticated(false);
  };

  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
      >
        <AuthContext.Provider value={{ isAuthenticated, login, logout, shopkeeper }}>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthContext.Provider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
