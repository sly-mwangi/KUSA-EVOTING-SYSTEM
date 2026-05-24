import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Brand } from "@/components/brand";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAdminLogin } from "@workspace/api-client-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Loader2, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const mut = useAdminLogin();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formattedEmail = email.trim().toLowerCase();

    try {
      const r = (await mut.mutateAsync({
        data: { email: formattedEmail, password },
      })) as any;

      if (r?.token && r?.user) {
        login(r.token, r.user);
        toast.success("Welcome to the admin console");

        // 1. Flush credential states immediately before unmounting/routing
        setEmail("");
        setPassword("");

        // 2. Safely trigger dashboard redirect
        navigate("/admin/dashboard");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Could not sign in");
    }
  };

  return (
    <div className="min-h-screen w-full bg-linear-to-br from-secondary via-secondary/95 to-background text-secondary-foreground flex flex-col">
      <header className="container mx-auto flex items-center justify-between p-4">
        <Brand />
        <ThemeToggle />
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-border/70 shadow-2xl">
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <CardTitle className="text-2xl">Admin Console</CardTitle>
              </div>
              <CardDescription>
                Restricted area. Authorised KUSA Electoral Commission staff
                only.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                id="admin-login-form"
                onSubmit={onSubmit}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Admin Email</Label>
                  <Input
                    id="admin-email"
                    name="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@ku.ac.ke"
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password</Label>
                  <Input
                    id="admin-password"
                    name="admin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={mut.isPending}
                >
                  {mut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  Sign in
                </Button>
                <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground"></div>
                <p className="text-center text-xs text-muted-foreground">
                  <Link href="/login" className="font-medium hover:underline">
                    Back to student sign in
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
