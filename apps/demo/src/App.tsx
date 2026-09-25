import { useEffect, useSyncExternalStore } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { subscribeToNewsletter } from "./api";
import { getCart, subscribe } from "./cart";
import { categories } from "./products";

export function App() {
  const cart = useSyncExternalStore(subscribe, getCart);
  const count = cart.reduce((sum, line) => sum + line.qty, 0);
  const { pathname, hash } = useLocation();

  // SPA navigation keeps the old scroll position; a new page should start
  // at the top (in-page anchors like #studio still scroll to themselves).
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname, hash]);

  return (
    <>
      <div className="announce">
        Free delivery on orders over $300 · Made in small runs · 30-year joinery guarantee
      </div>

      <header className="site-header">
        <div className="wrap">
          <nav className="nav nav-start" aria-label="Primary">
            <NavLink to="/" end>
              Shop
            </NavLink>
            <Link to="/#studio">Studio</Link>
          </nav>
          <Link to="/" className="wordmark">
            Fernwood
          </Link>
          <nav className="nav nav-end" aria-label="Cart">
            <NavLink to="/cart" className="cart-link">
              Cart
              {count > 0 ? <span className="cart-count">{count}</span> : null}
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="wrap">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <div className="footer-grid">
            <div className="footer-brand">
              <Link to="/" className="wordmark">
                Fernwood
              </Link>
              <p>
                Solid-wood furniture and considered objects, made in small
                runs and built to be kept.
              </p>
            </div>

            <div className="footer-col">
              <h3>Shop</h3>
              <ul>
                {categories
                  .filter((c) => c !== "All")
                  .slice(0, 5)
                  .map((category) => (
                    <li key={category}>
                      <Link to="/">{category}</Link>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="footer-col">
              <h3>Help</h3>
              <ul>
                <li>Delivery</li>
                <li>Returns</li>
                <li>Care guides</li>
                <li>Contact</li>
              </ul>
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
              <h3>Letters</h3>
              <p>New pieces and studio notes, twice a month.</p>
              <div className="newsletter-row">
                {/* data-private: the whole field records as a placeholder
                    block — not even masked keystrokes reach the replay */}
                <input
                  id="newsletter-email"
                  name="email"
                  type="email"
                  required
                  aria-label="Email address"
                  placeholder="you@example.com"
                  data-private=""
                />
                <button type="submit">Subscribe →</button>
              </div>
            </form>
          </div>

          <div className="footer-base">
            <span>© 2026 Fernwood</span>
            <span>A demo shop for Hindcast — nothing here is for sale.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
