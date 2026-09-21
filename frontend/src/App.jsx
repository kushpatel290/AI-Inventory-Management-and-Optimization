import { useEffect, useState } from "react";
import "./App.css";
import Dashboard from "./pages/Dashboard";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "https://ai-inventory-management-and-optimization.onrender.com"
).replace(/\/$/, "");

function App() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [inventory, setInventory] = useState([]);

  const [suggestions, setSuggestions] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [executingKey, setExecutingKey] = useState("");
  const [redistributionMessage, setRedistributionMessage] =
    useState("");
  const [redistributionError, setRedistributionError] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);
  const [apiError, setApiError] = useState("");

  const [showProductForm, setShowProductForm] = useState(false);
  const [showWarehouseForm, setShowWarehouseForm] =
    useState(false);
  const [showInventoryForm, setShowInventoryForm] =
    useState(false);

  const [activeSection, setActiveSection] =
    useState("Dashboard");

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    price: "",
  });

  const [warehouseFormData, setWarehouseFormData] =
    useState({
      name: "",
      location: "",
    });

  const [inventoryFormData, setInventoryFormData] =
    useState({
      product_id: "",
      warehouse_id: "",
      quantity: "",
      reorder_level: "",
    });

  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");

  // =========================================================
  // API
  // =========================================================

  const fetchEndpoint = async (endpoint) => {
    try {
      const response = await fetch(
        `${API_URL}${endpoint}`
      );

      if (!response.ok) {
        throw new Error(
          `${endpoint} returned ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
      };
    } catch (error) {
      console.error(
        `API error for ${endpoint}:`,
        error
      );

      return {
        success: false,
        data: [],
        error: error.message,
      };
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setApiError("");

    const results = await Promise.all([
      fetchEndpoint("/products/"),
      fetchEndpoint("/warehouses/"),
      fetchEndpoint("/inventory/"),
    ]);

    const [
      productsResult,
      warehousesResult,
      inventoryResult,
    ] = results;

    let hasConnection = false;
    const errors = [];

    if (productsResult.success) {
      setProducts(productsResult.data);
      hasConnection = true;
    } else {
      errors.push(
        `Products: ${productsResult.error}`
      );
    }

    if (warehousesResult.success) {
      setWarehouses(warehousesResult.data);
      hasConnection = true;
    } else {
      errors.push(
        `Warehouses: ${warehousesResult.error}`
      );
    }

    if (inventoryResult.success) {
      setInventory(inventoryResult.data);
      hasConnection = true;
    } else {
      errors.push(
        `Inventory: ${inventoryResult.error}`
      );
    }

    setBackendConnected(hasConnection);

    if (!hasConnection) {
      setApiError(
        "Unable to connect to the FastAPI backend. Please check the backend URL and CORS configuration."
      );
    } else if (errors.length > 0) {
      setApiError(errors.join(" • "));
    }

    setLoading(false);
  };

  // =========================================================
  // REDISTRIBUTION API
  // =========================================================

  const fetchSuggestions = async () => {
    setSuggestionsLoading(true);
    setRedistributionError("");

    try {
      const response = await fetch(
        `${API_URL}/redistribution/suggestions`
      );

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            "Unable to load redistribution suggestions."
          )
        );
      }

      const data = await response.json();

      setSuggestions(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(
        "Redistribution suggestions error:",
        error
      );

      setRedistributionError(
        error.message ||
          "Unable to load redistribution suggestions."
      );
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const fetchTransferHistory = async () => {
    setTransfersLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/redistribution/transfers`
      );

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            "Unable to load transfer history."
          )
        );
      }

      const data = await response.json();

      setTransfers(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(
        "Transfer history error:",
        error
      );

      setRedistributionError(
        error.message ||
          "Unable to load transfer history."
      );
    } finally {
      setTransfersLoading(false);
    }
  };

  const handleExecuteTransfer = async (
    suggestion
  ) => {
    const executionKey = [
      suggestion.product_id,
      suggestion.from_warehouse_id,
      suggestion.to_warehouse_id,
      suggestion.quantity,
    ].join("-");

    setExecutingKey(executionKey);
    setRedistributionMessage("");
    setRedistributionError("");

    try {
      const response = await fetch(
        `${API_URL}/redistribution/execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product_id: Number(
              suggestion.product_id
            ),
            from_warehouse_id: Number(
              suggestion.from_warehouse_id
            ),
            to_warehouse_id: Number(
              suggestion.to_warehouse_id
            ),
            quantity: Number(
              suggestion.quantity
            ),
            reason:
              suggestion.reason ||
              "Automatic redistribution",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            "Unable to execute the stock transfer."
          )
        );
      }

      const data = await response.json();

      setRedistributionMessage(
        data.message ||
          `Successfully transferred ${suggestion.quantity} units.`
      );

      await Promise.all([
        fetchData(),
        fetchSuggestions(),
        fetchTransferHistory(),
      ]);
    } catch (error) {
      console.error(
        "Execute transfer error:",
        error
      );

      setRedistributionError(
        error.message ||
          "Unable to execute the stock transfer."
      );
    } finally {
      setExecutingKey("");
    }
  };

  useEffect(() => {
    fetchData();
    fetchSuggestions();
    fetchTransferHistory();
  }, []);

  // =========================================================
  // INPUT HANDLERS
  // =========================================================

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleWarehouseInputChange = (
    event
  ) => {
    const { name, value } = event.target;

    setWarehouseFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleInventoryInputChange = (
    event
  ) => {
    const { name, value } = event.target;

    setInventoryFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  // =========================================================
  // API ERROR MESSAGE
  // =========================================================

  const getApiErrorMessage = async (
    response,
    defaultMessage
  ) => {
    let errorMessage = defaultMessage;

    try {
      const errorData = await response.json();

      if (Array.isArray(errorData.detail)) {
        errorMessage = errorData.detail
          .map((item) => item.msg)
          .join(", ");
      } else if (errorData.detail) {
        errorMessage = errorData.detail;
      }
    } catch {
      // Keep default message.
    }

    return errorMessage;
  };

  // =========================================================
  // PRODUCT
  // =========================================================

  const handleAddProduct = async (event) => {
    event.preventDefault();

    setFormMessage("");
    setFormError("");

    if (
      !formData.name.trim() ||
      !formData.sku.trim() ||
      !formData.category.trim() ||
      !formData.price
    ) {
      setFormError(
        "Please fill in all product fields."
      );
      return;
    }

    if (Number(formData.price) < 0) {
      setFormError(
        "Price cannot be negative."
      );
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/products/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: formData.name.trim(),
            sku: formData.sku.trim(),
            category: formData.category.trim(),
            price: Number(formData.price),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            "Unable to add product."
          )
        );
      }

      setFormMessage(
        "Product added successfully."
      );

      setFormData({
        name: "",
        sku: "",
        category: "",
        price: "",
      });

      await fetchData();

      setTimeout(() => {
        setShowProductForm(false);
        setFormMessage("");
      }, 700);
    } catch (error) {
      console.error(
        "Add product error:",
        error
      );

      setFormError(
        error.message ||
          "Unable to add product. Please try again."
      );
    }
  };

  // =========================================================
  // WAREHOUSE
  // =========================================================

  const handleAddWarehouse = async (
    event
  ) => {
    event.preventDefault();

    setFormMessage("");
    setFormError("");

    if (
      !warehouseFormData.name.trim() ||
      !warehouseFormData.location.trim()
    ) {
      setFormError(
        "Please enter the warehouse name and location."
      );
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/warehouses/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: warehouseFormData.name.trim(),
            location:
              warehouseFormData.location.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            "Unable to add warehouse."
          )
        );
      }

      setFormMessage(
        "Warehouse added successfully."
      );

      setWarehouseFormData({
        name: "",
        location: "",
      });

      await fetchData();

      setTimeout(() => {
        setShowWarehouseForm(false);
        setFormMessage("");
      }, 700);
    } catch (error) {
      console.error(
        "Add warehouse error:",
        error
      );

      setFormError(
        error.message ||
          "Unable to add warehouse. Please try again."
      );
    }
  };

  // =========================================================
  // INVENTORY
  // =========================================================

  const handleAddInventory = async (
    event
  ) => {
    event.preventDefault();

    setFormMessage("");
    setFormError("");

    if (
      !inventoryFormData.product_id ||
      !inventoryFormData.warehouse_id ||
      inventoryFormData.quantity === ""
    ) {
      setFormError(
        "Please select a product, warehouse and enter a quantity."
      );
      return;
    }

    if (
      Number(inventoryFormData.quantity) < 0
    ) {
      setFormError(
        "Quantity cannot be negative."
      );
      return;
    }

    if (
      Number(inventoryFormData.reorder_level || 0) < 0
    ) {
      setFormError(
        "Reorder level cannot be negative."
      );
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/inventory/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product_id: Number(
              inventoryFormData.product_id
            ),
            warehouse_id: Number(
              inventoryFormData.warehouse_id
            ),
            quantity: Number(
              inventoryFormData.quantity
            ),
            reorder_level: Number(
              inventoryFormData.reorder_level || 0
            ),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            "Unable to add inventory."
          )
        );
      }

      setFormMessage(
        "Inventory added successfully."
      );

      setInventoryFormData({
        product_id: "",
        warehouse_id: "",
        quantity: "",
        reorder_level: "",
      });

      await fetchData();

      setTimeout(() => {
        setShowInventoryForm(false);
        setFormMessage("");
      }, 700);
    } catch (error) {
      console.error(
        "Add inventory error:",
        error
      );

      setFormError(
        error.message ||
          "Unable to add inventory. Please try again."
      );
    }
  };

  // =========================================================
  // CLOSE FORMS
  // =========================================================

  const closeProductForm = () => {
    setShowProductForm(false);

    setFormData({
      name: "",
      sku: "",
      category: "",
      price: "",
    });

    setFormMessage("");
    setFormError("");
  };

  const closeWarehouseForm = () => {
    setShowWarehouseForm(false);

    setWarehouseFormData({
      name: "",
      location: "",
    });

    setFormMessage("");
    setFormError("");
  };

  const closeInventoryForm = () => {
    setShowInventoryForm(false);

    setInventoryFormData({
      product_id: "",
      warehouse_id: "",
      quantity: "",
      reorder_level: "",
    });

    setFormMessage("");
    setFormError("");
  };

  // =========================================================
  // OPEN FORMS
  // =========================================================

  const openProductForm = () => {
    setFormMessage("");
    setFormError("");
    setShowProductForm(true);
  };

  const openWarehouseForm = () => {
    setFormMessage("");
    setFormError("");
    setShowWarehouseForm(true);
  };

  const openInventoryForm = () => {
    setFormMessage("");
    setFormError("");
    setShowInventoryForm(true);
  };

  // =========================================================
  // DASHBOARD DATA
  // =========================================================

  const totalStock = inventory.reduce(
    (total, item) =>
      total + Number(item.quantity || 0),
    0
  );

  const lowStockItems = inventory.filter(
    (item) =>
      Number(item.quantity || 0) <=
      Number(item.reorder_level || 10)
  );

  // =========================================================
  // NAVIGATION
  // =========================================================

  const handleNavigation = (section) => {
    setActiveSection(section);

    const sectionIds = {
      Dashboard: "dashboard",
      Products: "products",
      Warehouses: "warehouses",
      Inventory: "inventory",
      Optimization: "optimization",
      Redistribution: "redistribution",
    };

    const element = document.getElementById(
      sectionIds[section]
    );

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="app-shell">
      {/* SIDEBAR */}

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            AI
          </div>

          <div>
            <h1>Inventory</h1>
            <span>
              Management System
            </span>
          </div>
        </div>

        <div className="nav-heading">
          WORKSPACE
        </div>

        <nav className="sidebar-nav">
          {[
            "Dashboard",
            "Products",
            "Warehouses",
            "Inventory",
            "Optimization",
            "Redistribution",
          ].map((item) => (
            <button
              key={item}
              className={`nav-item ${
                activeSection === item
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleNavigation(item)
              }
            >
              <span className="nav-icon">
                {item === "Dashboard" && "▦"}
                {item === "Products" && "□"}
                {item === "Warehouses" && "⌂"}
                {item === "Inventory" && "≡"}
                {item === "Optimization" && "✦"}
                {item === "Redistribution" && "⇄"}
              </span>

              <span>{item}</span>
            </button>
          ))}
        </nav>

        <div className="connection-card">
          <div className="connection-row">
            <span
              className={`connection-dot ${
                backendConnected
                  ? "online"
                  : "offline"
              }`}
            />

            <strong>
              {backendConnected
                ? "Backend connected"
                : "Backend unavailable"}
            </strong>
          </div>

          <small>
            FastAPI ·{" "}
            {API_URL.replace(
              /^https?:\/\//,
              ""
            )}
          </small>
        </div>
      </aside>

      {/* MAIN */}

      <main className="main-content">
        {/* TOPBAR */}

        <header
          className="topbar"
          id="dashboard"
        >
          <div>
            <div className="breadcrumb">
              WORKSPACE / DASHBOARD
            </div>

            <h2>
              Inventory Overview
            </h2>

            <p>
              Keep track of your products,
              warehouses and stock.
            </p>
          </div>

          <div className="topbar-actions">
            <button
              className="secondary-button"
              onClick={fetchData}
            >
              ↻ Refresh
            </button>
          </div>
        </header>

        {/* API ALERT */}

        {apiError && (
          <div className="api-alert">
            <div>
              <strong>API Notice</strong>
              <p>{apiError}</p>
            </div>

            <button onClick={fetchData}>
              Retry
            </button>
          </div>
        )}

        {/* STATS */}

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue">
              □
            </div>

            <div className="stat-content">
              <span>Products</span>

              <strong>
                {loading
                  ? "—"
                  : products.length}
              </strong>

              <small>
                Registered products
              </small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">
              ⌂
            </div>

            <div className="stat-content">
              <span>Warehouses</span>

              <strong>
                {loading
                  ? "—"
                  : warehouses.length}
              </strong>

              <small>
                Active locations
              </small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange">
              ≡
            </div>

            <div className="stat-content">
              <span>
                Inventory Records
              </span>

              <strong>
                {loading
                  ? "—"
                  : inventory.length}
              </strong>

              <small>
                Tracked records
              </small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon purple">
              #
            </div>

            <div className="stat-content">
              <span>
                Total Stock
              </span>

              <strong>
                {loading
                  ? "—"
                  : totalStock}
              </strong>

              <small>
                Units currently tracked
              </small>
            </div>
          </div>
        </section>

        {/* PRODUCTS */}

        <section
          className="content-card"
          id="products"
        >
          <div className="section-header">
            <div>
              <span className="section-kicker">
                CATALOG
              </span>

              <h3>Products</h3>

              <p>
                Your current product catalog.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={openProductForm}
            >
              + Add Product
            </button>
          </div>

          {loading ? (
            <div className="empty-state compact">
              <h4>
                Loading products...
              </h4>

              <p>
                Connecting to the inventory
                database.
              </p>
            </div>
          ) : products.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                □
              </div>

              <h4>
                No products yet
              </h4>

              <p>
                Add your first product to
                get started.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>PRODUCT</th>
                    <th>SKU</th>
                    <th>CATEGORY</th>
                    <th>PRICE</th>
                  </tr>
                </thead>

                <tbody>
                  {products.map(
                    (product) => (
                      <tr
                        key={product.id}
                      >
                        <td>
                          <span className="muted-text">
                            #{product.id}
                          </span>
                        </td>

                        <td>
                          <span className="table-primary">
                            {product.name}
                          </span>
                        </td>

                        <td>
                          <span className="sku-text">
                            {product.sku}
                          </span>
                        </td>

                        <td>
                          <span className="category-badge">
                            {product.category}
                          </span>
                        </td>

                        <td>
                          <span className="price-text">
                            $
                            {Number(
                              product.price
                            ).toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* WAREHOUSES */}

        <section
          className="content-card"
          id="warehouses"
        >
          <div className="section-header">
            <div>
              <span className="section-kicker">
                LOCATIONS
              </span>

              <h3>Warehouses</h3>

              <p>
                Storage locations connected
                to the system.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={openWarehouseForm}
            >
              + Add Warehouse
            </button>
          </div>

          {loading ? (
            <div className="empty-state compact">
              <h4>
                Loading warehouses...
              </h4>

              <p>
                Checking connected storage
                locations.
              </p>
            </div>
          ) : warehouses.length === 0 ? (
            <div className="empty-state compact">
              <h4>
                No warehouses found
              </h4>

              <p>
                Add your first warehouse to
                get started.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table warehouse-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>NAME</th>
                    <th>LOCATION</th>
                  </tr>
                </thead>

                <tbody>
                  {warehouses.map(
                    (warehouse) => (
                      <tr
                        key={warehouse.id}
                      >
                        <td>
                          <span className="muted-text">
                            #{warehouse.id}
                          </span>
                        </td>

                        <td>
                          <span className="table-primary">
                            {warehouse.name}
                          </span>
                        </td>

                        <td>
                          <span className="table-secondary">
                            {warehouse.location}
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* INVENTORY */}

        <section
          className="content-card"
          id="inventory"
        >
          <div className="section-header inventory-header">
            <div>
              <span className="section-kicker">
                STOCK
              </span>

              <h3>Inventory</h3>

              <p>
                Current stock across your
                warehouse locations.
              </p>
            </div>

            <div className="section-actions">
              <button
                className="secondary-button"
                onClick={openInventoryForm}
              >
                + Add Inventory
              </button>

              <button
                className="secondary-button"
                onClick={fetchData}
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="empty-state compact">
              <h4>
                Loading inventory...
              </h4>

              <p>
                Reading current stock
                levels.
              </p>
            </div>
          ) : inventory.length === 0 ? (
            <div className="empty-state compact">
              <div className="empty-icon">
                ≡
              </div>

              <h4>
                No inventory records
              </h4>

              <p>
                Add inventory by selecting
                a product and warehouse.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table inventory-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>PRODUCT</th>
                    <th>WAREHOUSE</th>
                    <th>QUANTITY</th>
                    <th>REORDER LEVEL</th>
                  </tr>
                </thead>

                <tbody>
                  {inventory.map((item) => {
                    const product =
                      products.find(
                        (entry) =>
                          Number(entry.id) ===
                          Number(
                            item.product_id
                          )
                      );

                    const warehouse =
                      warehouses.find(
                        (entry) =>
                          Number(entry.id) ===
                          Number(
                            item.warehouse_id
                          )
                      );

                    return (
                      <tr
                        key={item.id}
                      >
                        <td>
                          <span className="muted-text">
                            #{item.id}
                          </span>
                        </td>

                        <td>
                          <div className="table-cell-stack">
                            <span className="table-primary">
                              {product?.name ||
                                "Unknown product"}
                            </span>

                            <span className="table-secondary">
                              ID: #
                              {item.product_id}

                              {product?.sku
                                ? ` • SKU: ${product.sku}`
                                : ""}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="table-cell-stack">
                            <span className="table-primary">
                              {warehouse?.name ||
                                "Unknown warehouse"}
                            </span>

                            <span className="table-secondary">
                              ID: #
                              {item.warehouse_id}

                              {warehouse?.location
                                ? ` • ${warehouse.location}`
                                : ""}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`quantity-badge ${
                              Number(
                                item.quantity
                              ) <=
                              Number(
                                item.reorder_level ||
                                  10
                              )
                                ? "low-stock"
                                : ""
                            }`}
                          >
                            {item.quantity}
                          </span>
                        </td>

                        <td>
                          <span className="muted-text">
                            {item.reorder_level ?? 0}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* AI INVENTORY OPTIMIZATION */}

        <section
          className="content-card"
          id="optimization"
        >
          <Dashboard
            products={products}
            warehouses={warehouses}
            inventory={inventory}
          />
        </section>

        {/* REDISTRIBUTION */}

        <section
          className="content-card"
          id="redistribution"
        >
          <div className="section-header">
            <div>
              <span className="section-kicker">
                SMART STOCK
              </span>

              <h3>
                Smart Redistribution
              </h3>

              <p>
                Recommended stock transfers
                between warehouses based on
                current stock and reorder levels.
              </p>
            </div>

            <div className="section-actions">
              <button
                className="secondary-button"
                onClick={fetchSuggestions}
                disabled={suggestionsLoading}
              >
                {suggestionsLoading
                  ? "Loading..."
                  : "↻ Refresh Suggestions"}
              </button>

              <button
                className="secondary-button"
                onClick={fetchTransferHistory}
                disabled={transfersLoading}
              >
                {transfersLoading
                  ? "Loading..."
                  : "↻ Refresh History"}
              </button>
            </div>
          </div>

          {redistributionMessage && (
            <div className="form-message success">
              {redistributionMessage}
            </div>
          )}

          {redistributionError && (
            <div className="form-message error">
              {redistributionError}
            </div>
          )}

          {/* SUGGESTIONS */}

          <div className="section-header">
            <div>
              <span className="section-kicker">
                RECOMMENDATIONS
              </span>

              <h3>
                Transfer Suggestions
              </h3>

              <p>
                Review and execute suggested
                stock movements.
              </p>
            </div>
          </div>

          {suggestionsLoading ? (
            <div className="empty-state compact">
              <h4>
                Analysing inventory...
              </h4>

              <p>
                Generating redistribution
                suggestions.
              </p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="empty-state compact">
              <div className="empty-icon">
                ⇄
              </div>

              <h4>
                No redistribution suggestions
              </h4>

              <p>
                Current inventory does not
                require a recommended transfer.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PRODUCT</th>
                    <th>FROM</th>
                    <th>TO</th>
                    <th>QUANTITY</th>
                    <th>REASON</th>
                    <th>ACTION</th>
                  </tr>
                </thead>

                <tbody>
                  {suggestions.map(
                    (suggestion, index) => {
                      const executionKey = [
                        suggestion.product_id,
                        suggestion.from_warehouse_id,
                        suggestion.to_warehouse_id,
                        suggestion.quantity,
                      ].join("-");

                      const isExecuting =
                        executingKey ===
                        executionKey;

                      const product =
                        products.find(
                          (item) =>
                            Number(item.id) ===
                            Number(
                              suggestion.product_id
                            )
                        );

                      return (
                        <tr
                          key={`${executionKey}-${index}`}
                        >
                          <td>
                            <div className="table-cell-stack">
                              <span className="table-primary">
                                {product?.name ||
                                  `Product #${suggestion.product_id}`}
                              </span>

                              <span className="table-secondary">
                                {suggestion.product_sku ||
                                  `SKU unavailable`}
                              </span>
                            </div>
                          </td>

                          <td>
                            <span className="table-primary">
                              {
                                suggestion.from_warehouse_name
                              }
                            </span>
                          </td>

                          <td>
                            <span className="table-primary">
                              {
                                suggestion.to_warehouse_name
                              }
                            </span>
                          </td>

                          <td>
                            <span className="quantity-badge">
                              {suggestion.quantity}
                            </span>
                          </td>

                          <td>
                            <span className="table-secondary">
                              {suggestion.reason}
                            </span>
                          </td>

                          <td>
                            <button
                              className="primary-button"
                              onClick={() =>
                                handleExecuteTransfer(
                                  suggestion
                                )
                              }
                              disabled={
                                isExecuting
                              }
                            >
                              {isExecuting
                                ? "Executing..."
                                : "Execute Transfer"}
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TRANSFER HISTORY */}

          <div
            className="section-header"
            style={{
              marginTop: "32px",
            }}
          >
            <div>
              <span className="section-kicker">
                HISTORY
              </span>

              <h3>
                Recent Transfers
              </h3>

              <p>
                Previously executed stock
                redistribution transfers.
              </p>
            </div>
          </div>

          {transfersLoading ? (
            <div className="empty-state compact">
              <h4>
                Loading transfer history...
              </h4>

              <p>
                Reading completed stock
                transfers.
              </p>
            </div>
          ) : transfers.length === 0 ? (
            <div className="empty-state compact">
              <h4>
                No transfers yet
              </h4>

              <p>
                Executed redistribution
                transfers will appear here.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>PRODUCT</th>
                    <th>FROM</th>
                    <th>TO</th>
                    <th>QUANTITY</th>
                    <th>STATUS</th>
                    <th>DATE</th>
                  </tr>
                </thead>

                <tbody>
                  {transfers.map(
                    (transfer) => {
                      const product =
                        products.find(
                          (item) =>
                            Number(item.id) ===
                            Number(
                              transfer.product_id
                            )
                        );

                      const fromWarehouse =
                        warehouses.find(
                          (item) =>
                            Number(item.id) ===
                            Number(
                              transfer.from_warehouse_id
                            )
                        );

                      const toWarehouse =
                        warehouses.find(
                          (item) =>
                            Number(item.id) ===
                            Number(
                              transfer.to_warehouse_id
                            )
                        );

                      let formattedDate =
                        "—";

                      if (
                        transfer.created_at
                      ) {
                        const date =
                          new Date(
                            transfer.created_at
                          );

                        if (
                          !Number.isNaN(
                            date.getTime()
                          )
                        ) {
                          formattedDate =
                            date.toLocaleString();
                        }
                      }

                      return (
                        <tr
                          key={transfer.id}
                        >
                          <td>
                            <span className="muted-text">
                              #
                              {transfer.id}
                            </span>
                          </td>

                          <td>
                            <span className="table-primary">
                              {product?.name ||
                                `Product #${transfer.product_id}`}
                            </span>
                          </td>

                          <td>
                            <span className="table-primary">
                              {fromWarehouse?.name ||
                                `Warehouse #${transfer.from_warehouse_id}`}
                            </span>
                          </td>

                          <td>
                            <span className="table-primary">
                              {toWarehouse?.name ||
                                `Warehouse #${transfer.to_warehouse_id}`}
                            </span>
                          </td>

                          <td>
                            <span className="quantity-badge">
                              {transfer.quantity}
                            </span>
                          </td>

                          <td>
                            <span className="alert-status-badge">
                              {transfer.status ||
                                "COMPLETED"}
                            </span>
                          </td>

                          <td>
                            <span className="table-secondary">
                              {formattedDate}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* STOCK ALERTS */}

        <section className="content-card">
          <div className="section-header">
            <div>
              <span className="section-kicker">
                ATTENTION
              </span>

              <h3>Stock Alerts</h3>

              <p>
                Items that may need attention
                soon.
              </p>
            </div>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="empty-state compact">
              <h4>
                Everything looks good
              </h4>

              <p>
                No inventory records are
                currently below the low-stock
                threshold.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table stock-alert-table">
                <thead>
                  <tr>
                    <th>PRODUCT</th>
                    <th>WAREHOUSE</th>
                    <th>CURRENT STOCK</th>
                    <th>STATUS</th>
                  </tr>
                </thead>

                <tbody>
                  {lowStockItems.map(
                    (item) => {
                      const product =
                        products.find(
                          (entry) =>
                            Number(
                              entry.id
                            ) ===
                            Number(
                              item.product_id
                            )
                        );

                      const warehouse =
                        warehouses.find(
                          (entry) =>
                            Number(
                              entry.id
                            ) ===
                            Number(
                              item.warehouse_id
                            )
                        );

                      return (
                        <tr
                          key={item.id}
                        >
                          <td>
                            <span className="table-primary">
                              {product?.name ||
                                `Product #${item.product_id}`}
                            </span>
                          </td>

                          <td>
                            <span className="table-primary">
                              {warehouse?.name ||
                                `Warehouse #${item.warehouse_id}`}
                            </span>
                          </td>

                          <td>
                            <span className="low-stock-value">
                              {item.quantity}{" "}
                              {Number(
                                item.quantity
                              ) === 1
                                ? "unit"
                                : "units"}
                            </span>
                          </td>

                          <td>
                            <span className="alert-status-badge">
                              LOW STOCK
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* FOOTER */}

        <footer className="page-footer">
          <span>
            AI Inventory Management
          </span>

          <span>
            Inventory optimization dashboard
          </span>
        </footer>
      </main>

      {/* =====================================================
          ADD PRODUCT MODAL
          ===================================================== */}

      {showProductForm && (
        <div
          className="modal-overlay"
          onClick={closeProductForm}
        >
          <div
            className="modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <span className="section-kicker">
                  PRODUCT CATALOG
                </span>

                <h3>Add Product</h3>

                <p>
                  Enter the basic details
                  for a new product.
                </p>
              </div>

              <button
                className="modal-close"
                onClick={closeProductForm}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleAddProduct}
            >
              <div className="form-grid">
                <div className="form-group full">
                  <label htmlFor="name">
                    Product Name
                  </label>

                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={
                      handleInputChange
                    }
                    placeholder="e.g. Wireless Mouse"
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="sku">
                    SKU
                  </label>

                  <input
                    id="sku"
                    name="sku"
                    type="text"
                    value={formData.sku}
                    onChange={
                      handleInputChange
                    }
                    placeholder="e.g. MOU001"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="category">
                    Category
                  </label>

                  <input
                    id="category"
                    name="category"
                    type="text"
                    value={
                      formData.category
                    }
                    onChange={
                      handleInputChange
                    }
                    placeholder="e.g. Electronics"
                  />
                </div>

                <div className="form-group full">
                  <label htmlFor="price">
                    Price
                  </label>

                  <input
                    id="price"
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={
                      handleInputChange
                    }
                    placeholder="e.g. 25.99"
                  />
                </div>
              </div>

              {formError && (
                <div className="form-message error">
                  {formError}
                </div>
              )}

              {formMessage && (
                <div className="form-message success">
                  {formMessage}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    closeProductForm
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          ADD WAREHOUSE MODAL
          ===================================================== */}

      {showWarehouseForm && (
        <div
          className="modal-overlay"
          onClick={closeWarehouseForm}
        >
          <div
            className="modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <span className="section-kicker">
                  STORAGE LOCATIONS
                </span>

                <h3>Add Warehouse</h3>

                <p>
                  Add a new warehouse or
                  storage location.
                </p>
              </div>

              <button
                className="modal-close"
                onClick={
                  closeWarehouseForm
                }
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleAddWarehouse}
            >
              <div className="form-grid">
                <div className="form-group full">
                  <label htmlFor="warehouse-name">
                    Warehouse Name
                  </label>

                  <input
                    id="warehouse-name"
                    name="name"
                    type="text"
                    value={
                      warehouseFormData.name
                    }
                    onChange={
                      handleWarehouseInputChange
                    }
                    placeholder="e.g. Main Warehouse"
                    autoFocus
                  />
                </div>

                <div className="form-group full">
                  <label htmlFor="warehouse-location">
                    Location
                  </label>

                  <input
                    id="warehouse-location"
                    name="location"
                    type="text"
                    value={
                      warehouseFormData.location
                    }
                    onChange={
                      handleWarehouseInputChange
                    }
                    placeholder="e.g. New York"
                  />
                </div>
              </div>

              {formError && (
                <div className="form-message error">
                  {formError}
                </div>
              )}

              {formMessage && (
                <div className="form-message success">
                  {formMessage}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    closeWarehouseForm
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                >
                  Save Warehouse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          ADD INVENTORY MODAL
          ===================================================== */}

      {showInventoryForm && (
        <div
          className="modal-overlay"
          onClick={closeInventoryForm}
        >
          <div
            className="modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <span className="section-kicker">
                  STOCK MANAGEMENT
                </span>

                <h3>Add Inventory</h3>

                <p>
                  Assign stock to a product
                  and warehouse.
                </p>
              </div>

              <button
                className="modal-close"
                onClick={
                  closeInventoryForm
                }
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleAddInventory}
            >
              <div className="form-grid">
                <div className="form-group full">
                  <label htmlFor="inventory-product">
                    Product
                  </label>

                  <select
                    id="inventory-product"
                    name="product_id"
                    value={
                      inventoryFormData.product_id
                    }
                    onChange={
                      handleInventoryInputChange
                    }
                  >
                    <option value="">
                      Select a product
                    </option>

                    {products.map(
                      (product) => (
                        <option
                          key={product.id}
                          value={
                            product.id
                          }
                        >
                          #{product.id} —{" "}
                          {product.name}
                          {product.sku
                            ? ` — ${product.sku}`
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="form-group full">
                  <label htmlFor="inventory-warehouse">
                    Warehouse
                  </label>

                  <select
                    id="inventory-warehouse"
                    name="warehouse_id"
                    value={
                      inventoryFormData.warehouse_id
                    }
                    onChange={
                      handleInventoryInputChange
                    }
                  >
                    <option value="">
                      Select a warehouse
                    </option>

                    {warehouses.map(
                      (warehouse) => (
                        <option
                          key={
                            warehouse.id
                          }
                          value={
                            warehouse.id
                          }
                        >
                          #{warehouse.id} —{" "}
                          {warehouse.name}
                          {warehouse.location
                            ? ` — ${warehouse.location}`
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="form-group full">
                  <label htmlFor="inventory-quantity">
                    Quantity
                  </label>

                  <input
                    id="inventory-quantity"
                    name="quantity"
                    type="number"
                    min="0"
                    step="1"
                    value={
                      inventoryFormData.quantity
                    }
                    onChange={
                      handleInventoryInputChange
                    }
                    placeholder="e.g. 100"
                  />
                </div>

                <div className="form-group full">
                  <label htmlFor="inventory-reorder-level">
                    Reorder Level
                  </label>

                  <input
                    id="inventory-reorder-level"
                    name="reorder_level"
                    type="number"
                    min="0"
                    step="1"
                    value={
                      inventoryFormData.reorder_level
                    }
                    onChange={
                      handleInventoryInputChange
                    }
                    placeholder="e.g. 20"
                  />
                </div>
              </div>

              {formError && (
                <div className="form-message error">
                  {formError}
                </div>
              )}

              {formMessage && (
                <div className="form-message success">
                  {formMessage}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    closeInventoryForm
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                >
                  Save Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;