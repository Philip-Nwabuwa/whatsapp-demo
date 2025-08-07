"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Eye, EyeOff } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if user is already authenticated on mount
  useEffect(() => {
    const authStatus = localStorage.getItem("whatsapp-dashboard-auth");
    const authTimestamp = localStorage.getItem("whatsapp-dashboard-auth-time");

    if (authStatus === "authenticated" && authTimestamp) {
      const authTime = parseInt(authTimestamp);
      const now = Date.now();
      const hoursSinceAuth = (now - authTime) / (1000 * 60 * 60);

      // Keep authentication for 72 hours
      if (hoursSinceAuth < 72) {
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem("whatsapp-dashboard-auth");
        localStorage.removeItem("whatsapp-dashboard-auth-time");
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pin.length !== 6) {
      toast.error("PIN must be exactly 6 digits");
      return;
    }

    if (!/^\d{6}$/.test(pin)) {
      toast.error("PIN must contain only numbers");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsAuthenticated(true);
        localStorage.setItem("whatsapp-dashboard-auth", "authenticated");
        localStorage.setItem(
          "whatsapp-dashboard-auth-time",
          Date.now().toString()
        );
        toast.success("Authentication successful!");
      } else {
        toast.error(data.error || "Invalid PIN");
        setPin("");
      }
    } catch (error) {
      toast.error("Authentication failed. Please try again.");
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("whatsapp-dashboard-auth");
    localStorage.removeItem("whatsapp-dashboard-auth-time");
    toast.success("Logged out successfully");
  };

  if (isAuthenticated) {
    return (
      <div>
        {/* Logout button in top right */}
        <div className="fixed top-4 right-4 z-50">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="bg-background/80 backdrop-blur-sm"
          >
            Logout
          </Button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">WhatsApp Dashboard</CardTitle>
          <CardDescription>
            Enter your 6-digit PIN to access the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin">PIN</Label>
              <div className="relative">
                <Input
                  id="pin"
                  type={showPin ? "text" : "password"}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter 6-digit PIN"
                  maxLength={6}
                  className="pr-10 text-center text-lg tracking-widest"
                  disabled={isLoading}
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPin(!showPin)}
                  disabled={isLoading}
                >
                  {showPin ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || pin.length !== 6}
            >
              {isLoading ? "Verifying..." : "Access Dashboard"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
