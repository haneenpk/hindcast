import { useSyncExternalStore } from "react";
import { Link, Outlet } from "react-router-dom";
import { getCart, subscribe } from "./cart";

export function App() {
  const cart = useSyncExternalStore(subscribe, getCart);
  const count = cart.reduce((sum, line) => sum + line.qty, 0);

  return (
    <>
      <header className="site-header">
        <Link to="/" className="wordmark">
          Fernwood
        </Link>
        <nav>
          <Link to="/">Shop</Link>
          <Link to="/cart">Cart{count > 0 ? ` (${count})` : ""}</Link>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div>
          <p className="footer-title">Fernwood</p>
          <p className="footer-note">
            Solid-wood furniture and considered objects, made to be kept.
          </p>
        </div>
      </footer>
    </>
  );
}
