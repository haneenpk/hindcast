import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { init } from "@hindcast/sdk";
import { App } from "./App";
import { CartPage } from "./pages/Cart";
import { CheckoutPage } from "./pages/Checkout";
import { HomePage } from "./pages/Home";
import { ProductPage } from "./pages/Product";
import "./styles.css";

init({
  key: import.meta.env.VITE_HINDCAST_KEY ?? "",
  endpoint: import.meta.env.VITE_HINDCAST_ENDPOINT ?? "",
  debug: import.meta.env.DEV,
  reportButton: true,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<HomePage />} />
          <Route path="products/:slug" element={<ProductPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
