import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "@/App";

/**
 * The renderer is exercised against a stand-in bridge: jsdom has no Electron
 * preload behind it, so each test states explicitly which world it is running
 * in — absent, healthy, or broken.
 */
describe("App", () => {
  beforeEach(() => {
    Reflect.deleteProperty(window, "astra");
  });

  it("renders the foundation shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Astra" })).toBeInTheDocument();
    expect(screen.getByText("Design visually. Own your code.")).toBeInTheDocument();
  });

  it("states the hardening posture rather than staying silent about it", () => {
    render(<App />);

    expect(screen.getByText(/context isolation on/i)).toBeInTheDocument();
    expect(screen.getByText(/sandbox on/i)).toBeInTheDocument();
  });

  it("reports an absent bridge instead of looking connected", () => {
    render(<App />);

    expect(screen.getByTestId("bridge-status")).toHaveTextContent("unavailable");
    expect(screen.getByTestId("app-version")).toHaveTextContent("—");
  });

  it("reports a live bridge once the preload answers", async () => {
    Reflect.set(window, "astra", {
      ping: async (nonce?: string) => ({ pong: true, nonce: nonce ?? null }),
      getAppVersion: async () => "0.1.0",
    });

    render(<App />);

    await waitFor(() => expect(screen.getByTestId("bridge-status")).toHaveTextContent("connected"));
    expect(screen.getByTestId("app-version")).toHaveTextContent("0.1.0");
  });

  it("reports an unreachable bridge rather than hanging on 'probing'", async () => {
    Reflect.set(window, "astra", {
      ping: async () => {
        throw new Error("IPC channel closed");
      },
      getAppVersion: async () => {
        throw new Error("IPC channel closed");
      },
    });

    render(<App />);

    await waitFor(() => expect(screen.getByTestId("bridge-status")).toHaveTextContent("unavailable"));
  });

  it("does not leave the UI stuck on 'probing' when a version lookup alone fails", async () => {
    Reflect.set(window, "astra", {
      ping: async (nonce?: string) => ({ pong: true, nonce: nonce ?? null }),
      getAppVersion: async () => {
        throw new Error("version unavailable");
      },
    });

    render(<App />);

    await waitFor(() => expect(screen.getByTestId("bridge-status")).toHaveTextContent("connected"));
    expect(screen.getByTestId("app-version")).toHaveTextContent("—");
  });
});
