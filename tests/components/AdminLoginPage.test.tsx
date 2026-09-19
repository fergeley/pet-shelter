import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/client/adminAuth", () => ({
  useAdminAuth: () => ({ login: vi.fn(), register: vi.fn() }),
}));

import AdminLoginPage from "@/app/admin/login/page";

/**
 * The staff sign-in page must not hand out the seeded accounts in production.
 *
 * On master it pre-filled `admin@hopeforstrays.org` / `admin123`, so pressing
 * "Sign In to Portal" on an untouched page signed in as SUPER_ADMIN, and it rendered
 * one-click buttons for five seeded accounts. The server refusal is the control
 * (`tests/unit/security/publishedStaffPasswords.test.ts`); this is the advertisement.
 */
describe("/admin/login", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("in production, pre-fills nothing and offers no demo sign-in", () => {
    vi.stubEnv("NODE_ENV", "production");

    const { container } = render(<AdminLoginPage />);

    expect(container.querySelector<HTMLInputElement>("#login-email")?.value).toBe("");
    expect(container.querySelector<HTMLInputElement>("#login-password")?.value).toBe("");
    expect(screen.queryByText(/Quick Demo/i)).toBeNull();
    expect(container.textContent).not.toMatch(/hopeforstrays\.org/);
  });

  it("outside production, keeps the offline demo sign-in", () => {
    render(<AdminLoginPage />);

    expect(screen.getByText(/Quick Demo/i)).toBeInTheDocument();
  });
});
