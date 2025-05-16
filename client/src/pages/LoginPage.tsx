import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription } from "../components/ui/alert";

// Default credentials from user.service.ts
const DEFAULT_EMAIL = "john@example.com";
const DEFAULT_PASSWORD = "password123";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, error: authError, isLoading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenantId");
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Logging in with email ${email}`);
      await login(email, password);

      // If there's a tenantId in the URL, redirect to that tenant
      if (tenantId) {
        console.log(`Redirecting to tenant: ${tenantId}`);
        window.location.href = `http://login.lvh.me:3000/api/auth/login/${tenantId}`;
        return;
      }

      // Otherwise navigate to select-tenant page
      navigate("/select-tenant");
    } catch (error) {
      console.error("Login error:", error);
      // Error is handled by the auth context, but we'll also set it here
      setError(authError || "Login failed. Please check your credentials.");
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            {tenantId
              ? `Login to access ${tenantId.toUpperCase()}`
              : "Login to Application"}
          </CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {(error || authError) && (
              <Alert variant="destructive">
                <AlertDescription>{error || authError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || authLoading}
            >
              {isLoading || authLoading
                ? "Logging in..."
                : tenantId
                ? `Login to ${tenantId.toUpperCase()}`
                : "Login"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <p className="text-sm text-gray-500">
            This is a secure multi-tenant application
          </p>
          <div className="text-xs text-gray-400">
            <p>Demo accounts:</p>
            <p>
              {DEFAULT_EMAIL} / {DEFAULT_PASSWORD}
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
