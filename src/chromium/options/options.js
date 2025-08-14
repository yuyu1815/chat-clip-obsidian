import React from "react";
import ReactDOM from "react-dom/client";
import "../popup/index.css";
import OptionsApp from "./OptionsApp";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>
);
