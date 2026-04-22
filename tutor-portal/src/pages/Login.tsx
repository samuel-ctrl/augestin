import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { extractErrorMessage, Button, BrandCredit } from "@shared";
import loginImage from "../assets/login.webp";
import logo from "../../shared-ui/src/assets/logo.svg";

export default function Login() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(loginId, password);
      navigate("/self-study");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Login failed. Please check your credentials and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative">
      {/* Mobile background image with reduced opacity */}
      <div
        className="absolute inset-0 bg-cover bg-center md:hidden"
        style={{ backgroundImage: `url(${loginImage})`, opacity: 0.15 }}
      />

      {/* Left side - Image (hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 bg-primary-50 items-center justify-center p-8">
        <img
          src={loginImage}
          alt="ultrAIment"
          className="max-w-md w-full object-contain"
        />
      </div>

      {/* Right side - Login form */}
      <div className="w-full md:w-1/2 flex items-center justify-center px-4 relative z-10">
        <div className="max-w-sm w-full">
          <div className="text-center mb-8">
            <img src={logo} alt="ultrAIment" className="h-16 mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Tutor Portal</p>
          </div>
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Login ID
              </label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="yourname@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <Button type="submit" color="primary" fullWidth loading={loading}>
              Sign In
            </Button>
          </form>
          <BrandCredit variant="login" />
        </div>
      </div>
    </div>
  );
}
