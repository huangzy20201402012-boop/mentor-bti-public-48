import { PasswordLoginForm } from "./PasswordLoginForm";
import { SessionGateRefresh } from "./SessionGateRefresh";

export function LoginRequiredPage({ title, description }: { title: string; description: string }) {
  return (
    <main className="statement site-shell account-page">
      <SessionGateRefresh />
      <p className="eyebrow">导师BTI</p>
      <h1>{title}</h1>
      <p>{description}</p>
      <PasswordLoginForm />
    </main>
  );
}
