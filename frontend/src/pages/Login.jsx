import { useState } from "react";
import "../App.css";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "https://ai-inventory-management-and-optimization.onrender.com"
).replace(/\/$/, "");

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [showRegister, setShowRegister] = useState(false);

  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const [registerError, setRegisterError] = useState("");
  const [registerMessage, setRegisterMessage] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");

    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }

    setLoading(true);

    try {
      const body = new URLSearchParams();

      body.append("username", username.trim());
      body.append("password", password);

      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      let data = {};

      try {
        data = await response.json();
      } catch {
        // Keep default error.
      }

      if (!response.ok) {
        throw new Error(
          data.detail || "Invalid username or password."
        );
      }

      localStorage.setItem(
        "access_token",
        data.access_token
      );

      onLogin();
    } catch (err) {
      setError(err.message || "Unable to login.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();

    setRegisterError("");
    setRegisterMessage("");

    if (
      !registerUsername.trim() ||
      !registerEmail.trim() ||
      !registerPassword
    ) {
      setRegisterError("Please fill in all fields.");
      return;
    }

    if (registerPassword.length < 6) {
      setRegisterError(
        "Password must be at least 6 characters."
      );
      return;
    }

    setRegisterLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: registerUsername.trim(),
            email: registerEmail.trim(),
            password: registerPassword,
          }),
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        // Keep default error.
      }

      if (!response.ok) {
        if (Array.isArray(data.detail)) {
          throw new Error(
            data.detail
              .map((item) => item.msg)
              .join(", ")
          );
        }

        throw new Error(
          data.detail || "Unable to create account."
        );
      }

      setRegisterMessage(
        "Account created successfully. You can now sign in."
      );

      setRegisterUsername("");
      setRegisterEmail("");
      setRegisterPassword("");

      setTimeout(() => {
        setShowRegister(false);
        setRegisterMessage("");
      }, 1200);
    } catch (err) {
      setRegisterError(
        err.message || "Unable to create account."
      );
    } finally {
      setRegisterLoading(false);
    }
  };

  if (showRegister) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <h1>Create Account</h1>
            <p>
              Register to access the inventory dashboard
            </p>
          </div>

          <form
            onSubmit={handleRegister}
            className="login-form"
          >
            <label htmlFor="register-username">
              Username
            </label>

            <input
              id="register-username"
              type="text"
              value={registerUsername}
              onChange={(event) =>
                setRegisterUsername(event.target.value)
              }
              placeholder="Enter your username"
              autoComplete="username"
            />

            <label htmlFor="register-email">
              Email
            </label>

            <input
              id="register-email"
              type="email"
              value={registerEmail}
              onChange={(event) =>
                setRegisterEmail(event.target.value)
              }
              placeholder="Enter your email"
              autoComplete="email"
            />

            <label htmlFor="register-password">
              Password
            </label>

            <input
              id="register-password"
              type="password"
              value={registerPassword}
              onChange={(event) =>
                setRegisterPassword(event.target.value)
              }
              placeholder="Create a password"
              autoComplete="new-password"
            />

            {registerError && (
              <div className="login-error">
                {registerError}
              </div>
            )}

            {registerMessage && (
              <div className="form-message success">
                {registerMessage}
              </div>
            )}

            <button
              type="submit"
              className="login-button"
              disabled={registerLoading}
            >
              {registerLoading
                ? "Creating Account..."
                : "Register"}
            </button>
          </form>

          <div className="auth-switch">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setShowRegister(false);
                setRegisterError("");
                setRegisterMessage("");
              }}
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>Inventory Management</h1>
          <p>Sign in to access your dashboard</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="login-form"
        >
          <label htmlFor="username">
            Username
          </label>

          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) =>
              setUsername(event.target.value)
            }
            placeholder="Enter your username"
            autoComplete="username"
          />

          <label htmlFor="password">
            Password
          </label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Enter your password"
            autoComplete="current-password"
          />

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="auth-switch">
          Don't have an account?{" "}
          <button
            type="button"
            onClick={() => {
              setShowRegister(true);
              setError("");
            }}
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;