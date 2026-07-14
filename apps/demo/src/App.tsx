import { useSyncExternalStore } from "react";
import { Link, Outlet } from "react-router-dom";
import { subscribeToNewsletter } from "./api";
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
        <form
          className="newsletter"
          onSubmit={(event) => {
            event.preventDefault();
            const input = event.currentTarget.elements.namedItem(
              "email",
            ) as HTMLInputElement;
            subscribeToNewsletter(input.value);
            input.value = "";
          }}
        >
          <label htmlFor="newsletter-email">New pieces, twice a month</label>
          <div className="newsletter-row">
            <input
              id="newsletter-email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
            />
            <button type="submit">Sign up</button>
          </div>
        </form>
      </footer>
    </>
  );
}
