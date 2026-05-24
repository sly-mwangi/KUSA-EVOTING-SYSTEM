import { useState } from "react";
import { Link, useLocation } from "wouter";
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
import {
  useForgotPassword,
  useResetPassword,
} from "@workspace/api-client-react";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";
import { motion } from "framer-motion";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const forgot = useForgotPassword();
  const reset = useResetPassword();
  const [, navigate] = useLocation();

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await forgot.mutateAsync({ data: { email } });
      toast.success("If your account exists, a code has been sent");
      setStep("reset");
      return;
    } catch (err: any) {
      toast.error(err?.message ?? "Could not send code");
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password too short");
      return;
    }
    if (newPassword !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      await reset.mutateAsync({ data: { email, otp: code, newPassword } });
      toast.success("Password reset. Please sign in.");
      navigate("/login");
    } catch (err: any) {
      toast.error(err?.message ?? "Reset failed");
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-background to-secondary/40 flex flex-col">
      <header className="container mx-auto flex items-center justify-between p-4">
        <Brand />
        <ThemeToggle />
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-border/70 shadow-lg">
            <CardHeader>
              <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/15 text-primary">
                <KeyRound className="h-4 w-4" />
              </div>
              <CardTitle className="text-2xl">
                {step === "email" ? "Forgot password" : "Reset password"}
              </CardTitle>
              <CardDescription>
                {step === "email"
                  ? "Enter your KU email and we'll send a reset code."
                  : "Enter the code we sent and choose a new password."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === "email" ? (
                <form onSubmit={submitEmail} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">University email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="12345.1234@students.ku.ac.ke"
                    />
                  </div>
                  <Button className="w-full" disabled={forgot.isPending}>
                    {forgot.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Send reset code"
                    )}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    <Link
                      href="/login"
                      className="font-medium text-primary hover:underline"
                    >
                      Back to sign in
                    </Link>
                  </p>
                </form>
              ) : (
                <form onSubmit={submitReset} className="space-y-4">
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={code} onChange={setCode}>
                      <InputOTPGroup>
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <InputOTPSlot key={i} index={i} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="np">New password</Label>
                    <Input
                      id="np"
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cn">Confirm password</Label>
                    <Input
                      id="cn"
                      type="password"
                      required
                      minLength={8}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" disabled={reset.isPending}>
                    {reset.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Reset password"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
