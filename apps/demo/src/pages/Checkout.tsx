import { useState } from "react";
import { Link } from "react-router-dom";
import { useSyncExternalStore } from "react";
import { clearCart, getCart, subscribe } from "../cart";
import { findProduct, formatPrice } from "../products";

const COUPONS = [{ code: "WELCOME10", percent: 10 }];

export function CheckoutPage() {
  const cart = useSyncExternalStore(subscribe, getCart);
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [placed, setPlaced] = useState(false);

  const subtotal = cart.reduce(
    (sum, line) => sum + line.qty * (findProduct(line.slug)?.price ?? 0),
    0,
  );
  const total = Math.round(subtotal * (1 - discount / 100));

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
      <section className="page">
        <h1>Order placed.</h1>
        <p>
          This is a demo shop — nothing was charged and nothing will ship.
          Thanks for trying the checkout.
        </p>
        <p>
          <Link to="/">Back to the shop</Link>
        </p>
      </section>
    );
  }

  if (cart.length === 0) {
    return (
      <section className="page">
        <h1>Nothing to check out.</h1>
        <p>
          <Link to="/">Back to the shop</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="page checkout">
      <h1>Checkout</h1>

      <form
        className="checkout-form"
        onSubmit={(event) => {
          event.preventDefault();
          clearCart();
          setPlaced(true);
        }}
      >
        <fieldset>
          <legend>Delivery</legend>
          <label>
            Full name
            <input name="name" autoComplete="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Address
            <input name="address" autoComplete="street-address" required />
          </label>
          <div className="field-row">
            <label>
              City
              <input name="city" autoComplete="address-level2" required />
            </label>
            <label>
              Postcode
              <input name="postal" autoComplete="postal-code" required />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Payment</legend>
          <label>
            Card number
            <input
              name="card"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="4242 4242 4242 4242"
              required
            />
          </label>
          <div className="field-row">
            <label>
              Expiry
              <input
                name="expiry"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                required
              />
            </label>
            <label>
              CVC
              <input
                name="cvc"
                inputMode="numeric"
                autoComplete="cc-csc"
                required
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Discount</legend>
          <div className="field-row coupon-row">
            <label>
              Coupon code
              <input
                value={coupon}
                onChange={(event) => setCoupon(event.target.value)}
                placeholder="WELCOME10"
              />
            </label>
            <button
              type="button"
              className="button-quiet"
              onClick={applyCoupon}
            >
              Apply
            </button>
          </div>
          {discount > 0 ? (
            <p className="coupon-note">{discount}% off applied.</p>
          ) : null}
        </fieldset>

        <div className="order-summary">
          <span>{discount > 0 ? `Total after ${discount}% off` : "Total"}</span>
          <span className="price-lg">{formatPrice(total)}</span>
        </div>

        <button type="submit" className="button-primary">
          Place order
        </button>
      </form>
    </section>
  );
}
