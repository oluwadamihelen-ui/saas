"use client";

import { useState } from "react";
import { PasswordInput } from "@/components/PasswordInput";

/** Password + confirm-password pair for /signup, with live mismatch feedback. The server action still re-checks the match itself — this is a convenience, not the authority. */
export function SignupPasswordFields() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <>
      <PasswordInput
        name="password"
        required
        minLength={8}
        placeholder="Password (min. 8 characters)"
        className="input"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <PasswordInput
        name="confirmPassword"
        required
        minLength={8}
        placeholder="Confirm password"
        className="input"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
      {mismatch && <p className="text-xs text-red-300">Passwords don&rsquo;t match.</p>}
    </>
  );
}
