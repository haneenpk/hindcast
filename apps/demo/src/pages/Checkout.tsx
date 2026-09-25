import { useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { clearCart, getCart, subscribe } from "../cart";
import { findProduct, formatPrice } from "../products";
import { DELIVERY_FEE, FREE_DELIVERY_FROM } from "./Cart";

const COUPONS = [{ code: "WELCOME10", percent: 10 }];

export function CheckoutPage() {
  const cart = useSyncExternalStore(subscribe, getCart);
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [placed, setPlaced] = useState(false);

  const lines = cart.flatMap((line) => {
    const product = findProduct(line.slug);
    return product ? [{ line, product }] : [];
  });
  const subtotal = lines.reduce((sum, { line, product }) => sum + line.qty * product.price, 0);
  const savings = Math.round(subtotal * (discount / 100));
  const delivery = subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE;
  const total = subtotal - savings + delivery;

  const applyCoupon = () => {
    const match = COUPONS.find(
      (entry) => entry.code === coupon.trim().toUpperCase(),
    );
    // planted: an unknown code leaves `match` undefined and the next line
    // throws in front of the customer. This is the bug the demo session
    // replays are about.
    setDiscount(match!.percent);
  };

  if (placed) {
    return (
      <section className="confirmation">
        <div className="confirmation-mark" aria-hidden>
          ✓
        </div>
        <p className="eyebrow">Order confirmed</p>
        <h1>Thank you — your order is in.</h1>
        <p>
          This is a demo shop, so nothing was charged and nothing will ship.
          Thanks for trying the checkout.
        </p>
        <Link to="/" className="button button-ghost">
          Back to the shop
        </Link>
      </section>
    );
  }

  if (lines.length === 0) {
    return (
      <section className="empty-state">
        <h1>Nothing to check out.</h1>
        <Link to="/" className="button">
          Back to the shop
        </Link>
      </section>
    );
  }

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Checkout</p>
        <h1>Almost there.</h1>
      </header>

      <div className="cart-layout">
        <form
          className="checkout-form"
          onSubmit={(event) => {
            event.preventDefault();
            clearCart();
            setPlaced(true);
            // The confirmation is far shorter than the form it replaces —
            // without this it opens scrolled past its own heading.
            window.scrollTo({ top: 0, behavior: "instant" });
          }}
        >
          <section className="form-section">
            <h2>
              <span>01</span> Contact
            </h2>
            <label className="field">
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
          </section>

          <section className="form-section">
            <h2>
              <span>02</span> Delivery
            </h2>
            <label className="field">
              Full name
              <input name="name" autoComplete="name" required />
            </label>
            <label className="field">
              Address
              <input name="address" autoComplete="street-address" required />
            </label>
            <div className="field-row">
              <label className="field">
                City
                <input name="city" autoComplete="address-level2" required />
              </label>
              <label className="field">
                Postcode
                <input name="postal" autoComplete="postal-code" required />
              </label>
            </div>
          </section>

          <section className="form-section">
            <h2>
              <span>03</span> Payment
            </h2>
            <label className="field">
              Card number
              <input
                name="card"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="1234 1234 1234 1234"
                required
              />
            </label>
            <div className="field-row">
              <label className="field">
                Expiry
                <input name="expiry" autoComplete="cc-exp" placeholder="MM / YY" required />
              </label>
              <label className="field">
                CVC
                <input name="cvc" inputMode="numeric" autoComplete="cc-csc" required />
              </label>
            </div>
            <p className="secure-note">Card details never leave your browser in this demo.</p>
          </section>

          <section className="form-section">
            <h2>
              <span>04</span> Discount
            </h2>
            <div className="coupon-row">
              <label className="field">
                Coupon code
                <input
                  value={coupon}
                  onChange={(event) => setCoupon(event.target.value)}
                  placeholder="WELCOME10"
                />
              </label>
              <button type="button" className="button button-ghost" onClick={applyCoupon}>
                Apply
              </button>
            </div>
            {discount > 0 ? <p className="coupon-note">{discount}% off applied.</p> : null}
          </section>

          <button type="submit" className="button button-block">
            Place order — {formatPrice(total)}
          </button>
        </form>

        <aside className="summary" aria-label="Order summary">
          <h2>Your order</h2>
          <ul className="summary-items">
            {lines.map(({ line, product }) => (
              <li key={line.slug} className="summary-item">
                <span className="summary-thumb" style={{ backgroundColor: product.tone }}>
                  <img src={product.image} alt="" />
                  <span className="summary-qty">{line.qty}</span>
                </span>
                <span>{product.name}</span>
                <span className="price">{formatPrice(product.price * line.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="summary-row">
            <span className="muted">Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          {discount > 0 ? (
            <div className="summary-row">
              <span className="muted">Discount ({discount}%)</span>
              <span>−{formatPrice(savings)}</span>
            </div>
          ) : null}
          <div className="summary-row">
            <span className="muted">Delivery</span>
            <span>{delivery === 0 ? "Free" : formatPrice(delivery)}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </aside>
      </div>
    </>
  );
}
